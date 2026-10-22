// Livraison (F11) : démarrage, remise par code, déclaration, confirmation, désistement.

import {
  ACTIVE_OFFER_STATUSES,
  type FileRef,
  isOwnedUpload,
  type ParcelActor,
} from '@ucolis/shared';
import type { ClientSession } from 'mongoose';
import type { Deps } from '../../deps';
import { DELIVERY_CODE_MAX_ATTEMPTS, readDeliveryCode } from '../../lib/deliveryCode';
import { safeEqual } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { isBlockedBetween } from '../me/service';
import { OfferModel } from '../offers/model';
import { withTransaction } from '../offers/service';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { transitionParcel } from '../parcels/transitions';
import { UserModel } from '../users/model';
import { createWalletService, type BalanceChange } from '../wallet/service';

const HOUR = 3600_000;
const WITHDRAWAL_WINDOW_MS = 30 * 24 * HOUR;
export const WITHDRAWAL_ALERT_THRESHOLD = 3;

export function createDeliveryService(deps: Deps) {
  const wallet = createWalletService(deps);

  async function load(id: string): Promise<ParcelLean> {
    const p = (await ParcelModel.findById(id).lean()) as ParcelLean | null;
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
    return p;
  }

  async function asCarrier(userId: string, id: string) {
    const p = await load(id);
    if (p.assignedCarrier?.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Réservé au transporteur retenu');
    return p;
  }

  async function asSender(userId: string, id: string) {
    const p = await load(id);
    if (p.sender.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Réservé à l’expéditeur');
    return p;
  }

  async function changed(p: ParcelLean, to: ParcelLean['status'], actorId: string | null, notify?: string[]) {
    await deps.bus.emit('parcel.status_changed', {
      parcelId: p._id.toString(),
      from: p.status,
      to,
      actorId,
      ...(notify ? { notify } : {}),
    });
  }

  /**
   * Effets communs d'une livraison terminée (code, confirmation, validation automatique, litige),
   * dont le prélèvement de la commission dans la même transaction.
   */
  async function complete(p: ParcelLean, actor: ParcelActor, actorId: string | null, session?: ClientSession) {
    const now = deps.now();
    let charged: BalanceChange | null = null;
    await wallet.prepare(p);
    const run = async (s: ClientSession) => {
      const updated = await transitionParcel({
        parcel: p,
        to: 'delivered',
        actor,
        by: actorId,
        now,
        set: { deliveredAt: now, autoConfirmAt: null, 'deliveryCode.cipher': null },
        session: s,
      });
      await UserModel.updateOne({ _id: p.sender }, { $inc: { 'stats.parcelsSent': 1 } }, { session: s });
      await UserModel.updateOne({ _id: p.assignedCarrier }, { $inc: { 'stats.parcelsCarried': 1 } }, { session: s });
      charged = await wallet.charge(p, s);
      return updated;
    };
    const updated = session ? await run(session) : await withTransaction(run);
    await changed(p, 'delivered', actorId);
    await wallet.afterMove(charged);
    return updated;
  }

  return {
    complete,

    async start(carrierId: string, id: string) {
      const p = await asCarrier(carrierId, id);
      const updated = await transitionParcel({
        parcel: p,
        to: 'in_transit',
        actor: 'carrier',
        by: carrierId,
        now: deps.now(),
        set: { startedAt: deps.now() },
      });
      await changed(p, 'in_transit', carrierId);
      return updated;
    },

    /** Code correct : livraison terminée sans validation. 5 erreurs : saisie bloquée. */
    async submitCode(carrierId: string, id: string, code: string) {
      const p = await asCarrier(carrierId, id);
      if (p.status !== 'in_transit') throw new AppError(409, 'INVALID_TRANSITION', 'Livraison non démarrée');
      if (p.deliveryCode?.lockedAt) throw new AppError(409, 'DELIVERY_CODE_LOCKED', 'Saisie bloquée');
      const expected = p.deliveryCode?.cipher ? readDeliveryCode(deps.config.deliveryCodeKey, p.deliveryCode.cipher) : null;
      if (!expected || !safeEqual(expected, code)) {
        const attempts = (p.deliveryCode?.attempts ?? 0) + 1;
        const locked = attempts >= DELIVERY_CODE_MAX_ATTEMPTS;
        await ParcelModel.updateOne(
          { _id: p._id },
          { $set: { 'deliveryCode.attempts': attempts, ...(locked ? { 'deliveryCode.lockedAt': deps.now() } : {}) } },
        );
        throw new AppError(locked ? 409 : 400, locked ? 'DELIVERY_CODE_LOCKED' : 'INVALID_CODE', 'Code incorrect', {
          attemptsLeft: Math.max(0, DELIVERY_CODE_MAX_ATTEMPTS - attempts),
        });
      }
      return complete(p, 'carrier', carrierId);
    },

    /** Sans code : validation automatique programmée (autoConfirmHours, 72 h par défaut). */
    async declare(carrierId: string, id: string, input: { photo?: FileRef | null; note?: string }) {
      const p = await asCarrier(carrierId, id);
      if (input.photo && !isOwnedUpload(input.photo.publicId, 'delivery_proof', carrierId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Photo invalide');
      }
      const now = deps.now();
      const { autoConfirmHours } = await deps.settings.getAll();
      const updated = await transitionParcel({
        parcel: p,
        to: 'delivered_pending',
        actor: 'carrier',
        by: carrierId,
        now,
        set: {
          declaredDeliveredAt: now,
          autoConfirmAt: new Date(now.getTime() + autoConfirmHours * HOUR),
          deliveryProof: { photo: input.photo ?? null, note: input.note ?? null },
        },
      });
      await changed(p, 'delivered_pending', carrierId);
      return updated;
    },

    async confirm(senderId: string, id: string) {
      const p = await asSender(senderId, id);
      return complete(p, 'sender', senderId);
    },

    async deliveryCode(senderId: string, id: string) {
      const p = await asSender(senderId, id);
      if (!['assigned', 'in_transit'].includes(p.status) || !p.deliveryCode?.cipher) {
        throw new AppError(409, 'INVALID_TRANSITION', 'Aucun code de remise actif');
      }
      return { code: readDeliveryCode(deps.config.deliveryCodeKey, p.deliveryCode.cipher) };
    },

    /**
     * Désistement du transporteur retenu (assigned seulement). Les offres refusées à cause de
     * l'acceptation repassent en pending si leurs auteurs restent éligibles ; sinon le colis redevient open.
     */
    async withdraw(carrierId: string, id: string) {
      const p = await asCarrier(carrierId, id);
      const now = deps.now();
      const { requireCarrierVerification } = await deps.settings.getAll();
      const candidates = await OfferModel.find({ parcel: p._id, status: 'rejected', rejectedBecauseAccepted: true }).lean();
      const eligible: string[] = [];
      for (const o of candidates) {
        const carrier = await UserModel.findById(o.carrier, { status: 1, carrierVerification: 1 }).lean();
        const ok =
          carrier?.status === 'active' &&
          (!requireCarrierVerification || carrier.carrierVerification?.status === 'approved') &&
          !(await isBlockedBetween(o.carrier.toString(), p.sender.toString())) &&
          !(await OfferModel.exists({ parcel: p._id, carrier: o.carrier, status: { $in: ACTIVE_OFFER_STATUSES } }));
        if (ok) eligible.push(o._id.toString());
      }
      const to = eligible.length ? 'negotiating' : 'open';
      const reactivatedCarriers = candidates.filter((o) => eligible.includes(o._id.toString())).map((o) => o.carrier.toString());

      const updated = await withTransaction(async (session) => {
        const parcel = await transitionParcel({
          parcel: p,
          to,
          actor: 'carrier',
          by: carrierId,
          now,
          set: {
            assignedCarrier: null,
            acceptedOffer: null,
            finalPrice: null,
            commission: null,
            deliveryCode: { cipher: null, attempts: 0, lockedAt: null },
          },
          session,
        });
        await OfferModel.updateOne(
          { _id: p.acceptedOffer, status: 'accepted' },
          { status: 'withdrawn', withdrawnAfterAcceptAt: now },
          { session },
        );
        await OfferModel.updateMany(
          { _id: { $in: eligible } },
          { status: 'pending', rejectedBecauseAccepted: false },
          { session },
        );
        await UserModel.updateOne({ _id: carrierId }, { $inc: { 'stats.withdrawals': 1 } }, { session });
        return parcel;
      });

      await changed(p, to, carrierId, reactivatedCarriers);
      const recent = await OfferModel.countDocuments({
        carrier: carrierId,
        withdrawnAfterAcceptAt: { $gte: new Date(now.getTime() - WITHDRAWAL_WINDOW_MS) },
      });
      if (recent >= WITHDRAWAL_ALERT_THRESHOLD) {
        await deps.bus.emit('carrier.withdrawals_threshold', { carrierId, count: recent });
      }
      return updated;
    },
  };
}

export type DeliveryService = ReturnType<typeof createDeliveryService>;
