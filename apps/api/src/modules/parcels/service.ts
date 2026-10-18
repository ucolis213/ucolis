import { Types, type FilterQuery } from 'mongoose';
import {
  ACTIVE_OFFER_STATUSES,
  ACTIVE_PARCEL_STATUSES,
  PUBLIC_PARCEL_STATUSES,
  getCommune,
  getWilaya,
  haversineKm,
  isOwnedUpload,
  suggestPrice,
  volumeM3FromCm,
  type CreateParcelInput,
  type ParcelDto,
  type ParcelListQuery,
  type ParcelStatus,
  type ParcelViewerRole,
  type UpdateParcelInput,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import { OfferModel, type OfferLean } from '../offers/model';
import { toOfferDto } from '../offers/serializers';
import { UserModel, accountTypeOf, type UserLean } from '../users/model';
import { CounterModel, ParcelModel, type ParcelLean } from './model';
import { toParcelCard, toParcelDto, toPoint } from './serializers';
import { transitionParcel } from './transitions';
import { parcelViewerHooks } from './viewerHooks';

const DAY_MS = 86_400_000;
/** Le téléphone de l'autre partie reste visible 7 jours après la livraison. */
const PHONE_VISIBLE_AFTER_DELIVERY_MS = 7 * DAY_MS;
const PHONE_VISIBLE_STATUSES: ParcelStatus[] = ['assigned', 'in_transit', 'delivered_pending', 'disputed'];

export const normalizeSearch = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildSearchText(p: Pick<CreateParcelInput, 'title' | 'description' | 'pickup' | 'dropoff'>) {
  const parts = [p.title, p.description ?? ''];
  for (const place of [p.pickup, p.dropoff]) {
    const c = getCommune(place.commune);
    const w = getWilaya(place.wilayaCode);
    parts.push(c?.fr ?? '', c?.ar ?? '', w?.fr ?? '', w?.ar ?? '');
  }
  return normalizeSearch(parts.join(' '));
}

export async function nextReference(now: Date): Promise<string> {
  const yymm = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const counter = await CounterModel.findOneAndUpdate(
    { _id: `parcel:${yymm}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `UC-${yymm}-${String(counter.seq).padStart(4, '0')}`;
}

/** Champs calculés par l'API : les valeurs envoyées par le client sont ignorées. */
async function derived(deps: Deps, input: Pick<CreateParcelInput, 'pickup' | 'dropoff' | 'weightKg' | 'dimensionsCm'>) {
  const { pricing } = await deps.settings.getAll();
  const distanceKm = haversineKm(input.pickup.location, input.dropoff.location);
  const { length, width, height } = input.dimensionsCm;
  const volumeM3 = volumeM3FromCm(length, width, height);
  return {
    distanceKm,
    volumeM3,
    suggestedPrice: suggestPrice({ distanceKm, weightKg: input.weightKg, volumeM3 }, pricing),
  };
}

const placeDoc = (p: CreateParcelInput['pickup']) => ({
  address: p.address,
  details: p.details ?? null,
  wilayaCode: p.wilayaCode,
  commune: p.commune,
  location: toPoint(p.location),
});

export function createParcelService(deps: Deps) {
  async function loadUsers(ids: (Types.ObjectId | null | undefined)[]) {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    const users = (await UserModel.find({ _id: { $in: unique } }).lean()) as UserLean[];
    return new Map(users.map((u) => [u._id.toString(), u]));
  }

  async function blockedIds(viewerId: string | undefined): Promise<Types.ObjectId[]> {
    if (!viewerId) return [];
    const [me, blockers] = await Promise.all([
      UserModel.findById(viewerId, { blockedUsers: 1 }).lean(),
      UserModel.find({ blockedUsers: new Types.ObjectId(viewerId) }, { _id: 1 }).lean(),
    ]);
    return [...((me?.blockedUsers as Types.ObjectId[]) ?? []), ...blockers.map((b) => b._id)];
  }

  async function assertActiveLimit(user: UserLean) {
    const { limits } = await deps.settings.getAll();
    const max = accountTypeOf(user) === 'professional' ? limits.activeParcelsPro : limits.activeParcelsIndividual;
    const active = await ParcelModel.countDocuments({
      sender: user._id,
      status: { $in: ACTIVE_PARCEL_STATUSES },
    });
    if (active >= max) {
      throw new AppError(422, 'ACTIVE_PARCEL_LIMIT', 'Limite de colis actifs atteinte', { max });
    }
  }

  function assertPhotos(userId: string, photos: { publicId: string }[]) {
    if (photos.some((p) => !isOwnedUpload(p.publicId, 'parcel_photo', userId))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Photo invalide', {
        fields: [{ path: 'photos', message: 'validation.photosCount' }],
      });
    }
  }

  async function load(id: string): Promise<ParcelLean> {
    const p = (await ParcelModel.findById(id).lean()) as ParcelLean | null;
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
    return p;
  }

  async function loadOwned(userId: string, id: string): Promise<ParcelLean> {
    const p = await load(id);
    if (p.sender.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Vous n’êtes pas l’expéditeur');
    return p;
  }

  async function viewerContext(p: ParcelLean, viewerId: string | undefined): Promise<ParcelDto['viewer']> {
    const base: ParcelDto['viewer'] = {
      role: 'guest',
      myOffer: null,
      counterpartPhone: null,
      hasReviewed: false,
      conversationId: null,
      openDisputeId: null,
    };
    if (!viewerId) return base;
    const isSender = p.sender.toString() === viewerId;
    const isCarrier = p.assignedCarrier?.toString() === viewerId;
    let role: ParcelViewerRole;
    let myOffer: OfferLean | null = null;
    if (isSender) role = 'sender';
    else if (isCarrier) role = 'assigned_carrier';
    else {
      myOffer = (await OfferModel.findOne({
        parcel: p._id,
        carrier: viewerId,
        status: { $in: ACTIVE_OFFER_STATUSES },
      }).lean()) as OfferLean | null;
      role = myOffer
        ? 'carrier_with_offer'
        : PUBLIC_PARCEL_STATUSES.includes(p.status)
          ? 'carrier_no_offer'
          : 'other';
    }
    if (isCarrier) {
      myOffer = (await OfferModel.findOne({ _id: p.acceptedOffer }).lean()) as OfferLean | null;
    }

    let counterpartPhone: string | null = null;
    const now = deps.now().getTime();
    const phoneWindow =
      PHONE_VISIBLE_STATUSES.includes(p.status) ||
      (p.status === 'delivered' && p.deliveredAt && now - p.deliveredAt.getTime() <= PHONE_VISIBLE_AFTER_DELIVERY_MS);
    if (phoneWindow && p.assignedCarrier && (isSender || isCarrier)) {
      const otherId = isSender ? p.assignedCarrier : p.sender;
      const other = await UserModel.findById(otherId, { phone: 1, status: 1 }).lean();
      counterpartPhone = other && other.status !== 'deleted' ? other.phone : null;
    }

    const extras = await parcelViewerHooks.run(p, viewerId, role);
    return {
      ...base,
      role,
      myOffer: myOffer ? toOfferDto(myOffer, (await UserModel.findById(myOffer.carrier).lean()) as UserLean) : null,
      counterpartPhone,
      ...extras,
    };
  }

  async function toDto(p: ParcelLean, viewerId?: string) {
    const users = await loadUsers([p.sender, p.assignedCarrier]);
    const viewer = await viewerContext(p, viewerId);
    const showRecipient =
      viewer.role === 'sender' || (viewer.role === 'assigned_carrier' && p.status !== 'open' && p.status !== 'negotiating');
    return toParcelDto(p, {
      sender: users.get(p.sender.toString())!,
      assignedCarrier: p.assignedCarrier ? (users.get(p.assignedCarrier.toString()) ?? null) : null,
      viewer,
      showRecipient,
      isFavorite: viewerId ? await parcelViewerHooks.isFavorite(p._id.toString(), viewerId) : undefined,
    });
  }

  return {
    load,
    loadOwned,
    toDto,

    async create(user: UserLean, input: CreateParcelInput) {
      const userId = user._id.toString();
      await assertActiveLimit(user);
      assertPhotos(userId, input.photos);
      const now = deps.now();
      const settings = await deps.settings.getAll();
      const calc = await derived(deps, input);
      const parcel = await ParcelModel.create({
        reference: await nextReference(now),
        sender: user._id,
        title: input.title,
        description: input.description ?? '',
        category: input.category,
        fragile: input.fragile,
        weightKg: input.weightKg,
        dimensionsCm: input.dimensionsCm,
        vehicleTypes: [...new Set(input.vehicleTypes)],
        pickup: placeDoc(input.pickup),
        dropoff: placeDoc(input.dropoff),
        desiredDate: input.desiredDate,
        timeSlot: input.timeSlot,
        flexibleDates: input.flexibleDates,
        urgent: input.urgent,
        recipient: input.recipient ?? null,
        paymentArrangement: input.paymentArrangement,
        requestedPrice: input.requestedPrice,
        photos: input.photos,
        ...calc,
        expiresAt: new Date(input.desiredDate.getTime() + settings.parcelExpiryDays * DAY_MS),
        statusHistory: [{ from: null, to: 'open', byType: 'user', by: user._id, at: now }],
        searchText: buildSearchText(input),
      });
      await UserModel.updateOne({ _id: user._id }, { $inc: { 'stats.parcelsPublished': 1 } });
      await deps.bus.emit('parcel.created', { parcelId: parcel.id, senderId: userId });
      return toDto(parcel.toObject() as ParcelLean, userId);
    },

    async update(userId: string, id: string, input: UpdateParcelInput) {
      const p = await loadOwned(userId, id);
      if (p.status !== 'open' && p.status !== 'negotiating') {
        throw new AppError(409, 'INVALID_TRANSITION', 'Modification impossible après attribution');
      }
      if (input.photos) assertPhotos(userId, input.photos);
      const merged = {
        title: input.title ?? p.title,
        description: input.description ?? p.description,
        pickup: input.pickup ?? { ...p.pickup, location: { lat: p.pickup.location.coordinates[1]!, lng: p.pickup.location.coordinates[0]! } },
        dropoff: input.dropoff ?? { ...p.dropoff, location: { lat: p.dropoff.location.coordinates[1]!, lng: p.dropoff.location.coordinates[0]! } },
        weightKg: input.weightKg ?? p.weightKg,
        dimensionsCm: input.dimensionsCm ?? p.dimensionsCm,
      } as CreateParcelInput;
      const set: Record<string, unknown> = {};
      for (const key of [
        'title', 'description', 'category', 'fragile', 'weightKg', 'dimensionsCm', 'timeSlot',
        'flexibleDates', 'urgent', 'recipient', 'paymentArrangement', 'requestedPrice', 'photos',
      ] as const) {
        if (input[key] !== undefined) set[key] = input[key];
      }
      if (input.vehicleTypes) set.vehicleTypes = [...new Set(input.vehicleTypes)];
      if (input.pickup) set.pickup = placeDoc(input.pickup);
      if (input.dropoff) set.dropoff = placeDoc(input.dropoff);
      if (input.desiredDate) {
        const { parcelExpiryDays } = await deps.settings.getAll();
        set.desiredDate = input.desiredDate;
        set.expiresAt = new Date(input.desiredDate.getTime() + parcelExpiryDays * DAY_MS);
      }
      Object.assign(set, await derived(deps, merged));
      set.searchText = buildSearchText(merged);

      const updated = (await ParcelModel.findOneAndUpdate(
        { _id: id, status: { $in: ['open', 'negotiating'] } },
        { $set: set },
        { new: true },
      ).lean()) as ParcelLean | null;
      if (!updated) throw new AppError(409, 'INVALID_TRANSITION', 'Le colis a changé de statut');

      const material = ['pickup', 'dropoff', 'weightKg', 'dimensionsCm', 'desiredDate'].some(
        (k) => input[k as keyof UpdateParcelInput] !== undefined,
      );
      if (material) await deps.bus.emit('parcel.updated', { parcelId: id, senderId: userId });
      return toDto(updated, userId);
    },

    /** Annulation par l'expéditeur : open, negotiating ; motif obligatoire depuis assigned. */
    async cancel(userId: string, id: string, reason?: string) {
      const p = await loadOwned(userId, id);
      if (p.status === 'assigned' && !reason?.trim()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Motif obligatoire', {
          fields: [{ path: 'reason', message: 'validation.required' }],
        });
      }
      const now = deps.now();
      const session = await ParcelModel.startSession();
      let updated!: ParcelLean;
      let affectedCarriers: string[] = [];
      try {
        await session.withTransaction(async () => {
          updated = await transitionParcel({
            parcel: p,
            to: 'cancelled',
            actor: 'sender',
            by: userId,
            reason: reason ?? null,
            now,
            set: { cancellation: { by: userId, reason: reason ?? null, at: now }, 'deliveryCode.cipher': null },
            session,
          });
          const active = await OfferModel.find(
            { parcel: p._id, status: { $in: ACTIVE_OFFER_STATUSES } },
            { carrier: 1 },
            { session },
          ).lean();
          affectedCarriers = active.map((o) => o.carrier.toString());
          await OfferModel.updateMany(
            { parcel: p._id, status: { $in: ACTIVE_OFFER_STATUSES } },
            { status: 'cancelled' },
            { session },
          );
          if (p.status === 'assigned') {
            await OfferModel.updateOne({ _id: p.acceptedOffer }, { status: 'cancelled' }, { session });
            if (p.assignedCarrier) affectedCarriers.push(p.assignedCarrier.toString());
          }
        });
      } finally {
        await session.endSession();
      }
      await deps.bus.emit('parcel.status_changed', {
        parcelId: id,
        from: p.status,
        to: 'cancelled',
        actorId: userId,
        notify: affectedCarriers,
      });
      return toDto(updated, userId);
    },

    /** Données pré-remplies de l'assistant, avec une date à choisir (comptes pro). */
    async duplicate(user: UserLean, id: string) {
      if (accountTypeOf(user) !== 'professional') {
        throw new AppError(403, 'FORBIDDEN', 'Réservé aux comptes professionnels');
      }
      const p = await loadOwned(user._id.toString(), id);
      const dto = await toDto(p, user._id.toString());
      return {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        fragile: dto.fragile,
        weightKg: dto.weightKg,
        dimensionsCm: dto.dimensionsCm,
        vehicleTypes: dto.vehicleTypes,
        pickup: dto.pickup,
        dropoff: dto.dropoff,
        timeSlot: dto.timeSlot,
        flexibleDates: dto.flexibleDates,
        urgent: dto.urgent,
        recipient: dto.recipient,
        paymentArrangement: dto.paymentArrangement,
        requestedPrice: dto.requestedPrice,
        photos: dto.photos,
        desiredDate: null,
      };
    },

    async get(id: string, viewerId?: string) {
      const p = await load(id);
      const isParticipant = viewerId && (p.sender.toString() === viewerId || p.assignedCarrier?.toString() === viewerId);
      const isPublic = PUBLIC_PARCEL_STATUSES.includes(p.status) && !p.hidden?.isHidden;
      if (!isPublic && !isParticipant && !(viewerId && (await parcelViewerHooks.canSee(p, viewerId)))) {
        throw new AppError(404, 'PARCEL_UNAVAILABLE', 'Annonce indisponible');
      }
      if (viewerId && p.sender.toString() !== viewerId) {
        await ParcelModel.updateOne({ _id: p._id }, { $inc: { viewsCount: 1 } });
      }
      return toDto(p, viewerId);
    },

    async list(query: ParcelListQuery, viewerId?: string) {
      const filter: FilterQuery<ParcelLean> = {
        status: { $in: PUBLIC_PARCEL_STATUSES },
        'hidden.isHidden': { $ne: true },
      };
      const excluded = await blockedIds(viewerId);
      const senderFilter: Record<string, unknown> = {};
      if (excluded.length) senderFilter.$nin = excluded;
      if (query.proOnly || query.verifiedOnly) {
        const userFilter: Record<string, unknown> = {};
        if (query.proOnly) userFilter['pro.status'] = 'approved';
        if (query.verifiedOnly) userFilter['carrierVerification.status'] = 'approved';
        const ids = await UserModel.find(userFilter, { _id: 1 }).lean();
        senderFilter.$in = ids.map((u) => u._id);
      }
      if (Object.keys(senderFilter).length) filter.sender = senderFilter;
      if (query.q) filter.searchText = { $regex: escapeRegex(normalizeSearch(query.q)) };
      if (query.fromWilaya) filter['pickup.wilayaCode'] = query.fromWilaya;
      if (query.toWilaya) filter['dropoff.wilayaCode'] = query.toWilaya;
      if (query.maxWeight) filter.weightKg = { $lte: query.maxWeight };
      if (query.vehicleType) filter.vehicleTypes = query.vehicleType;
      if (query.urgent) filter.urgent = true;
      if (query.dateFrom || query.dateTo) {
        filter.desiredDate = {
          ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
          ...(query.dateTo ? { $lte: query.dateTo } : {}),
        };
      }
      if (query.priceMin !== undefined || query.priceMax !== undefined) {
        filter.requestedPrice = {
          ...(query.priceMin !== undefined ? { $gte: query.priceMin } : {}),
          ...(query.priceMax !== undefined ? { $lte: query.priceMax } : {}),
        };
      }
      const hasPoint = query.lat !== undefined && query.lng !== undefined;
      if (hasPoint && query.radiusKm) {
        filter['pickup.location'] = {
          $geoWithin: { $centerSphere: [[query.lng!, query.lat!], query.radiusKm / 6378.1] },
        };
      }

      const total = await ParcelModel.countDocuments(filter);
      let items: ParcelLean[];
      const skip = (query.page - 1) * query.limit;
      if (query.sort === 'nearest' && hasPoint) {
        // $near trie par distance ; il remplace le filtre de rayon par maxDistance.
        const nearFilter = { ...filter };
        nearFilter['pickup.location'] = {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [query.lng!, query.lat!] },
            ...(query.radiusKm ? { $maxDistance: query.radiusKm * 1000 } : {}),
          },
        };
        items = (await ParcelModel.find(nearFilter).skip(skip).limit(query.limit).lean()) as ParcelLean[];
      } else {
        const sort: Record<string, 1 | -1> =
          query.sort === 'date'
            ? { desiredDate: 1, _id: 1 }
            : query.sort === 'price_desc'
              ? { requestedPrice: -1, _id: 1 }
              : { createdAt: -1, _id: -1 };
        items = (await ParcelModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean()) as ParcelLean[];
      }
      const users = await loadUsers(items.map((p) => p.sender));
      const favorites = viewerId
        ? await parcelViewerHooks.favoriteSet(items.map((p) => p._id.toString()), viewerId)
        : null;
      return paginate(
        items.map((p) =>
          toParcelCard(p, users.get(p.sender.toString())!, favorites ? favorites.has(p._id.toString()) : undefined),
        ),
        query.page,
        query.limit,
        total,
      );
    },

    async mine(userId: string, status?: ParcelStatus[], page = 1, limit = 20) {
      const filter: FilterQuery<ParcelLean> = { sender: userId };
      if (status?.length) filter.status = { $in: status };
      const [total, items] = await Promise.all([
        ParcelModel.countDocuments(filter),
        ParcelModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      const users = await loadUsers([new Types.ObjectId(userId)]);
      const me = users.get(userId)!;
      return paginate(
        (items as ParcelLean[]).map((p) => toParcelCard(p, me)),
        page,
        limit,
        total,
      );
    },

    async cards(parcels: ParcelLean[]) {
      const users = await loadUsers(parcels.map((p) => p.sender));
      return parcels.map((p) => toParcelCard(p, users.get(p.sender.toString())!));
    },
  };
}

export type ParcelService = ReturnType<typeof createParcelService>;
