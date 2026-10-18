import { z } from 'zod';
import { INTENTS, PLATFORMS } from '../enums';
import {
  emailSchema,
  fileRefSchema,
  nameSchema,
  otpCodeSchema,
  passwordSchema,
  phoneDzSchema,
  placeSchema,
} from './common';

const passwordsMatch = (v: { password: string; passwordConfirm: string }) =>
  v.password === v.passwordConfirm;
const passwordMismatch = { message: 'validation.passwordMismatch', path: ['passwordConfirm'] };

const accountFields = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneDzSchema,
  password: passwordSchema,
  passwordConfirm: z.string(),
});

/** Inscription, écran 1. */
export const registerAccountSchema = accountFields.refine(passwordsMatch, passwordMismatch);

/** Inscription, écran 2. Aucun choix particulier ou professionnel ici. */
export const registerProfileSchema = z.object({
  place: placeSchema,
  intent: z.enum(INTENTS),
  avatar: fileRefSchema.optional(),
  acceptTerms: z.literal(true, 'validation.acceptTerms'),
  termsVersion: z.string().min(1),
});

export const deviceSchema = z.object({
  deviceId: z.string().min(8).max(100),
  deviceName: z.string().max(100).optional(),
  platform: z.enum(PLATFORMS),
});

/** Corps de POST /auth/register : les deux écrans plus l'appareil (session ouverte dès l'inscription). */
export const registerRequestSchema = accountFields
  .extend(registerProfileSchema.shape)
  .extend(deviceSchema.shape)
  .refine(passwordsMatch, passwordMismatch);

export const registerSchema = accountFields
  .extend(registerProfileSchema.shape)
  .refine(passwordsMatch, passwordMismatch);


export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1, 'validation.required') })
  .extend(deviceSchema.shape);

export const verifyEmailSchema = z.object({ email: emailSchema, code: otpCodeSchema });
export const resendCodeSchema = z.object({ email: emailSchema });
export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine(passwordsMatch, passwordMismatch);

export const refreshSchema = z.object({ refreshToken: z.string().min(1), deviceId: z.string() });
export const logoutSchema = z.object({ deviceId: z.string().min(1) });

export type RegisterAccountInput = z.input<typeof registerAccountSchema>;
export type RegisterProfileInput = z.input<typeof registerProfileSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
