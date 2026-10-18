// « Prendre le dossier » : réservation de 30 min pour qu'un seul membre du staff le traite.

import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { ClaimModel, StaffModel } from './model';

export const CLAIM_MINUTES = 30;
export type ClaimKind = 'identity' | 'pro' | 'dispute' | 'report';

export function createClaims(deps: Deps) {
  return {
    async claim(kind: ClaimKind, targetId: string, staffId: string) {
      const now = deps.now();
      const until = new Date(now.getTime() + CLAIM_MINUTES * 60_000);
      const existing = await ClaimModel.findOne({ kind, targetId }).lean();
      if (existing && existing.until > now && existing.by.toString() !== staffId) {
        const by = await StaffModel.findById(existing.by, { firstName: 1, lastName: 1 }).lean();
        throw new AppError(409, 'INVALID_TRANSITION', 'Dossier déjà pris en charge', {
          by: by ? `${by.firstName} ${by.lastName}` : null,
          until: existing.until,
        });
      }
      await ClaimModel.updateOne({ kind, targetId }, { $set: { by: staffId, until } }, { upsert: true });
      return { by: staffId, until };
    },

    /** Bloque l'action si le dossier est réservé par quelqu'un d'autre. */
    async assertFree(kind: ClaimKind, targetId: string, staffId: string) {
      const c = await ClaimModel.findOne({ kind, targetId }).lean();
      if (c && c.until > deps.now() && c.by.toString() !== staffId) {
        throw new AppError(409, 'INVALID_TRANSITION', 'Dossier pris en charge par un autre membre du staff');
      }
    },

    async release(kind: ClaimKind, targetId: string) {
      await ClaimModel.deleteOne({ kind, targetId });
    },

    async map(kind: ClaimKind, targetIds: string[]) {
      const claims = await ClaimModel.find({ kind, targetId: { $in: targetIds }, until: { $gt: deps.now() } }).lean();
      const staff = await StaffModel.find({ _id: { $in: claims.map((c) => c.by) } }, { firstName: 1, lastName: 1 }).lean();
      const names = new Map(staff.map((s) => [s._id.toString(), `${s.firstName} ${s.lastName}`]));
      return new Map(claims.map((c) => [c.targetId, { by: c.by.toString(), name: names.get(c.by.toString()) ?? '', until: c.until }]));
    },
  };
}

export type Claims = ReturnType<typeof createClaims>;
