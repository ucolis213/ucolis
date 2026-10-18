// File des vérifications d'identité (plus ancienne en premier), pièces servies par URL signée de 5 min,
// décision motivée en cas de refus. Les dossiers pro suivent le même schéma (lot 8).

import type { Request } from 'express';
import { CARRIER_DOCUMENT_KINDS, type FileRef } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { signedFileUrl } from '../carrier/service';
import { UserModel, type UserLean } from '../users/model';
import { adminUserRow, canSeePii } from './usersAdmin';
import type { Claims } from './claims';

export function createVerificationsAdmin(deps: Deps, claims: Claims) {
  return {
    async identityQueue() {
      const users = (await UserModel.find({ 'carrierVerification.status': 'pending' })
        .sort({ 'carrierVerification.submittedAt': 1 })
        .limit(200)
        .lean()) as UserLean[];
      const claimMap = await claims.map('identity', users.map((u) => u._id.toString()));
      return {
        items: users.map((u) => ({
          userId: u._id.toString(),
          name: `${u.firstName} ${u.lastName}`,
          wilayaCode: u.wilayaCode,
          submittedAt: u.carrierVerification?.submittedAt ?? null,
          vehicles: (u.vehicles ?? []).length,
          claim: claimMap.get(u._id.toString()) ?? null,
        })),
      };
    },

    async identityDetail(req: Request, userId: string) {
      const u = (await UserModel.findById(userId).lean()) as UserLean | null;
      if (!u) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
      const cv = u.carrierVerification;
      const claim = (await claims.map('identity', [userId])).get(userId) ?? null;
      await audit(req, { action: 'identity.view_documents', targetType: 'user', targetId: userId });
      return {
        user: adminUserRow(u, canSeePii(req.staff!)),
        status: cv?.status ?? 'not_submitted',
        submittedAt: cv?.submittedAt ?? null,
        licenseExpiresAt: cv?.licenseExpiresAt ?? null,
        insuranceExpiresAt: cv?.insuranceExpiresAt ?? null,
        decisionReason: cv?.decisionReason ?? null,
        documents: Object.fromEntries(
          CARRIER_DOCUMENT_KINDS.map((k) => [k, signedFileUrl(deps, cv?.documents?.[k] as FileRef | null)]),
        ),
        vehicles: u.vehicles ?? [],
        claim,
      };
    },

    async claimIdentity(staffId: string, userId: string) {
      return claims.claim('identity', userId, staffId);
    },

    async decideIdentity(req: Request, userId: string, decision: 'approve' | 'reject', reason?: string) {
      const staffId = req.staff!.id;
      await claims.assertFree('identity', userId, staffId);
      const status = decision === 'approve' ? 'approved' : 'rejected';
      const res = await UserModel.updateOne(
        { _id: userId, 'carrierVerification.status': 'pending' },
        {
          $set: {
            'carrierVerification.status': status,
            'carrierVerification.reviewedAt': deps.now(),
            'carrierVerification.reviewedBy': staffId,
            'carrierVerification.decisionReason': decision === 'reject' ? reason : null,
          },
        },
      );
      if (!res.modifiedCount) throw new AppError(409, 'INVALID_TRANSITION', 'Dossier non en attente');
      await claims.release('identity', userId);
      await audit(req, {
        action: `identity.${decision}`,
        targetType: 'user',
        targetId: userId,
        reason: reason ?? null,
        before: { status: 'pending' },
        after: { status },
      });
      await deps.bus.emit('carrier.verification_decided', { userId, approved: decision === 'approve', reason: reason ?? null });
    },
  };
}

export type VerificationsAdmin = ReturnType<typeof createVerificationsAdmin>;
