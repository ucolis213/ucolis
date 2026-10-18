// Seul point d'écriture du statut d'un colis : la table de shared/stateMachines.ts fait foi,
// et la mise à jour est conditionnelle au statut lu (deux transitions concurrentes : une seule passe).

import type { ClientSession, Types } from 'mongoose';
import { canTransitionParcel, type ParcelActor, type ParcelStatus } from '@ucolis/shared';
import { AppError } from '../../lib/errors';
import { ParcelModel, type ParcelLean } from './model';

export interface TransitionOptions {
  parcel: Pick<ParcelLean, '_id' | 'status'>;
  to: ParcelStatus;
  actor: ParcelActor;
  by?: Types.ObjectId | string | null;
  reason?: string | null;
  now: Date;
  set?: Record<string, unknown>;
  inc?: Record<string, number>;
  /** Conditions supplémentaires sur le document (ex. assignedCarrier: null). */
  where?: Record<string, unknown>;
  session?: ClientSession;
  /** Forçage staff : la table est ignorée (vérifiée par l'appelant). */
  force?: boolean;
}

const BY_TYPE: Record<ParcelActor, 'user' | 'staff' | 'system'> = {
  sender: 'user',
  carrier: 'user',
  staff: 'staff',
  system: 'system',
  job: 'system',
};

export function invalidTransition(from: string, to: string) {
  return new AppError(409, 'INVALID_TRANSITION', `Transition ${from} → ${to} refusée`, { from, to });
}

export async function transitionParcel(opts: TransitionOptions): Promise<ParcelLean> {
  const from = opts.parcel.status as ParcelStatus;
  if (!opts.force && !canTransitionParcel(from, opts.to, opts.actor)) {
    throw invalidTransition(from, opts.to);
  }
  const updated = await ParcelModel.findOneAndUpdate(
    { _id: opts.parcel._id, status: from, ...opts.where },
    {
      $set: { status: opts.to, ...opts.set },
      ...(opts.inc ? { $inc: opts.inc } : {}),
      $push: {
        statusHistory: {
          from,
          to: opts.to,
          byType: BY_TYPE[opts.actor],
          by: opts.by ?? null,
          at: opts.now,
          reason: opts.reason ?? null,
        },
      },
    },
    { new: true, session: opts.session },
  ).lean();
  if (!updated) throw invalidTransition(from, opts.to);
  return updated as ParcelLean;
}
