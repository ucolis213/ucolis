// Publication d'un colis (F6), en deux modes :
// - rapide (par défaut) : trajet, titre, description, prix, photos facultatives ;
// - complète : assistant en 4 étapes (photos facultatives aussi), chaque étape a son schéma, l'API valide
//   l'ensemble.
// suggestedPrice, distanceKm et volumeM3 ne sont jamais acceptés du client : l'API les recalcule.

import { z } from 'zod';
import { PARCEL_CATEGORIES, PAYMENT_ARRANGEMENTS, TIME_SLOTS, VEHICLE_TYPES, type TimeSlot } from '../enums';
import { isCommuneInWilaya } from '../geo';
import {
  fileRefSchema,
  latLngSchema,
  paginationSchema,
  phoneDzSchema,
  searchTextSchema,
  wilayaCodeSchema,
} from './common';

/** Durée de vie d'une annonce sans date souhaitée. */
export const PUBLISH_WINDOW_DAYS = 60;
/** Date souhaitée : n'importe quel jour jusqu'à un an. */
export const DESIRED_DATE_MAX_DAYS = 365;
export const MIN_PRICE_DA = 100;

const DAY_MS = 86_400_000;

export function isWithinPublishWindow(date: Date, now = new Date()): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return d >= today && d <= today + DESIRED_DATE_MAX_DAYS * DAY_MS;
}

/** Heure « HH:mm » sur 24 h. */
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.time');

/** Créneau d'une heure précise : avant midi, avant 18 h, puis soir. */
export function timeSlotOf(time: string): Exclude<TimeSlot, 'any'> {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

export const addressSchema = z
  .object({
    address: z.string().trim().min(1, 'validation.required').max(200),
    details: z.string().trim().max(200).optional(),
    wilayaCode: wilayaCodeSchema,
    commune: z.string().min(1, 'validation.required'),
    location: latLngSchema,
  })
  .refine((a) => isCommuneInWilaya(a.commune, a.wilayaCode), {
    message: 'validation.commune',
    path: ['commune'],
  });

export const parcelRouteSchema = z.object({ pickup: addressSchema, dropoff: addressSchema });

export const parcelDetailsSchema = z.object({
  title: z.string().trim().min(5, 'validation.titleLength').max(80, 'validation.titleLength'),
  category: z.enum(PARCEL_CATEGORIES),
  description: z.string().trim().max(1000).default(''),
  weightKg: z.number().min(0.1, 'validation.weight').max(30_000, 'validation.weight'),
  dimensionsCm: z.object({
    length: z.number().min(1, 'validation.dimension').max(1500, 'validation.dimension'),
    width: z.number().min(1, 'validation.dimension').max(1500, 'validation.dimension'),
    height: z.number().min(1, 'validation.dimension').max(1500, 'validation.dimension'),
  }),
  fragile: z.boolean().default(false),
  prohibitedItemsDeclared: z.literal(true, 'validation.prohibitedDeclaration'),
});

export const recipientSchema = z.object({
  name: z.string().trim().min(2, 'validation.nameLength').max(100),
  phone: phoneDzSchema,
});

export const parcelOptionsSchema = z.object({
  vehicleTypes: z.array(z.enum(VEHICLE_TYPES)).min(1, 'validation.vehicleTypes'),
  desiredDate: z.coerce.date().refine((d) => isWithinPublishWindow(d), 'validation.desiredDate'),
  timeSlot: z.enum(TIME_SLOTS).default('any'),
  /** Heure précise facultative ; quand elle est donnée, le créneau en découle. */
  desiredTime: timeOfDaySchema.nullable().default(null),
  flexibleDates: z.boolean().default(false),
  urgent: z.boolean().default(false),
  recipient: recipientSchema.optional(),
  paymentArrangement: z.enum(PAYMENT_ARRANGEMENTS),
  requestedPrice: z.number().int().min(MIN_PRICE_DA, 'validation.minPrice'),
});

/** Photos facultatives dans les deux modes : 0 à 5, la première sert de couverture. */
export const parcelPhotosSchema = z.object({
  photos: z.array(fileRefSchema).max(5, 'validation.photosCount'),
});

export const PARCEL_PUBLISH_MODES = ['quick', 'full'] as const;
export type ParcelPublishMode = (typeof PARCEL_PUBLISH_MODES)[number];

/** Publication rapide : poids, dimensions, date, véhicules et règlement restent « non précisés ». */
export const quickParcelSchema = parcelRouteSchema.extend({
  mode: z.literal('quick'),
  title: parcelDetailsSchema.shape.title,
  description: parcelDetailsSchema.shape.description,
  requestedPrice: parcelOptionsSchema.shape.requestedPrice,
  prohibitedItemsDeclared: parcelDetailsSchema.shape.prohibitedItemsDeclared,
  photos: parcelPhotosSchema.shape.photos.default([]),
});

export const fullParcelSchema = parcelRouteSchema
  .extend(parcelDetailsSchema.shape)
  .extend(parcelOptionsSchema.shape)
  .extend(parcelPhotosSchema.shape);

/** Sans « mode », le corps est une publication complète (clients antérieurs). */
export const createParcelSchema = z.preprocess(
  (v) => (v && typeof v === 'object' && !('mode' in v) ? { ...v, mode: 'full' } : v),
  z.discriminatedUnion('mode', [quickParcelSchema, fullParcelSchema.extend({ mode: z.literal('full') })]),
);

/** POST /pricing/suggest : la distance est toujours calculée à partir des deux points. */
export const pricingSuggestSchema = z.object({
  pickup: latLngSchema,
  dropoff: latLngSchema,
  weightKg: parcelDetailsSchema.shape.weightKg,
  dimensionsCm: parcelDetailsSchema.shape.dimensionsCm,
});

/** Pré-cochage des types de véhicule selon le poids et le volume (étape Détails). */
export function suggestedVehicleTypes(weightKg: number, volumeM3: number) {
  if (weightKg <= 10 && volumeM3 <= 0.05) return ['moto', 'car', 'station_wagon'] as const;
  if (weightKg <= 100 && volumeM3 <= 0.5)
    return ['car', 'station_wagon', 'utility', 'van'] as const;
  if (weightKg <= 1500 && volumeM3 <= 10) return ['utility', 'van', 'truck'] as const;
  return ['truck', 'cargo', 'semi_trailer'] as const;
}

export type CreateParcelInput = z.infer<typeof createParcelSchema>;
export type QuickParcelInput = z.infer<typeof quickParcelSchema>;
export type FullParcelInput = z.infer<typeof fullParcelSchema>;

export const PARCEL_SORTS = ['recent', 'date', 'price_desc', 'nearest'] as const;
export type ParcelSort = (typeof PARCEL_SORTS)[number];
export const RADIUS_OPTIONS_KM = [10, 25, 50, 100] as const;

const queryBool = z.enum(['true', 'false']).transform((v) => v === 'true');

/** Filtres et tri de GET /parcels (F7). Tous facultatifs. */
export const parcelListQuerySchema = paginationSchema.extend({
  q: searchTextSchema.optional(),
  fromWilaya: wilayaCodeSchema.optional(),
  toWilaya: wilayaCodeSchema.optional(),
  maxWeight: z.coerce.number().positive().optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  urgent: queryBool.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce
    .number()
    .refine((v) => (RADIUS_OPTIONS_KM as readonly number[]).includes(v), 'validation.radius')
    .optional(),
  proOnly: queryBool.optional(),
  verifiedOnly: queryBool.optional(),
  sort: z.enum(PARCEL_SORTS).default('recent'),
});
export type ParcelListQuery = z.infer<typeof parcelListQuerySchema>;

/** Modification possible en open et negotiating ; chaque champ est facultatif. */
export const updateParcelSchema = fullParcelSchema.partial();
export type UpdateParcelInput = z.infer<typeof updateParcelSchema>;

export const cancelParcelSchema = z.object({ reason: z.string().trim().max(500).optional() });
