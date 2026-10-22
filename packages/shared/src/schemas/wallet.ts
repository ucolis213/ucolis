// Portefeuille du transporteur : demande de recharge (preuve de virement) et actions du staff.

import { z } from 'zod';
import { TOPUP_METHODS, TOPUP_STATUSES } from '../commission';
import { reasonSchema } from './admin';
import { fileRefSchema, paginationSchema, searchTextSchema } from './common';

/** Les bornes du montant viennent du réglage commission.topUp, vérifiées par l'API. */
export const topUpRequestSchema = z.object({
  amount: z.number().int('validation.topUpAmount').positive('validation.topUpAmount'),
  method: z.enum(TOPUP_METHODS),
  reference: z.string().trim().max(60).optional(),
  proof: fileRefSchema,
});

export const topUpDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    /** Montant réellement reçu ; par défaut celui de la demande. */
    amount: z.number().int().positive().optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.decision === 'approve' || (v.reason?.length ?? 0) >= 3, {
    message: 'validation.reasonRequired',
    path: ['reason'],
  });

export const walletAdjustmentSchema = z.object({
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, 'validation.adjustmentAmount'),
  reason: reasonSchema,
});

export const adminTopUpsQuerySchema = paginationSchema.extend({ status: z.enum(TOPUP_STATUSES).default('pending') });
export const adminWalletsQuerySchema = paginationSchema.extend({
  q: searchTextSchema.optional(),
  blocked: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type TopUpRequestInput = z.infer<typeof topUpRequestSchema>;
export type TopUpDecisionInput = z.infer<typeof topUpDecisionSchema>;
export type WalletAdjustmentInput = z.infer<typeof walletAdjustmentSchema>;
