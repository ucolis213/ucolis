// Dossier professionnel (F4). Le statut pro ne se déclare pas : il se demande et seul le staff le valide.

import { z } from 'zod';
import { LEGAL_FORMS } from '../enums';
import { fileRefSchema, placeSchema } from './common';

export const proApplicationSchema = z.object({
  companyName: z.string().trim().min(2, 'validation.companyName').max(100, 'validation.companyName'),
  legalForm: z.enum(LEGAL_FORMS),
  rcNumber: z.string().trim().min(3, 'validation.required').max(40),
  rcDocument: fileRefSchema,
  nif: z.string().regex(/^\d{15}$/, 'validation.nif'),
  nifDocument: fileRefSchema,
  nis: z.string().trim().max(30).optional(),
  address: z.string().trim().min(3, 'validation.required').max(200),
  place: placeSchema,
  logo: fileRefSchema.nullable().optional(),
});
export type ProApplicationInput = z.infer<typeof proApplicationSchema>;

/** Liste de contrôle affichée au staff à côté des pièces. */
export const PRO_CHECKLIST = ['readable', 'nameMatches', 'nifFormat', 'valid'] as const;
