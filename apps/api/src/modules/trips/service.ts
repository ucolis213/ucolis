// Trajets (F9) : publication par un transporteur vérifié, récurrence hebdomadaire, colis compatibles,
// propositions de colis par les expéditeurs (TripRequest), passage automatique en completed.

import { randomUUID } from 'node:crypto';
import { Types, type FilterQuery } from 'mongoose';
import {
  PUBLIC_PARCEL_STATUSES,
  isParcelCompatibleWithTrip,
  type TripDto,
  type TripInput,
  type TripListQuery,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import { LIMITS, consume } from '../../lib/rateLimit';
import { isBlockedBetween } from '../me/service';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { fromPoint, toPoint } from '../parcels/serializers';
import type { ParcelService } from '../parcels/service';
import { UserModel, accountTypeOf, type UserLean } from '../users/model';
import { toUserSummary } from '../users/serializers';
import { TripModel, TripRequestModel, type TripLean } from './model';

const DAY = 86_400_000;
const ACTIVE_TRIP_STATUSES = ['active', 'full'];

export function toTripDto(t: TripLean, carrier: UserLean): TripDto {
  return {
    id: t._id.toString(),
    carrier: toUserSummary(carrier),
    from: { wilayaCode: t.from.wilayaCode, commune: t.from.commune, location: fromPoint(t.from.location) },
    to: { wilayaCode: t.to.wilayaCode, commune: t.to.commune, location: fromPoint(t.to.location) },
    stops: t.stops ?? [],
    departureAt: t.departureAt.toISOString(),
    vehicle: { type: t.vehicle!.type, brand: t.vehicle!.brand ?? null, model: t.vehicle!.model ?? null, photo: t.vehicle!.photo ?? null },
    capacityKg: t.capacityKg,
    capacityM3: t.capacityM3,
    priceHint: t.priceHint?.mode && t.priceHint.amount ? { mode: t.priceHint.mode, amount: t.priceHint.amount } : null,
    recurrence: t.recurrence?.weekdays?.length && t.recurrence.until ? { weekdays: t.recurrence.weekdays, until: t.recurrence.until.toISOString() } : null,
    seriesId: t.seriesId ?? null,
    note: t.note ?? null,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Dates de départ d'une récurrence hebdomadaire (jours choisis, jusqu'à la date limite). */
export function occurrences(first: Date, weekdays: number[], until: Date): Date[] {
  const out: Date[] = [first];
  for (let d = new Date(first.getTime() + DAY); d <= until; d = new Date(d.getTime() + DAY)) {
    if (weekdays.includes(d.getUTCDay())) out.push(d);
  }
  return out;
}

const tripView = (t: TripLean) => ({ ...t, departureAt: t.departureAt, vehicle: { type: t.vehicle!.type } });
const parcelView = (p: ParcelLean) => ({
  ...p,
  weightKg: p.weightKg ?? null,
  volumeM3: p.volumeM3 ?? null,
  desiredDate: p.desiredDate ?? null,
});

export function createTripService(deps: Deps, parcels: ParcelService) {
  const requestLimiter = deps.limiters('trip-requests', LIMITS.tripRequestsPerDay);

  async function load(id: string) {
    const t = (await TripModel.findById(id).lean()) as TripLean | null;
    if (!t) throw new AppError(404, 'NOT_FOUND', 'Trajet introuvable');
    return t;
  }

  async function dtos(trips: TripLean[]) {
    const carriers = await UserModel.find({ _id: { $in: trips.map((t) => t.carrier) } }).lean();
    const byId = new Map(carriers.map((c) => [c._id.toString(), c as UserLean]));
    return trips.map((t) => toTripDto(t, byId.get(t.carrier.toString())!));
  }

  async function assertCarrier(user: UserLean) {
    const { requireCarrierVerification } = await deps.settings.getAll();
    if (requireCarrierVerification && user.carrierVerification?.status !== 'approved') {
      throw new AppError(403, 'CARRIER_NOT_VERIFIED', 'Vérification transporteur requise');
    }
  }

  return {
    load,
    dtos,

    async create(user: UserLean, input: TripInput) {
      await assertCarrier(user);
      const { limits } = await deps.settings.getAll();
      const max = accountTypeOf(user) === 'professional' ? limits.activeTripsPro : limits.activeTripsIndividual;
      // Une série récurrente compte pour un seul trajet actif.
      const series = await TripModel.aggregate([
        { $match: { carrier: user._id, status: { $in: ACTIVE_TRIP_STATUSES }, departureAt: { $gte: deps.now() } } },
        { $group: { _id: { $ifNull: ['$seriesId', '$_id'] } } },
      ]);
      if (series.length >= max) throw new AppError(422, 'ACTIVE_TRIP_LIMIT', 'Limite de trajets actifs atteinte', { max });
      const vehicle = user.vehicles?.find((v) => v._id.toString() === input.vehicleId);
      if (!vehicle) throw new AppError(404, 'NOT_FOUND', 'Véhicule introuvable');

      const dates = input.recurrence
        ? occurrences(input.departureAt, input.recurrence.weekdays, input.recurrence.until)
        : [input.departureAt];
      const seriesId = dates.length > 1 ? randomUUID() : null;
      const docs = dates.map((departureAt) => ({
        carrier: user._id,
        from: { wilayaCode: input.from.wilayaCode, commune: input.from.commune, location: toPoint(input.from.location) },
        to: { wilayaCode: input.to.wilayaCode, commune: input.to.commune, location: toPoint(input.to.location) },
        stops: input.stops,
        departureAt,
        vehicle: { vehicleId: vehicle._id, type: vehicle.type, brand: vehicle.brand, model: vehicle.model, photo: vehicle.photo ?? null },
        capacityKg: input.capacityKg,
        capacityM3: input.capacityM3,
        priceHint: input.priceHint ?? { mode: null, amount: null },
        recurrence: input.recurrence ?? { weekdays: [], until: null },
        seriesId,
        note: input.note ?? null,
      }));
      const created = (await TripModel.insertMany(docs)).map((d) => d.toObject() as TripLean);
      for (const t of created) await deps.bus.emit('trip.created', { tripId: t._id.toString(), carrierId: user._id.toString() });
      return { items: await dtos(created) };
    },

    async update(userId: string, id: string, patch: Partial<Pick<TripInput, 'capacityKg' | 'capacityM3' | 'note' | 'priceHint' | 'departureAt'>>) {
      const t = await load(id);
      if (t.carrier.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Réservé au transporteur');
      if (!ACTIVE_TRIP_STATUSES.includes(t.status)) throw new AppError(409, 'INVALID_TRANSITION', 'Trajet terminé');
      const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const updated = (await TripModel.findByIdAndUpdate(id, { $set: set }, { new: true }).lean()) as TripLean;
      return (await dtos([updated]))[0]!;
    },

    async setStatus(userId: string, id: string, status: 'active' | 'full' | 'cancelled') {
      const t = await load(id);
      if (t.carrier.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Réservé au transporteur');
      if (!ACTIVE_TRIP_STATUSES.includes(t.status)) throw new AppError(409, 'INVALID_TRANSITION', 'Trajet terminé');
      const updated = (await TripModel.findByIdAndUpdate(id, { status }, { new: true }).lean()) as TripLean;
      return (await dtos([updated]))[0]!;
    },

    async list(q: TripListQuery, viewerId?: string) {
      const filter: FilterQuery<TripLean> = {
        status: 'active',
        'hidden.isHidden': { $ne: true },
        departureAt: { $gte: deps.now() },
      };
      if (q.fromWilaya) filter['from.wilayaCode'] = q.fromWilaya;
      if (q.toWilaya) filter.$or = [{ 'to.wilayaCode': q.toWilaya }, { stops: q.toWilaya }];
      if (q.vehicleType) filter['vehicle.type'] = q.vehicleType;
      if (q.date) {
        const start = new Date(Date.UTC(q.date.getUTCFullYear(), q.date.getUTCMonth(), q.date.getUTCDate()));
        filter.departureAt = { $gte: start, $lt: new Date(start.getTime() + DAY) };
      }
      if (viewerId) {
        const me = await UserModel.findById(viewerId, { blockedUsers: 1 }).lean();
        const blockers = await UserModel.find({ blockedUsers: new Types.ObjectId(viewerId) }, { _id: 1 }).lean();
        const excluded = [...((me?.blockedUsers as Types.ObjectId[]) ?? []), ...blockers.map((b) => b._id)];
        if (excluded.length) filter.carrier = { $nin: excluded };
      }
      const [total, items] = await Promise.all([
        TripModel.countDocuments(filter),
        TripModel.find(filter).sort({ departureAt: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      ]);
      return paginate(await dtos(items as TripLean[]), q.page, q.limit, total);
    },

    async get(id: string) {
      const t = await load(id);
      if (t.hidden?.isHidden) throw new AppError(404, 'NOT_FOUND', 'Trajet indisponible');
      return (await dtos([t]))[0]!;
    },

    async mine(userId: string) {
      const items = (await TripModel.find({ carrier: userId }).sort({ departureAt: -1 }).limit(100).lean()) as TripLean[];
      return { items: await dtos(items) };
    },

    async publicForUser(userId: string) {
      const items = (await TripModel.find({ carrier: userId, status: 'active', 'hidden.isHidden': { $ne: true }, departureAt: { $gte: deps.now() } })
        .sort({ departureAt: 1 })
        .limit(20)
        .lean()) as TripLean[];
      return { items: await dtos(items) };
    },

    /** Colis publiés compatibles avec le trajet (affichés au transporteur après publication). */
    async matchingParcels(tripId: string) {
      const t = await load(tripId);
      const route = [t.from.wilayaCode, ...(t.stops ?? []), t.to.wilayaCode];
      const candidates = (await ParcelModel.find({
        status: { $in: PUBLIC_PARCEL_STATUSES },
        'hidden.isHidden': { $ne: true },
        'pickup.wilayaCode': { $in: route },
        'dropoff.wilayaCode': { $in: route },
        sender: { $ne: t.carrier },
      })
        .limit(200)
        .lean()) as ParcelLean[];
      const ok = candidates.filter((p) => isParcelCompatibleWithTrip(parcelView(p), tripView(t)));
      return { items: await parcels.cards(ok) };
    },

    /** Trajets actifs compatibles avec un colis (correspondances automatiques à la publication). */
    async tripsForParcel(p: ParcelLean) {
      const trips = (await TripModel.find({
        status: 'active',
        'hidden.isHidden': { $ne: true },
        carrier: { $ne: p.sender },
        // Sans date souhaitée : tout trajet à venir.
        departureAt: p.desiredDate
          ? { $gte: new Date(p.desiredDate.getTime() - 2 * DAY), $lte: new Date(p.desiredDate.getTime() + 2 * DAY) }
          : { $gte: deps.now() },
        $or: [{ 'from.wilayaCode': p.pickup.wilayaCode }, { stops: p.pickup.wilayaCode }],
      }).lean()) as TripLean[];
      return trips.filter((t) => isParcelCompatibleWithTrip(parcelView(p), tripView(t)));
    },

    /** « Proposer mon colis » : colis compatible, une demande par colis et par trajet, 10 par jour. */
    async request(senderId: string, tripId: string, parcelId: string) {
      const t = await load(tripId);
      if (t.status !== 'active' || t.hidden?.isHidden) throw new AppError(409, 'INVALID_TRANSITION', 'Trajet indisponible');
      const p = (await ParcelModel.findById(parcelId).lean()) as ParcelLean | null;
      if (!p || p.sender.toString() !== senderId) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
      if (!PUBLIC_PARCEL_STATUSES.includes(p.status)) throw new AppError(409, 'INVALID_TRANSITION', 'Colis déjà attribué');
      if (!isParcelCompatibleWithTrip(parcelView(p), tripView(t))) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Colis incompatible avec ce trajet');
      }
      if (await isBlockedBetween(senderId, t.carrier.toString())) throw new AppError(403, 'BLOCKED', 'Utilisateur bloqué');
      if (await TripRequestModel.exists({ trip: tripId, parcel: parcelId })) {
        throw new AppError(409, 'INVALID_TRANSITION', 'Colis déjà proposé sur ce trajet');
      }
      await consume(requestLimiter, senderId);
      const req = await TripRequestModel.create({ trip: tripId, parcel: parcelId, sender: senderId });
      await deps.bus.emit('trip.requested', { requestId: req.id, tripId, parcelId, carrierId: t.carrier.toString(), senderId });
      return { id: req.id as string, status: req.status };
    },

    async requests(userId: string) {
      const myTrips = await TripModel.find({ carrier: userId }, { _id: 1 }).lean();
      const [received, sent] = await Promise.all([
        TripRequestModel.find({ trip: { $in: myTrips.map((t) => t._id) } }).sort({ createdAt: -1 }).limit(100).lean(),
        TripRequestModel.find({ sender: userId }).sort({ createdAt: -1 }).limit(100).lean(),
      ]);
      const parcelIds = [...received, ...sent].map((r) => r.parcel);
      const cards = new Map((await parcels.cards((await ParcelModel.find({ _id: { $in: parcelIds } }).lean()) as ParcelLean[])).map((c) => [c.id, c]));
      const shape = (r: (typeof received)[number]) => ({
        id: r._id.toString(),
        tripId: r.trip.toString(),
        status: r.status,
        parcel: cards.get(r.parcel.toString()) ?? null,
        createdAt: r.createdAt,
      });
      return { received: received.map(shape), sent: sent.map(shape) };
    },

    async decline(carrierId: string, requestId: string) {
      const req = await TripRequestModel.findById(requestId).lean();
      if (!req) throw new AppError(404, 'NOT_FOUND', 'Demande introuvable');
      const t = await load(req.trip.toString());
      if (t.carrier.toString() !== carrierId) throw new AppError(403, 'FORBIDDEN', 'Réservé au transporteur');
      const res = await TripRequestModel.updateOne({ _id: requestId, status: 'pending' }, { status: 'declined' });
      if (!res.modifiedCount) throw new AppError(409, 'INVALID_TRANSITION', 'Demande déjà traitée');
      await deps.bus.emit('trip.request_declined', { requestId, parcelId: req.parcel.toString(), senderId: req.sender.toString() });
    },
  };
}

export type TripService = ReturnType<typeof createTripService>;
