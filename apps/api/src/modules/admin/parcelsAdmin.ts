// Colis côté staff : recherche, détail complet, forçage de statut (motif + audit, refusé pendant un
// litige), masquage, suppression.

import type { Request } from 'express';
import type { FilterQuery } from 'mongoose';
import { canForceParcelStatus, hasAnyPermission, type ParcelStatus } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import { ConversationModel } from '../conversations/model';
import { pairKeyOf } from '../conversations/service';
import { OfferModel, type OfferLean } from '../offers/model';
import { toOfferDto } from '../offers/serializers';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { normalizeSearch } from '../parcels/service';
import { fromPoint } from '../parcels/serializers';
import { transitionParcel } from '../parcels/transitions';
import { UserModel, type UserLean } from '../users/model';
import { toUserSummary } from '../users/serializers';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const PARCEL_CSV_COLUMNS = ['reference', 'title', 'status', 'from', 'to', 'requestedPrice', 'finalPrice', 'createdAt'];

export function adminParcelRow(p: ParcelLean) {
  return {
    id: p._id.toString(),
    reference: p.reference,
    title: p.title,
    status: p.status,
    from: p.pickup.wilayaCode,
    to: p.dropoff.wilayaCode,
    requestedPrice: p.requestedPrice,
    finalPrice: p.finalPrice ?? null,
    offersCount: p.offersCount,
    hidden: !!p.hidden?.isHidden,
    createdAt: p.createdAt,
  };
}

export function createParcelsAdmin(deps: Deps) {
  async function load(id: string) {
    const p = (await ParcelModel.findById(id).lean()) as ParcelLean | null;
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
    return p;
  }

  return {
    load,

    async list(q: { page: number; limit: number; q?: string; status?: string; wilayaCode?: string }, all = false) {
      const filter: FilterQuery<ParcelLean> = {};
      if (q.status) filter.status = q.status;
      if (q.wilayaCode) filter.$or = [{ 'pickup.wilayaCode': q.wilayaCode }, { 'dropoff.wilayaCode': q.wilayaCode }];
      if (q.q) {
        const term = q.q.trim();
        filter.$and = [
          {
            $or: [
              { reference: new RegExp(`^${escapeRegex(term.toUpperCase())}`) },
              { searchText: { $regex: escapeRegex(normalizeSearch(term)) } },
            ],
          },
        ];
      }
      const total = await ParcelModel.countDocuments(filter);
      const query = ParcelModel.find(filter).sort({ createdAt: -1 });
      if (all) query.limit(10_000);
      else query.skip((q.page - 1) * q.limit).limit(q.limit);
      const items = (await query.lean()) as ParcelLean[];
      return paginate(items.map(adminParcelRow), q.page, q.limit, total);
    },

    async detail(req: Request, id: string) {
      const p = await load(id);
      const [sender, carrier, offers] = await Promise.all([
        UserModel.findById(p.sender).lean(),
        p.assignedCarrier ? UserModel.findById(p.assignedCarrier).lean() : null,
        OfferModel.find({ parcel: p._id }).sort({ createdAt: -1 }).lean(),
      ]);
      const carriers = await UserModel.find({ _id: { $in: offers.map((o) => o.carrier) } }).lean();
      const byId = new Map(carriers.map((c) => [c._id.toString(), c as UserLean]));
      const canReadConversation = hasAnyPermission(req.staff!, ['conversations.view_all', 'conversations.view_reported']);
      const conversation =
        canReadConversation && p.assignedCarrier
          ? await ConversationModel.findOne({ pairKey: pairKeyOf(p.sender.toString(), p.assignedCarrier.toString()), parcel: p._id }, { _id: 1 }).lean()
          : null;
      return {
        parcel: {
          ...adminParcelRow(p),
          description: p.description,
          photos: p.photos,
          pickup: { ...p.pickup, location: fromPoint(p.pickup.location) },
          dropoff: { ...p.dropoff, location: fromPoint(p.dropoff.location) },
          weightKg: p.weightKg,
          distanceKm: p.distanceKm,
          desiredDate: p.desiredDate,
          suggestedPrice: p.suggestedPrice,
          statusHistory: p.statusHistory,
          cancellation: p.cancellation,
          hiddenInfo: p.hidden,
          deliveryProof: p.deliveryProof,
        },
        sender: sender ? toUserSummary(sender as UserLean) : null,
        carrier: carrier ? toUserSummary(carrier as UserLean) : null,
        offers: (offers as OfferLean[]).map((o) => toOfferDto(o, byId.get(o.carrier.toString())!)),
        conversationId: conversation?._id.toString() ?? null,
      };
    },

    async forceStatus(req: Request, id: string, to: ParcelStatus, reason: string) {
      const p = await load(id);
      const hasOpenDispute = p.status === 'disputed';
      if (!canForceParcelStatus(p.status, to, hasOpenDispute)) {
        throw new AppError(409, 'INVALID_TRANSITION', hasOpenDispute ? 'Un litige est ouvert' : 'Statut identique');
      }
      await transitionParcel({ parcel: p, to, actor: 'staff', by: req.staff!.id, reason, now: deps.now(), force: true });
      await audit(req, { action: 'parcel.force_status', targetType: 'parcel', targetId: id, reason, before: { status: p.status }, after: { status: to } });
      await deps.bus.emit('parcel.status_changed', { parcelId: id, from: p.status, to, actorId: null });
    },

    async hide(req: Request, id: string, hidden: boolean, reason: string) {
      const p = await load(id);
      await ParcelModel.updateOne(
        { _id: id },
        { hidden: { isHidden: hidden, reason: hidden ? reason : null, by: req.staff!.id, at: deps.now() } },
      );
      await audit(req, { action: hidden ? 'parcel.hide' : 'parcel.unhide', targetType: 'parcel', targetId: id, reason, before: { hidden: !!p.hidden?.isHidden }, after: { hidden } });
    },

    /** Suppression : l'annonce est masquée et annulée, l'historique reste pour l'audit. */
    async remove(req: Request, id: string, reason: string) {
      const p = await load(id);
      if (!['open', 'negotiating', 'expired', 'cancelled'].includes(p.status)) {
        throw new AppError(409, 'INVALID_TRANSITION', 'Suppression impossible pendant une livraison');
      }
      const now = deps.now();
      await ParcelModel.updateOne(
        { _id: id },
        {
          $set: { status: 'cancelled', hidden: { isHidden: true, reason, by: req.staff!.id, at: now } },
          ...(p.status !== 'cancelled'
            ? { $push: { statusHistory: { from: p.status, to: 'cancelled', byType: 'staff', by: req.staff!.id, at: now, reason } } }
            : {}),
        },
      );
      await OfferModel.updateMany({ parcel: id, status: { $in: ['pending', 'countered'] } }, { status: 'cancelled' });
      await audit(req, { action: 'parcel.delete', targetType: 'parcel', targetId: id, reason, before: { status: p.status } });
    },
  };
}

export type ParcelsAdmin = ReturnType<typeof createParcelsAdmin>;
