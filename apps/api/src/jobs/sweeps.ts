// Balayages périodiques. Chacun est idempotent : relancé deux fois, il ne fait rien de plus
// (conditions sur le statut, marqueurs remindersSent). BullMQ les planifie et les relance en cas d'échec.

import { ACTIVE_OFFER_STATUSES } from '@ucolis/shared';
import type { Deps } from '../deps';
import { OfferModel } from '../modules/offers/model';
import { ParcelModel, type ParcelLean } from '../modules/parcels/model';
import { transitionParcel } from '../modules/parcels/transitions';
import { TripModel } from '../modules/trips/model';
import { ReviewModel } from '../modules/trust/model';
import { anonymizeUser } from '../modules/users/anonymize';
import { UserModel } from '../modules/users/model';
import type { Services } from '../services';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const BATCH = 200;

export type Sweep = (deps: Deps, services: Services) => Promise<number>;

/** Annonces sans transporteur dont la date souhaitée + parcelExpiryDays est dépassée. */
export const expireParcels: Sweep = async (deps) => {
  const now = deps.now();
  const due = (await ParcelModel.find({ status: { $in: ['open', 'negotiating'] }, expiresAt: { $lte: now } })
    .limit(BATCH)
    .lean()) as ParcelLean[];
  let done = 0;
  for (const p of due) {
    try {
      await transitionParcel({ parcel: p, to: 'expired', actor: 'job', now });
    } catch {
      continue; // Statut changé entre-temps.
    }
    await OfferModel.updateMany({ parcel: p._id, status: { $in: ACTIVE_OFFER_STATUSES } }, { status: 'cancelled' });
    await deps.bus.emit('parcel.status_changed', { parcelId: p._id.toString(), from: p.status, to: 'expired', actorId: null });
    done++;
  }
  return done;
};

/** Validation automatique à autoConfirmAt ; jamais sur un colis en litige (statut différent). */
export const autoConfirmDeliveries: Sweep = async (deps, services) => {
  const due = (await ParcelModel.find({ status: 'delivered_pending', autoConfirmAt: { $lte: deps.now() } })
    .limit(BATCH)
    .lean()) as ParcelLean[];
  let done = 0;
  for (const p of due) {
    try {
      await services.delivery.complete(p, 'job', null);
      done++;
    } catch {
      // Confirmée ou contestée entre-temps.
    }
  }
  return done;
};

/** Relances de l'expéditeur à +24 h et +60 h après la déclaration de livraison. */
export const confirmReminders: Sweep = async (deps) => {
  const now = deps.now().getTime();
  let done = 0;
  for (const [marker, delay] of [['confirm24', 24 * HOUR], ['confirm60', 60 * HOUR]] as const) {
    const due = await ParcelModel.find({
      status: 'delivered_pending',
      declaredDeliveredAt: { $lte: new Date(now - delay) },
      remindersSent: { $ne: marker },
    })
      .limit(BATCH)
      .lean();
    for (const p of due) {
      const res = await ParcelModel.updateOne({ _id: p._id, remindersSent: { $ne: marker } }, { $push: { remindersSent: marker } });
      if (!res.modifiedCount) continue;
      await deps.bus.emit('delivery.reminder', { parcelId: p._id.toString(), kind: 'confirm' });
      done++;
    }
  }
  return done;
};

/** Colis toujours en livraison 3 jours après la date souhaitée : les deux parties sont relancées. */
export const lateDeliveries: Sweep = async (deps) => {
  const limit = new Date(deps.now().getTime() - 3 * DAY);
  const due = await ParcelModel.find({ status: 'in_transit', desiredDate: { $lte: limit }, remindersSent: { $ne: 'late' } })
    .limit(BATCH)
    .lean();
  let done = 0;
  for (const p of due) {
    const res = await ParcelModel.updateOne({ _id: p._id, remindersSent: { $ne: 'late' } }, { $push: { remindersSent: 'late' } });
    if (!res.modifiedCount) continue;
    await deps.bus.emit('delivery.reminder', { parcelId: p._id.toString(), kind: 'late' });
    done++;
  }
  return done;
};

/** Pièces datées (permis, assurance) : rappels à J-30 et J-7, dossier expiré le jour même. */
export const carrierDocuments: Sweep = async (deps) => {
  const now = deps.now().getTime();
  const users = await UserModel.find(
    {
      'carrierVerification.status': 'approved',
      $or: [
        { 'carrierVerification.licenseExpiresAt': { $lte: new Date(now + 30 * DAY) } },
        { 'carrierVerification.insuranceExpiresAt': { $lte: new Date(now + 30 * DAY) } },
      ],
    },
    { carrierVerification: 1 },
  ).lean();
  let done = 0;
  for (const u of users) {
    const cv = u.carrierVerification!;
    const dates = [cv.licenseExpiresAt, cv.insuranceExpiresAt].filter((d): d is Date => !!d);
    const earliest = Math.min(...dates.map((d) => d.getTime()));
    const userId = u._id.toString();
    if (earliest <= now) {
      const res = await UserModel.updateOne(
        { _id: u._id, 'carrierVerification.status': 'approved' },
        { 'carrierVerification.status': 'expired' },
      );
      if (res.modifiedCount) {
        await deps.bus.emit('carrier.verification_expired', { userId });
        done++;
      }
      continue;
    }
    const days = earliest - now <= 7 * DAY ? 7 : 30;
    const marker = `d${days}:${new Date(earliest).toISOString().slice(0, 10)}`;
    if ((cv.remindersSent ?? []).includes(marker)) continue;
    await UserModel.updateOne({ _id: u._id }, { $addToSet: { 'carrierVerification.remindersSent': marker } });
    await deps.bus.emit('carrier.document_expiring', { userId, days });
    done++;
  }
  return done;
};

/** Double aveugle : publication des avis à la fin de la fenêtre, même si l'autre partie n'a pas noté. */
export const publishReviews: Sweep = async (deps, services) => {
  const { reviewWindowDays } = await deps.settings.getAll();
  const limit = new Date(deps.now().getTime() - reviewWindowDays * DAY);
  const parcels = await ParcelModel.find({ status: 'delivered', deliveredAt: { $lte: limit } }, { _id: 1 }).limit(BATCH * 5).lean();
  const pending = await ReviewModel.find({ publishedAt: null, parcel: { $in: parcels.map((p) => p._id) } }, { _id: 1 }).lean();
  return pending.length ? services.reviews.publish(pending.map((r) => r._id)) : 0;
};

/** Relance à +3 jours de la partie qui n'a pas encore noté, dans la fenêtre d'avis. */
export const reviewReminders: Sweep = async (deps) => {
  const now = deps.now().getTime();
  const { reviewWindowDays } = await deps.settings.getAll();
  const parcels = await ParcelModel.find({
    status: 'delivered',
    deliveredAt: { $lte: new Date(now - 3 * DAY), $gt: new Date(now - reviewWindowDays * DAY) },
  })
    .limit(BATCH)
    .lean();
  let done = 0;
  for (const p of parcels) {
    for (const party of [p.sender, p.assignedCarrier].filter(Boolean)) {
      const marker = `review:${party!.toString()}`;
      if ((p.remindersSent ?? []).includes(marker)) continue;
      if (await ReviewModel.exists({ parcel: p._id, author: party })) continue;
      const res = await ParcelModel.updateOne({ _id: p._id, remindersSent: { $ne: marker } }, { $push: { remindersSent: marker } });
      if (!res.modifiedCount) continue;
      await deps.bus.emit('review.reminder', { parcelId: p._id.toString(), userId: party!.toString() });
      done++;
    }
  }
  return done;
};

/** Un trajet passe en completed 24 h après le départ, sans action humaine. */
export const completeTrips: Sweep = async (deps) => {
  const res = await TripModel.updateMany(
    { status: { $in: ['active', 'full'] }, departureAt: { $lte: new Date(deps.now().getTime() - DAY) } },
    { status: 'completed' },
  );
  return res.modifiedCount;
};

/** Correspondances d'alertes accumulées : un push regroupé par alerte et par heure. */
export const flushAlerts: Sweep = async (_deps, services) => services.alerts.flush();

/** Comptes dont le délai de grâce de 14 jours est écoulé : anonymisation. */
export const purgeDeletedAccounts: Sweep = async (deps) => {
  const limit = new Date(deps.now().getTime() - 14 * DAY);
  const due = await UserModel.find({ status: 'pending_deletion', deletionRequestedAt: { $lte: limit } }, { _id: 1 }).limit(BATCH).lean();
  let done = 0;
  for (const u of due) {
    try {
      await anonymizeUser(deps, u._id.toString());
      done++;
    } catch (err) {
      deps.logger.warn({ err, userId: u._id.toString() }, 'suppression reportée');
    }
  }
  return done;
};

/** Diffusions programmées arrivées à échéance. */
export const sendScheduledBroadcasts: Sweep = async (_deps, services) => services.content.sendDue();

/** Planification : nom, fréquence (cron) et balayage. */
export const SCHEDULE: { name: string; pattern: string; run: Sweep }[] = [
  { name: 'expire-parcels', pattern: '5 * * * *', run: expireParcels },
  { name: 'auto-confirm', pattern: '*/5 * * * *', run: autoConfirmDeliveries },
  { name: 'confirm-reminders', pattern: '*/15 * * * *', run: confirmReminders },
  { name: 'late-deliveries', pattern: '20 * * * *', run: lateDeliveries },
  { name: 'carrier-documents', pattern: '0 6 * * *', run: carrierDocuments },
  { name: 'publish-reviews', pattern: '30 * * * *', run: publishReviews },
  { name: 'review-reminders', pattern: '0 10 * * *', run: reviewReminders },
  { name: 'complete-trips', pattern: '10 * * * *', run: completeTrips },
  { name: 'flush-alerts', pattern: '*/10 * * * *', run: flushAlerts },
  { name: 'purge-deleted-accounts', pattern: '0 3 * * *', run: purgeDeletedAccounts },
  { name: 'scheduled-broadcasts', pattern: '* * * * *', run: sendScheduledBroadcasts },
];
