// Offres, contre-offres et acceptation (F8). L'acceptation est atomique : transaction et mise à jour
// conditionnelle du colis (status ∈ {open, negotiating} et assignedCarrier = null).

import type { ClientSession } from 'mongoose';
import {
  ACTIVE_OFFER_STATUSES,
  canTransitionOffer,
  type CounterOfferInput,
  type CreateOfferInput,
  type MyOfferTab,
  type OfferActor,
  type OfferStatus,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { newDeliveryCode } from '../../lib/deliveryCode';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import { isBlockedBetween } from '../me/service';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { transitionParcel } from '../parcels/transitions';
import { UserModel, type UserLean } from '../users/model';
import { createWalletService } from '../wallet/service';
import { OfferModel, type OfferLean } from './model';
import { toOfferDto } from './serializers';

const TAB_STATUSES: Record<MyOfferTab, OfferStatus[]> = {
  active: ['pending', 'countered'],
  accepted: ['accepted'],
  finished: ['rejected', 'withdrawn', 'cancelled'],
};

export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await OfferModel.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export function createOfferService(deps: Deps) {
  const wallet = createWalletService(deps);

  async function loadOffer(id: string): Promise<OfferLean> {
    const o = (await OfferModel.findById(id).lean()) as OfferLean | null;
    if (!o) throw new AppError(404, 'NOT_FOUND', 'Offre introuvable');
    return o;
  }

  async function loadParcel(id: unknown): Promise<ParcelLean> {
    const p = (await ParcelModel.findById(id).lean()) as ParcelLean | null;
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
    return p;
  }

  async function dto(o: OfferLean, opts: { fullPlate?: boolean } = {}) {
    const carrier = (await UserModel.findById(o.carrier).lean()) as UserLean;
    return toOfferDto(o, carrier, opts);
  }

  function assertOfferTransition(o: OfferLean, to: OfferStatus, actor: OfferActor) {
    if (!canTransitionOffer(o.status, to, actor)) {
      throw new AppError(409, 'INVALID_TRANSITION', `Offre ${o.status} → ${to} refusée`, { from: o.status, to });
    }
  }

  /** Mise à jour conditionnelle au statut lu ; 409 si l'offre a changé entre-temps. */
  async function setOffer(o: OfferLean, update: Record<string, unknown>, session?: ClientSession) {
    const updated = await OfferModel.findOneAndUpdate({ _id: o._id, status: o.status }, update, {
      new: true,
      session,
    }).lean();
    if (!updated) throw new AppError(409, 'INVALID_TRANSITION', 'L’offre a changé de statut');
    return updated as OfferLean;
  }

  async function assertSender(o: OfferLean, userId: string) {
    const p = await loadParcel(o.parcel);
    if (p.sender.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Réservé à l’expéditeur');
    return p;
  }

  function assertCarrier(o: OfferLean, userId: string) {
    if (o.carrier.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Réservé au transporteur');
  }

  /**
   * Accepte une offre au prix final donné : colis → assigned, autres offres actives → rejected
   * (rejectedBecauseAccepted), code de remise généré. Exactement une acceptation réussit.
   */
  async function assign(o: OfferLean, finalPrice: number, actor: 'sender' | 'carrier', actorId: string) {
    const now = deps.now();
    await wallet.assertCanTakeJobs(o.carrier, actor);
    const commission = await wallet.snapshot(finalPrice, now);
    const code = newDeliveryCode(deps.config.deliveryCodeKey);
    let notSelected: string[] = [];
    const result = await withTransaction(async (session) => {
      const parcel = (await ParcelModel.findById(o.parcel).session(session).lean()) as ParcelLean;
      if (parcel.assignedCarrier || !['open', 'negotiating'].includes(parcel.status)) {
        throw new AppError(409, 'PARCEL_ALREADY_ASSIGNED', 'Ce colis a déjà un transporteur');
      }
      let updatedParcel: ParcelLean;
      try {
        updatedParcel = await transitionParcel({
          parcel,
          to: 'assigned',
          actor,
          by: actorId,
          now,
          where: { assignedCarrier: null },
          set: {
            assignedCarrier: o.carrier,
            acceptedOffer: o._id,
            finalPrice,
            commission,
            deliveryCode: { cipher: code.cipher, attempts: 0, lockedAt: null },
          },
          session,
        });
      } catch (err) {
        if (err instanceof AppError && err.code === 'INVALID_TRANSITION') {
          throw new AppError(409, 'PARCEL_ALREADY_ASSIGNED', 'Ce colis a déjà un transporteur');
        }
        throw err;
      }
      const accepted = await setOffer(o, { status: 'accepted', finalPrice, rejectedBecauseAccepted: false }, session);
      const others = await OfferModel.find(
        { parcel: o.parcel, _id: { $ne: o._id }, status: { $in: ACTIVE_OFFER_STATUSES } },
        { carrier: 1 },
        { session },
      ).lean();
      notSelected = others.map((x) => x.carrier.toString());
      await OfferModel.updateMany(
        { parcel: o.parcel, _id: { $ne: o._id }, status: { $in: ACTIVE_OFFER_STATUSES } },
        { status: 'rejected', rejectedBecauseAccepted: true },
        { session },
      );
      return { parcel: updatedParcel, offer: accepted };
    });
    await deps.bus.emit('offer.accepted', {
      offerId: o._id.toString(),
      parcelId: o.parcel.toString(),
      carrierId: o.carrier.toString(),
      senderId: result.parcel.sender.toString(),
      finalPrice,
      by: actor,
      notSelected,
    });
    await deps.bus.emit('parcel.status_changed', {
      parcelId: o.parcel.toString(),
      from: 'negotiating',
      to: 'assigned',
      actorId,
    });
    return dto(result.offer, { fullPlate: true });
  }

  return {
    async create(carrier: UserLean, parcelId: string, input: CreateOfferInput) {
      const carrierId = carrier._id.toString();
      const { requireCarrierVerification } = await deps.settings.getAll();
      if (requireCarrierVerification && carrier.carrierVerification?.status !== 'approved') {
        throw new AppError(403, 'CARRIER_NOT_VERIFIED', 'Vérification transporteur requise');
      }
      await wallet.assertCanTakeJobs(carrierId);
      const parcel = await loadParcel(parcelId);
      if (parcel.sender.toString() === carrierId) {
        throw new AppError(422, 'OWN_PARCEL', 'Impossible de faire une offre sur son propre colis');
      }
      if (!['open', 'negotiating'].includes(parcel.status) || parcel.assignedCarrier || parcel.hidden?.isHidden) {
        throw new AppError(409, 'INVALID_TRANSITION', 'Ce colis n’accepte plus d’offres');
      }
      if (await isBlockedBetween(carrierId, parcel.sender.toString())) {
        throw new AppError(403, 'BLOCKED', 'Action impossible avec cet utilisateur');
      }
      const vehicle = carrier.vehicles?.find((v) => v._id.toString() === input.vehicleId);
      if (!vehicle) throw new AppError(404, 'NOT_FOUND', 'Véhicule introuvable');
      if (!parcel.vehicleTypes.includes(vehicle.type)) {
        throw new AppError(422, 'VEHICLE_NOT_ACCEPTED', 'Véhicule non accepté pour ce colis');
      }
      const price = input.atAskingPrice ? parcel.requestedPrice : input.price;
      const now = deps.now();

      const offer = await withTransaction(async (session) => {
        let created;
        try {
          [created] = await OfferModel.create(
            [
              {
                parcel: parcel._id,
                carrier: carrier._id,
                vehicle: {
                  vehicleId: vehicle._id,
                  type: vehicle.type,
                  brand: vehicle.brand,
                  model: vehicle.model,
                  plate: vehicle.plate,
                  capacityKg: vehicle.capacityKg,
                  volumeM3: vehicle.volumeM3,
                  photo: vehicle.photo ?? null,
                },
                price,
                atAskingPrice: !!input.atAskingPrice,
                message: input.message ?? null,
                proposedPickupDate: input.proposedPickupDate,
                rounds: [{ by: 'carrier', price, message: input.message ?? null, at: now }],
              },
            ],
            { session },
          );
        } catch (err) {
          if ((err as { code?: number }).code === 11000) {
            throw new AppError(409, 'OFFER_ALREADY_ACTIVE', 'Offre déjà active sur ce colis');
          }
          throw err;
        }
        if (parcel.status === 'open') {
          await transitionParcel({ parcel, to: 'negotiating', actor: 'system', now, session, inc: { offersCount: 1 } });
        } else {
          await ParcelModel.updateOne({ _id: parcel._id }, { $inc: { offersCount: 1 } }, { session });
        }
        return created!.toObject() as OfferLean;
      });
      await deps.bus.emit('offer.created', {
        offerId: offer._id.toString(),
        parcelId,
        carrierId,
        senderId: parcel.sender.toString(),
        price,
        atAskingPrice: !!input.atAskingPrice,
      });
      return dto(offer);
    },

    async listForParcel(senderId: string, parcelId: string, sort: 'price' | 'rating' | 'recent' = 'recent') {
      const parcel = await loadParcel(parcelId);
      if (parcel.sender.toString() !== senderId) throw new AppError(403, 'FORBIDDEN', 'Réservé à l’expéditeur');
      const offers = (await OfferModel.find({ parcel: parcelId, status: { $ne: 'withdrawn' } })
        .sort({ createdAt: -1 })
        .lean()) as OfferLean[];
      const carriers = (await UserModel.find({ _id: { $in: offers.map((o) => o.carrier) } }).lean()) as UserLean[];
      const byId = new Map(carriers.map((c) => [c._id.toString(), c]));
      const items = offers.map((o) => toOfferDto(o, byId.get(o.carrier.toString())!));
      const active = (s: OfferStatus) => (ACTIVE_OFFER_STATUSES.includes(s) || s === 'accepted' ? 0 : 1);
      items.sort((a, b) => {
        const byStatus = active(a.status) - active(b.status);
        if (byStatus) return byStatus;
        if (sort === 'price') return a.price - b.price;
        if (sort === 'rating') return b.carrier.rating.average - a.carrier.rating.average;
        return 0;
      });
      return { items };
    },

    async get(userId: string, offerId: string) {
      const o = await loadOffer(offerId);
      const parcel = await loadParcel(o.parcel);
      const isSender = parcel.sender.toString() === userId;
      if (!isSender && o.carrier.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Accès refusé');
      return { ...(await dto(o, { fullPlate: isSender && o.status === 'accepted' })), parcelTitle: parcel.title, parcelStatus: parcel.status, parcelRequestedPrice: parcel.requestedPrice, viewerIsSender: isSender };
    },

    async mine(carrierId: string, tab: MyOfferTab, page = 1, limit = 20) {
      const filter = { carrier: carrierId, status: { $in: TAB_STATUSES[tab] } };
      const [total, offers] = await Promise.all([
        OfferModel.countDocuments(filter),
        OfferModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      const parcels = await ParcelModel.find({ _id: { $in: offers.map((o) => o.parcel) } }, { title: 1, status: 1, pickup: 1, dropoff: 1, desiredDate: 1 }).lean();
      const byId = new Map(parcels.map((p) => [p._id.toString(), p]));
      const me = (await UserModel.findById(carrierId).lean()) as UserLean;
      return paginate(
        (offers as OfferLean[]).map((o) => {
          const p = byId.get(o.parcel.toString());
          return {
            ...toOfferDto(o, me),
            parcel: p
              ? {
                  id: p._id.toString(),
                  title: p.title,
                  status: p.status,
                  from: { wilayaCode: p.pickup.wilayaCode, commune: p.pickup.commune },
                  to: { wilayaCode: p.dropoff.wilayaCode, commune: p.dropoff.commune },
                  desiredDate: p.desiredDate,
                }
              : null,
          };
        }),
        page,
        limit,
        total,
      );
    },

    async accept(senderId: string, offerId: string) {
      const o = await loadOffer(offerId);
      await assertSender(o, senderId);
      assertOfferTransition(o, 'accepted', 'sender');
      return assign(o, o.price, 'sender', senderId);
    },

    async reject(senderId: string, offerId: string) {
      const o = await loadOffer(offerId);
      await assertSender(o, senderId);
      assertOfferTransition(o, 'rejected', 'sender');
      const updated = await setOffer(o, { status: 'rejected', rejectedBecauseAccepted: false });
      await deps.bus.emit('offer.rejected', { offerId, parcelId: o.parcel.toString(), carrierId: o.carrier.toString() });
      return dto(updated);
    },

    async counter(senderId: string, offerId: string, input: CounterOfferInput) {
      const o = await loadOffer(offerId);
      await assertSender(o, senderId);
      assertOfferTransition(o, 'countered', 'sender');
      const { limits } = await deps.settings.getAll();
      if (o.counterCount >= limits.maxCounterOffers) {
        throw new AppError(422, 'COUNTER_LIMIT_REACHED', 'Nombre maximum de contre-offres atteint');
      }
      // Une contre-offre au prix du transporteur ou au-dessus n'a pas de sens : il suffit d'accepter.
      if (input.price >= o.price) {
        throw new AppError(422, 'COUNTER_PRICE_NOT_LOWER', 'La contre-offre doit être inférieure au prix proposé', { price: o.price });
      }
      const updated = await setOffer(o, {
        $set: { status: 'countered' },
        $inc: { counterCount: 1 },
        $push: { rounds: { by: 'sender', price: input.price, message: input.message ?? null, at: deps.now() } },
      });
      await deps.bus.emit('offer.countered', {
        offerId,
        parcelId: o.parcel.toString(),
        carrierId: o.carrier.toString(),
        price: input.price,
      });
      return dto(updated);
    },

    async acceptCounter(carrierId: string, offerId: string) {
      const o = await loadOffer(offerId);
      assertCarrier(o, carrierId);
      assertOfferTransition(o, 'accepted', 'carrier');
      const lastSender = [...(o.rounds ?? [])].reverse().find((r) => r.by === 'sender');
      if (!lastSender) throw new AppError(409, 'INVALID_TRANSITION', 'Aucune contre-offre');
      return assign(o, lastSender.price, 'carrier', carrierId);
    },

    /** Refus de la contre-offre : retour en pending au prix précédent. */
    async rejectCounter(carrierId: string, offerId: string) {
      const o = await loadOffer(offerId);
      assertCarrier(o, carrierId);
      assertOfferTransition(o, 'pending', 'carrier');
      const updated = await setOffer(o, {
        $set: { status: 'pending' },
        $push: { rounds: { by: 'carrier', price: o.price, message: null, at: deps.now() } },
      });
      const parcel = await loadParcel(o.parcel);
      await deps.bus.emit('offer.counter_rejected', {
        offerId,
        parcelId: o.parcel.toString(),
        carrierId,
        senderId: parcel.sender.toString(),
        price: o.price,
      });
      return dto(updated);
    },

    /** Nouvelle proposition après une contre-offre : retour en pending au nouveau prix. */
    async reoffer(carrierId: string, offerId: string, input: CounterOfferInput) {
      const o = await loadOffer(offerId);
      assertCarrier(o, carrierId);
      assertOfferTransition(o, 'pending', 'carrier');
      // Au prix de la contre-offre ou en dessous, le transporteur doit l'accepter plutôt que reproposer.
      const lastSender = [...(o.rounds ?? [])].reverse().find((r) => r.by === 'sender');
      if (lastSender && input.price <= lastSender.price) {
        throw new AppError(422, 'REOFFER_PRICE_NOT_HIGHER', 'Le nouveau prix doit dépasser la contre-offre', { counterPrice: lastSender.price });
      }
      await wallet.assertCanTakeJobs(carrierId);
      const updated = await setOffer(o, {
        $set: { status: 'pending', price: input.price, atAskingPrice: false },
        $push: { rounds: { by: 'carrier', price: input.price, message: input.message ?? null, at: deps.now() } },
      });
      const parcel = await loadParcel(o.parcel);
      await deps.bus.emit('offer.created', {
        offerId,
        parcelId: o.parcel.toString(),
        carrierId,
        senderId: parcel.sender.toString(),
        price: input.price,
        atAskingPrice: false,
        reoffer: true,
      });
      return dto(updated);
    },

    async withdraw(carrierId: string, offerId: string) {
      const o = await loadOffer(offerId);
      assertCarrier(o, carrierId);
      if (o.status === 'accepted') {
        throw new AppError(409, 'INVALID_TRANSITION', 'Utilisez le désistement depuis le colis');
      }
      assertOfferTransition(o, 'withdrawn', 'carrier');
      const updated = await setOffer(o, { status: 'withdrawn' });
      const parcel = await loadParcel(o.parcel);
      await deps.bus.emit('offer.withdrawn', {
        offerId,
        parcelId: o.parcel.toString(),
        carrierId,
        senderId: parcel.sender.toString(),
      });
      return dto(updated);
    },
  };
}

export type OfferService = ReturnType<typeof createOfferService>;
