// Suppression de compte (anonymisation) : colis actifs annulés, offres retirées, données personnelles
// effacées, avis conservés sous forme anonyme, pièces d'identité et justificatifs supprimés de Cloudinary.

import { ACTIVE_OFFER_STATUSES, ONGOING_DELIVERY_STATUSES, type FileRef } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { randomToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { RefreshTokenModel } from '../auth/model';
import { OfferModel } from '../offers/model';
import { ParcelModel } from '../parcels/model';
import { PushTokenModel } from '../push/model';
import { UserModel, type UserLean } from './model';

export async function hasOngoingDelivery(userId: string) {
  return !!(await ParcelModel.exists({
    $or: [{ sender: userId }, { assignedCarrier: userId }],
    status: { $in: ONGOING_DELIVERY_STATUSES },
  }));
}

export async function anonymizeUser(deps: Deps, userId: string) {
  const user = (await UserModel.findById(userId).lean()) as UserLean | null;
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
  if (user.status === 'deleted') return;
  if (await hasOngoingDelivery(userId)) {
    throw new AppError(409, 'DELIVERY_IN_PROGRESS', 'Une livraison est en cours');
  }
  const now = deps.now();
  const active = await ParcelModel.find({ sender: userId, status: { $in: ['open', 'negotiating'] } }).lean();
  for (const p of active) {
    await ParcelModel.updateOne(
      { _id: p._id },
      {
        $set: { status: 'cancelled', cancellation: { by: user._id, reason: 'account_deleted', at: now } },
        $push: { statusHistory: { from: p.status, to: 'cancelled', byType: 'system', at: now, reason: 'account_deleted' } },
      },
    );
    await OfferModel.updateMany({ parcel: p._id, status: { $in: ACTIVE_OFFER_STATUSES } }, { status: 'cancelled' });
  }
  await OfferModel.updateMany({ carrier: userId, status: { $in: ACTIVE_OFFER_STATUSES } }, { status: 'withdrawn' });

  const secureFiles = [
    ...Object.values(user.carrierVerification?.documents ?? {}),
    ...(user.pro?.documents ?? []).map((d) => d.file),
  ].filter((f): f is FileRef => !!f && typeof f === 'object' && 'publicId' in f);
  if (secureFiles.length) await deps.files.destroy(secureFiles, 'authenticated');

  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        firstName: 'Utilisateur',
        lastName: 'supprimé',
        email: `deleted-${userId}@ucolis.invalid`,
        phone: `deleted-${userId}`,
        passwordHash: randomToken(),
        bio: '',
        avatar: null,
        vehicles: [],
        blockedUsers: [],
        status: 'deleted',
        'pro.companyName': null,
        'pro.rcNumber': null,
        'pro.nif': null,
        'pro.nis': null,
        'pro.address': null,
        'pro.logo': null,
        'pro.documents': [],
        'carrierVerification.documents': {},
        deletionRequestedAt: null,
      },
    },
  );
  await RefreshTokenModel.updateMany({ user: userId, revokedAt: null }, { revokedAt: now });
  await PushTokenModel.deleteMany({ user: userId });
  await deps.bus.emit('user.sessions_revoked', { userId, reason: 'remote_logout' });
}
