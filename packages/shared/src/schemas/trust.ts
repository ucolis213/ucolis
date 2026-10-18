// Avis (F15), signalements et litiges (F16).

import { z } from 'zod';
import { DISPUTE_REASONS, REPORT_REASONS, REPORT_TARGET_TYPES } from '../enums';
import { fileRefSchema, objectIdSchema } from './common';

export const CARRIER_CRITERIA = ['punctuality', 'care', 'communication'] as const;
export const SENDER_CRITERIA = ['accuracy', 'availability', 'communication'] as const;

const note = z.number().int().min(1).max(5);

export const createReviewSchema = z.object({
  rating: note,
  criteria: z.partialRecord(z.enum([...CARRIER_CRITERIA, ...SENDER_CRITERIA]), note).default({}),
  comment: z.string().trim().max(500).optional(),
});
export const reviewReplySchema = z.object({ text: z.string().trim().min(1).max(300) });

export const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: objectIdSchema,
  reason: z.enum(REPORT_REASONS),
  description: z.string().trim().max(1000).optional(),
});

export const createDisputeSchema = z.object({
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().trim().min(10, 'validation.disputeDescription').max(2000),
  photos: z.array(fileRefSchema).max(5).default([]),
});
export const disputeResponseSchema = z.object({
  text: z.string().trim().min(3).max(2000),
  photos: z.array(fileRefSchema).max(5).default([]),
});

export const disputeDecisionSchema = z.object({
  outcome: z.enum(['delivered', 'cancelled']),
  note: z.string().trim().min(10, 'validation.decisionNote').max(2000),
});
export const reportHandleSchema = z.object({ note: z.string().trim().min(3).max(1000) });

/** Délai donné à l'autre partie pour répondre à un litige. */
export const DISPUTE_RESPONSE_HOURS = 48;
/** Masquage automatique d'une annonce ou d'un trajet signalé par 3 utilisateurs distincts. */
export const AUTO_HIDE_REPORTS = 3;
