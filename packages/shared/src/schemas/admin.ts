// Schémas du back-office. Toute action d'écriture du staff exige un motif (journal d'audit).

import { z } from 'zod';
import { INTENTS, PARCEL_STATUSES, USER_STATUSES } from '../enums';
import { PERMISSIONS, PERMISSION_TEMPLATES } from '../permissions';
import { emailSchema, nameSchema, paginationSchema, passwordSchema, searchTextSchema, wilayaCodeSchema } from './common';

export const reasonSchema = z.string().trim().min(3, 'validation.reasonRequired').max(1000);

export const staffLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation.required'),
  totp: z.string().regex(/^\d{6}$/, 'validation.totp').optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
  totp: z.string().regex(/^\d{6}$/, 'validation.totp'),
});

export const inviteStaffSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  template: z.enum(Object.keys(PERMISSION_TEMPLATES) as [keyof typeof PERMISSION_TEMPLATES]).optional(),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});

export const updateStaffSchema = z.object({ permissions: z.array(z.enum(PERMISSIONS)), reason: reasonSchema });
export const reasonOnlySchema = z.object({ reason: reasonSchema });

export const transferSuperAdminSchema = z.object({
  toStaffId: z.string().regex(/^[a-f\d]{24}$/i),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/, 'validation.totp'),
  reason: reasonSchema,
});

export const suspendUserSchema = z.object({ reason: reasonSchema, until: z.coerce.date().nullable().optional() });

export const verificationDecisionSchema = z
  .object({ decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(1000).optional() })
  .refine((v) => v.decision === 'approve' || (v.reason?.length ?? 0) >= 3, {
    message: 'validation.reasonRequired',
    path: ['reason'],
  });

export const forceStatusSchema = z.object({ status: z.enum(PARCEL_STATUSES), reason: reasonSchema });
export const hideSchema = z.object({ hidden: z.boolean(), reason: reasonSchema });

const queryBool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const adminUsersQuerySchema = paginationSchema.extend({
  q: searchTextSchema.optional(),
  status: z.enum(USER_STATUSES).optional(),
  intent: z.enum(INTENTS).optional(),
  accountType: z.enum(['individual', 'professional']).optional(),
  wilayaCode: wilayaCodeSchema.optional(),
  verified: queryBool.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const adminParcelsQuerySchema = paginationSchema.extend({
  q: searchTextSchema.optional(),
  status: z.enum(PARCEL_STATUSES).optional(),
  wilayaCode: wilayaCodeSchema.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const auditQuerySchema = paginationSchema.extend({
  actor: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  action: z.string().max(60).optional(),
  targetType: z.string().max(30).optional(),
  targetId: z.string().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
