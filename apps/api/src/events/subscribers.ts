// Abonnés aux événements de domaine : notifications (catalogue de shared/notifications.ts), push,
// événements Socket.IO et effets secondaires (conversation créée à l'acceptation d'une offre).

import { ACTIVE_OFFER_STATUSES, getWilaya, translate, type NotificationType } from '@ucolis/shared';
import { FavoriteModel } from '../modules/alerts/model';
import { TripModel, TripRequestModel, type TripLean } from '../modules/trips/model';
import type { Deps } from '../deps';
import { conversationRoom } from '../modules/conversations/service';
import { OfferModel } from '../modules/offers/model';
import { ParcelModel, type ParcelLean } from '../modules/parcels/model';
import { UserModel, type UserLean } from '../modules/users/model';
import { displayName } from '../modules/users/serializers';
import type { Services } from '../services';

const SYSTEM_MESSAGES: Partial<Record<string, string>> = {
  in_transit: 'delivery_started',
  delivered_pending: 'delivery_declared',
  delivered: 'delivery_completed',
  cancelled: 'parcel_cancelled',
  disputed: 'dispute_opened',
  negotiating: 'carrier_withdrew',
  open: 'carrier_withdrew',
};

export function registerSubscribers(
  deps: Deps,
  s: Pick<Services, 'notifications' | 'conversations' | 'tracking' | 'reports' | 'trips' | 'alerts'>,
) {
  const { bus, realtime } = deps;
  const notify = s.notifications.notify;

  const parcelInfo = async (id: string) =>
    ParcelModel.findById(id, { title: 1, sender: 1, assignedCarrier: 1, status: 1 }).lean();
  const nameOf = async (id: string) => {
    const u = (await UserModel.findById(id).lean()) as UserLean | null;
    return u ? displayName(u) : '';
  };

  async function parcelUpdatedRealtime(parcelId: string, extra: string[] = []) {
    const p = await ParcelModel.findById(parcelId, { status: 1, sender: 1, assignedCarrier: 1 }).lean();
    if (!p) return;
    const targets = new Set([p.sender.toString(), ...(p.assignedCarrier ? [p.assignedCarrier.toString()] : []), ...extra]);
    for (const userId of targets) realtime.toUser(userId, 'parcel:updated', { parcelId, status: p.status });
  }

  async function offerRealtime(offerId: string) {
    const o = await OfferModel.findById(offerId).lean();
    if (!o) return;
    const p = await ParcelModel.findById(o.parcel, { sender: 1 }).lean();
    const payload = { offerId, parcelId: o.parcel.toString(), status: o.status, price: o.price };
    realtime.toUser(o.carrier.toString(), 'offer:updated', payload);
    if (p) realtime.toUser(p.sender.toString(), 'offer:updated', payload);
  }

  bus.on('offer.created', async (e) => {
    const p = await parcelInfo(e.parcelId);
    const type: NotificationType = e.atAskingPrice ? 'offer_at_asking_price' : 'offer_received';
    await notify({
      type,
      to: e.senderId,
      params: { carrierName: await nameOf(e.carrierId), price: e.price, parcelTitle: p?.title ?? '' },
      data: { parcelId: e.parcelId, offerId: e.offerId },
    });
    await offerRealtime(e.offerId);
    await parcelUpdatedRealtime(e.parcelId);
    const carrierTrips = await TripModel.find({ carrier: e.carrierId }, { _id: 1 }).lean();
    await TripRequestModel.updateMany(
      { parcel: e.parcelId, trip: { $in: carrierTrips.map((t) => t._id) }, status: 'pending' },
      { status: 'offered' },
    );
  });

  bus.on('offer.countered', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({
      type: 'counter_offer_received',
      to: e.carrierId,
      params: { price: e.price, parcelTitle: p?.title ?? '' },
      data: { parcelId: e.parcelId, offerId: e.offerId },
    });
    await offerRealtime(e.offerId);
  });

  bus.on('offer.counter_rejected', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({
      type: 'counter_offer_rejected',
      to: e.senderId,
      params: { carrierName: await nameOf(e.carrierId), price: e.price, parcelTitle: p?.title ?? '' },
      data: { parcelId: e.parcelId, offerId: e.offerId },
    });
    await offerRealtime(e.offerId);
  });

  bus.on('offer.rejected', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({
      type: 'offer_rejected',
      to: e.carrierId,
      params: { parcelTitle: p?.title ?? '' },
      data: { parcelId: e.parcelId, offerId: e.offerId },
    });
    await offerRealtime(e.offerId);
  });

  bus.on('offer.withdrawn', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({
      type: 'offer_withdrawn',
      to: e.senderId,
      params: { carrierName: await nameOf(e.carrierId), parcelTitle: p?.title ?? '' },
      data: { parcelId: e.parcelId, offerId: e.offerId },
    });
    await offerRealtime(e.offerId);
  });

  bus.on('offer.accepted', async (e) => {
    const p = await parcelInfo(e.parcelId);
    const params = { price: e.finalPrice, parcelTitle: p?.title ?? '' };
    const data = { parcelId: e.parcelId, offerId: e.offerId };
    // La conversation du colis est créée ou réutilisée, avec un message système.
    const { conversation } = await s.conversations.ensure(e.senderId, e.carrierId, e.parcelId, null);
    await s.conversations.system(conversation._id.toString(), 'offer_accepted', { price: e.finalPrice });
    const withConv = { ...data, conversationId: conversation._id.toString() };
    await notify({ type: 'offer_accepted', to: e.carrierId, params, data: withConv });
    await notify({ type: 'offer_accepted', to: e.senderId, params, data: withConv });
    for (const carrierId of e.notSelected) {
      await notify({ type: 'offer_not_selected', to: carrierId, params: { parcelTitle: p?.title ?? '' }, data });
      realtime.toUser(carrierId, 'parcel:updated', { parcelId: e.parcelId, status: 'assigned' });
    }
    await offerRealtime(e.offerId);
  });

  bus.on('parcel.updated', async (e) => {
    const p = await parcelInfo(e.parcelId);
    const offers = await OfferModel.find({ parcel: e.parcelId, status: { $in: ACTIVE_OFFER_STATUSES } }, { carrier: 1 }).lean();
    for (const o of offers) {
      await notify({
        type: 'parcel_updated',
        to: o.carrier.toString(),
        params: { parcelTitle: p?.title ?? '' },
        data: { parcelId: e.parcelId, offerId: o._id.toString() },
      });
    }
  });

  bus.on('parcel.status_changed', async (e) => {
    const p = await parcelInfo(e.parcelId);
    if (!p) return;
    const params = { parcelTitle: p.title };
    const data = { parcelId: e.parcelId };
    const sender = p.sender.toString();
    const carrier = p.assignedCarrier?.toString();
    switch (e.to) {
      case 'cancelled':
        if (e.from !== 'disputed') {
          for (const userId of new Set(e.notify ?? [])) await notify({ type: 'parcel_cancelled', to: userId, params, data });
        }
        break;
      case 'expired':
        await notify({ type: 'parcel_expired', to: sender, params, data });
        break;
      case 'in_transit':
        await notify({ type: 'delivery_started', to: sender, params, data });
        break;
      case 'delivered_pending':
        await notify({ type: 'delivery_declared', to: sender, params, data });
        break;
      case 'delivered':
        if (e.from !== 'disputed') {
          await notify({ type: 'delivery_completed', to: sender, params, data });
          if (carrier) await notify({ type: 'delivery_completed', to: carrier, params, data });
        }
        break;
      case 'negotiating':
      case 'open':
        if (e.from === 'assigned') {
          await notify({ type: 'carrier_withdrew', to: sender, params, data });
          for (const userId of e.notify ?? []) {
            await notify({ type: 'offer_reactivated', to: userId, params, data });
          }
        }
        break;
    }
    await parcelUpdatedRealtime(e.parcelId, e.notify ?? []);

    if (e.to === 'assigned' || e.to === 'cancelled' || e.to === 'expired') {
      const fans = await FavoriteModel.find({ parcel: e.parcelId }, { user: 1 }).lean();
      for (const f of fans) {
        const userId = f.user.toString();
        if (userId === sender || userId === carrier) continue;
        await notify({ type: 'favorite_unavailable', to: userId, params, data });
      }
    }

    // Messages système dans la conversation du colis, et fin du partage GPS.
    const other = carrier ?? (e.from === 'assigned' ? e.actorId : null);
    const key = SYSTEM_MESSAGES[e.to];
    if (other && key && other !== sender) {
      const conv = await s.conversations.find(sender, other, e.parcelId);
      if (conv) await s.conversations.system(conv, key);
    }
    if (e.from === 'in_transit' || e.to === 'cancelled') s.tracking.stop(e.parcelId, e.to);
  });

  bus.on('delivery.reminder', async (e) => {
    const p = await parcelInfo(e.parcelId);
    if (!p) return;
    const params = { parcelTitle: p.title };
    const data = { parcelId: e.parcelId };
    if (e.kind === 'confirm') {
      await notify({ type: 'delivery_confirm_reminder', to: p.sender.toString(), params, data });
      return;
    }
    for (const userId of [p.sender, p.assignedCarrier].filter(Boolean)) {
      await notify({ type: 'delivery_late', to: userId!.toString(), params, data });
    }
  });

  bus.on('carrier.verification_decided', async (e) => {
    await notify({
      type: e.approved ? 'identity_approved' : 'identity_rejected',
      to: e.userId,
      params: e.reason ? { reason: e.reason } : {},
      data: { userId: e.userId },
    });
  });

  bus.on('pro.decided', async (e) => {
    const type = e.decision === 'approved' ? 'pro_approved' : e.decision === 'rejected' ? 'pro_rejected' : 'pro_revoked';
    await notify({ type, to: e.userId, params: e.reason ? { reason: e.reason } : {}, data: { userId: e.userId } });
  });

  bus.on('carrier.verification_expired', async (e) => {
    await notify({ type: 'identity_expired', to: e.userId, data: { userId: e.userId } });
  });

  bus.on('carrier.document_expiring', async (e) => {
    await notify({ type: 'identity_expiring', to: e.userId, params: { days: e.days }, data: { userId: e.userId } });
  });

  bus.on('review.published', async (e) => {
    await notify({ type: 'review_published', to: e.targetId, data: { parcelId: e.parcelId } });
  });

  bus.on('review.reminder', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({ type: 'review_reminder', to: e.userId, params: { parcelTitle: p?.title ?? '' }, data: { parcelId: e.parcelId } });
  });

  bus.on('report.resolved', async (e) => {
    await notify({ type: 'report_resolved', to: e.reporterId });
  });

  bus.on('dispute.opened', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({
      type: 'dispute_opened',
      to: e.against,
      params: { parcelTitle: p?.title ?? '' },
      data: { parcelId: e.parcelId, disputeId: e.disputeId },
    });
  });

  bus.on('dispute.resolved', async (e) => {
    const p = await parcelInfo(e.parcelId);
    for (const userId of e.parties) {
      await notify({
        type: 'dispute_resolved',
        to: userId,
        params: { parcelTitle: p?.title ?? '' },
        data: { parcelId: e.parcelId, disputeId: e.disputeId },
      });
    }
  });

  bus.on('carrier.withdrawals_threshold', async (e) => {
    await s.reports.system('user', e.carrierId, `Signalement automatique : ${e.count} désistements en 30 jours`);
  });

  // Correspondances automatiques (F9, F10) : au plus une notification par trajet et par heure.
  bus.on('parcel.created', async (e) => {
    const p = (await ParcelModel.findById(e.parcelId).lean()) as ParcelLean | null;
    if (!p) return;
    const now = deps.now();
    const notified = new Set<string>();
    for (const t of await s.trips.tripsForParcel(p)) {
      const claimed = await TripModel.updateOne(
        { _id: t._id, $or: [{ lastMatchNotifiedAt: null }, { lastMatchNotifiedAt: { $lte: new Date(now.getTime() - 3600_000) } }] },
        { lastMatchNotifiedAt: now },
      );
      if (!claimed.modifiedCount) continue;
      notified.add(t.carrier.toString());
      await notify({
        type: 'trip_parcel_match',
        to: t.carrier.toString(),
        params: { route: `${getWilaya(p.pickup.wilayaCode)?.fr ?? ''} → ${getWilaya(p.dropoff.wilayaCode)?.fr ?? ''}`, parcelTitle: p.title },
        data: { parcelId: e.parcelId, tripId: t._id.toString() },
      });
    }
    // Transporteurs proches du départ (position récente ou commune du profil), sauf ceux déjà prévenus par un trajet.
    for (const c of await s.alerts.nearbyCarriers(p, notified)) {
      await notify({
        type: 'nearby_parcel',
        to: c.userId,
        params: { parcelTitle: p.title, km: c.km },
        data: { parcelId: e.parcelId },
        skipPush: c.skipPush,
      });
    }
    await s.alerts.onParcel(p);
  });

  bus.on('trip.created', async (e) => {
    const t = (await TripModel.findById(e.tripId).lean()) as TripLean | null;
    if (t) await s.alerts.onTrip(t);
  });

  bus.on('trip.requested', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({
      type: 'trip_request_received',
      to: e.carrierId,
      params: { parcelTitle: p?.title ?? '' },
      data: { parcelId: e.parcelId, tripId: e.tripId },
    });
  });

  bus.on('trip.request_declined', async (e) => {
    const p = await parcelInfo(e.parcelId);
    await notify({ type: 'trip_request_declined', to: e.senderId, params: { parcelTitle: p?.title ?? '' }, data: { parcelId: e.parcelId } });
  });

  bus.on('alert.matched', async (e) => {
    await notify({ type: 'new_listing_match', to: e.userId, params: { count: e.count, route: e.route } });
  });

  bus.on('broadcast.deliver', async (e) => {
    await notify({ type: 'broadcast', to: e.userId, params: { title: e.title, body: e.body }, data: e.link ? { url: e.link } : {} });
  });

  bus.on('terms.published', async () => {
    const cursor = UserModel.find({ status: 'active' }, { _id: 1 }).cursor();
    for await (const u of cursor) await notify({ type: 'terms_updated', to: u._id.toString() });
  });

  bus.on('message.created', async (e) => {
    if (e.system) {
      for (const r of e.recipients) await s.notifications.pushCounters(r);
      return;
    }
    const authorName = e.authorId ? await nameOf(e.authorId) : '';
    const viewing = await realtime.usersInRoom(conversationRoom(e.conversationId));
    for (const r of e.recipients) {
      const skipPush = viewing.has(r) || (await s.conversations.isMuted(r, e.conversationId));
      await notify({
        type: 'new_message',
        to: r,
        params: { authorName, preview: e.preview },
        data: { conversationId: e.conversationId },
        skipPush,
        group: e.conversationId,
      });
    }
  });

  bus.on('conversation.read', async (e) => {
    await s.notifications.markConversationRead(e.userId, e.conversationId);
  });

  bus.on('user.sessions_revoked', (e) => {
    if (e.reason === 'remote_logout' || e.reason === 'token_reused' || e.reason === 'suspended' || e.reason === 'password_reset') {
      realtime.disconnectUser(e.userId, e.reason);
    }
  });

  bus.on('user.suspended', async (e) => {
    realtime.disconnectUser(e.userId, 'suspended');
    // Email aussi, pas de push.
    await notify({ type: 'account_suspended', to: e.userId, params: { reason: e.reason }, skipPush: true });
    const u = await UserModel.findById(e.userId, { email: 1, firstName: 1, preferences: 1 }).lean();
    if (u) {
      const locale = u.preferences?.language ?? 'fr';
      await deps.mailer.send({
        to: u.email,
        subject: translate(locale, 'notif.account_suspended.title'),
        text: translate(locale, 'notif.account_suspended.body', { reason: e.reason }),
      });
    }
  });
}
