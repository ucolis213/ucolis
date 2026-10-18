import { z } from 'zod';
import { INTENTS, LOCALES, PLATFORMS, UPLOAD_PURPOSES } from '../enums';
import { NOTIFICATION_CATEGORIES } from '../notifications';
import {
  emailSchema,
  fileRefSchema,
  nameSchema,
  otpCodeSchema,
  passwordSchema,
  phoneDzSchema,
  placeSchema,
} from './common';

export const updateMeSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    phone: phoneDzSchema,
    place: placeSchema,
    bio: z.string().trim().max(500),
    intent: z.enum(INTENTS),
  })
  .partial();

export const avatarSchema = z.object({ avatar: fileRefSchema.nullable() });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.required'),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirm'],
  });

export const emailChangeSchema = z.object({ email: emailSchema });
export const emailChangeConfirmSchema = z.object({ code: otpCodeSchema });

export const preferencesSchema = z.object({
  language: z.enum(LOCALES).optional(),
  notifications: z.partialRecord(z.enum(NOTIFICATION_CATEGORIES), z.boolean()).optional(),
});

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(300),
  platform: z.enum(PLATFORMS),
  deviceId: z.string().min(8).max(100),
  appVersion: z.string().max(30).optional(),
});

export const deletionRequestSchema = z.object({ password: z.string().min(1, 'validation.required') });

export const acceptTermsSchema = z.object({ version: z.string().min(1) });

export const uploadSignatureSchema = z.object({ purpose: z.enum(UPLOAD_PURPOSES) });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
