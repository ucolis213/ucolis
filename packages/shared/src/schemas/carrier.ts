import { z } from 'zod';
import { VEHICLE_TYPES } from '../enums';
import { fileRefSchema } from './common';

export const MAX_VEHICLES = 5;

export const vehicleInputSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  brand: z.string().trim().min(1, 'validation.required').max(50),
  model: z.string().trim().min(1, 'validation.required').max(50),
  plate: z.string().trim().min(4, 'validation.plate').max(20, 'validation.plate'),
  capacityKg: z.number().positive('validation.positive').max(50_000),
  volumeM3: z.number().positive('validation.positive').max(200),
  photo: fileRefSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
});
export const vehicleUpdateSchema = vehicleInputSchema.partial();
export type VehicleInput = z.infer<typeof vehicleInputSchema>;

/** Les 4 pièces (carte d'identité en 2 faces) et les dates d'expiration du permis et de l'assurance. */
export const carrierVerificationSchema = z.object({
  documents: z.object({
    idFront: fileRefSchema,
    idBack: fileRefSchema,
    driverLicense: fileRefSchema,
    vehicleRegistration: fileRefSchema,
    insurance: fileRefSchema,
  }),
  licenseExpiresAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'validation.expiredDocument'),
  insuranceExpiresAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'validation.expiredDocument'),
});
export type CarrierVerificationInput = z.infer<typeof carrierVerificationSchema>;

export const CARRIER_DOCUMENT_KINDS = [
  'idFront',
  'idBack',
  'driverLicense',
  'vehicleRegistration',
  'insurance',
] as const;
export type CarrierDocumentKind = (typeof CARRIER_DOCUMENT_KINDS)[number];

export const OFFER_SORTS = ['price', 'rating', 'recent'] as const;
export const MY_OFFER_TABS = ['active', 'accepted', 'finished'] as const;
export type MyOfferTab = (typeof MY_OFFER_TABS)[number];
