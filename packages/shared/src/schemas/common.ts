// Briques de validation communes. Les messages sont des clés de l'espace « errors » (errors:validation.*).

import { z } from 'zod';
import { FILE_KINDS } from '../enums';
import { isCommuneInWilaya, isValidWilaya } from '../geo';
import { normalizePhoneDz } from '../format';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'validation.objectId');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'validation.nameLength')
  .max(50, 'validation.nameLength');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('validation.email').max(254, 'validation.email'));

/** Téléphone algérien, normalisé en E.164 (+2135…, +2136…, +2137…). */
export const phoneDzSchema = z.string().transform((value, ctx) => {
  const e164 = normalizePhoneDz(value);
  if (!e164) {
    ctx.addIssue({ code: 'custom', message: 'validation.phone' });
    return z.NEVER;
  }
  return e164;
});

export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordRules')
  .max(128, 'validation.passwordRules')
  .regex(/[A-Za-z]/, 'validation.passwordRules')
  .regex(/\d/, 'validation.passwordRules');

/** Longueurs des codes à saisir : les interfaces affichent une case par chiffre. */
export const OTP_LENGTH = 6;
export const TOTP_LENGTH = 6;
export const DELIVERY_CODE_LENGTH = 4;

/** Code de `length` chiffres exactement. */
export const digitsCode = (length: number, message: string) => z.string().regex(new RegExp(`^\\d{${length}}$`), message);

export const otpCodeSchema = digitsCode(OTP_LENGTH, 'validation.otp');

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const wilayaCodeSchema = z.string().refine(isValidWilaya, 'validation.wilaya');

/** Paire wilaya/commune cohérente avec shared/geo. */
export const placeSchema = z
  .object({ wilayaCode: wilayaCodeSchema, commune: z.string().min(1, 'validation.required') })
  .refine((p) => isCommuneInWilaya(p.commune, p.wilayaCode), {
    message: 'validation.commune',
    path: ['commune'],
  });

export const fileRefSchema = z.object({
  url: z.url(),
  publicId: z.string().min(1),
  kind: z.enum(FILE_KINDS),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchTextSchema = z.string().trim().max(100, 'validation.searchTooLong');

export type LatLngInput = z.infer<typeof latLngSchema>;
export type FileRef = z.infer<typeof fileRefSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
