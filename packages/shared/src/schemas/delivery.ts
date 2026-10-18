import { z } from 'zod';
import { fileRefSchema } from './common';

export const deliveryCodeSchema = z.object({ code: z.string().regex(/^\d{4}$/, 'validation.deliveryCode') });

export const declareDeliverySchema = z.object({
  photo: fileRefSchema.nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

export const trackingPositionSchema = z.object({
  parcelId: z.string().regex(/^[a-f\d]{24}$/i),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).nullable().optional(),
  heading: z.number().min(-1).max(360).nullable().optional(),
  speed: z.number().min(-1).max(200).nullable().optional(),
  at: z.coerce.date(),
});
export type TrackingPosition = z.infer<typeof trackingPositionSchema>;

/** Au plus une position toutes les 5 s ; au-delà de 5 min sans position, l'écran le signale. */
export const TRACKING_MIN_INTERVAL_MS = 5_000;
export const TRACKING_STALE_AFTER_MS = 5 * 60_000;
