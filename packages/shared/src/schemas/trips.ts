// Trajets des transporteurs (F9), alertes (F10).

import { z } from 'zod';
import { TRIP_STATUSES, VEHICLE_TYPES, type VehicleType } from '../enums';
import { latLngSchema, objectIdSchema, paginationSchema, placeSchema, wilayaCodeSchema } from './common';

export const MAX_TRIP_STOPS = 5;
export const MAX_RECURRENCE_WEEKS = 8;
export const MAX_SAVED_SEARCHES = 10;
/** Tolérance sur la date souhaitée du colis par rapport au départ du trajet. */
export const TRIP_DATE_TOLERANCE_DAYS = 2;

const endpoint = placeSchema.and(z.object({ location: latLngSchema }));

export const tripInputSchema = z
  .object({
    from: endpoint,
    to: endpoint,
    stops: z.array(wilayaCodeSchema).max(MAX_TRIP_STOPS).default([]),
    departureAt: z.coerce.date().refine((d) => d.getTime() > Date.now() - 3600_000, 'validation.departure'),
    vehicleId: objectIdSchema,
    capacityKg: z.number().positive().max(50_000),
    capacityM3: z.number().positive().max(200),
    priceHint: z
      .object({ mode: z.enum(['flat', 'per_kg']), amount: z.number().int().min(1) })
      .nullable()
      .optional(),
    recurrence: z
      .object({
        weekdays: z.array(z.number().int().min(0).max(6)).min(1),
        until: z.coerce.date(),
      })
      .nullable()
      .optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((t) => !t.recurrence || t.recurrence.until.getTime() - t.departureAt.getTime() <= MAX_RECURRENCE_WEEKS * 7 * 86_400_000, {
    message: 'validation.recurrence',
    path: ['recurrence', 'until'],
  });
export type TripInput = z.infer<typeof tripInputSchema>;

export const tripStatusSchema = z.object({ status: z.enum(['active', 'full', 'cancelled']) });

export const tripListQuerySchema = paginationSchema.extend({
  fromWilaya: wilayaCodeSchema.optional(),
  toWilaya: wilayaCodeSchema.optional(),
  date: z.coerce.date().optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
});
export type TripListQuery = z.infer<typeof tripListQuerySchema>;

export const tripRequestSchema = z.object({ parcelId: objectIdSchema });

export const savedSearchSchema = z.object({
  name: z.string().trim().min(1).max(60),
  scope: z.enum(['parcels', 'trips']),
  filters: z.record(z.string(), z.unknown()).default({}),
  notify: z.boolean().default(true),
});
export const savedSearchUpdateSchema = savedSearchSchema.partial();

export const TRIP_STATUS_VALUES = TRIP_STATUSES;

/** Itinéraire ordonné d'un trajet : départ, étapes, arrivée. */
export const tripRoute = (t: { from: { wilayaCode: string }; to: { wilayaCode: string }; stops?: readonly string[] }) => [
  t.from.wilayaCode,
  ...(t.stops ?? []),
  t.to.wilayaCode,
];

/**
 * Compatibilité colis / trajet (F9) : wilayas de départ et d'arrivée dans l'ordre sur l'itinéraire,
 * poids dans la capacité, véhicule accepté, date souhaitée à ±2 jours du départ.
 */
export function isParcelCompatibleWithTrip(
  parcel: {
    pickup: { wilayaCode: string };
    dropoff: { wilayaCode: string };
    weightKg: number;
    volumeM3: number;
    desiredDate: Date;
    vehicleTypes: readonly VehicleType[];
  },
  trip: {
    from: { wilayaCode: string };
    to: { wilayaCode: string };
    stops?: readonly string[];
    capacityKg: number;
    capacityM3: number;
    departureAt: Date;
    vehicle: { type: VehicleType };
  },
): boolean {
  const route = tripRoute(trip);
  const from = route.indexOf(parcel.pickup.wilayaCode);
  const to = route.lastIndexOf(parcel.dropoff.wilayaCode);
  if (from < 0 || to < 0 || from >= to) return false;
  if (parcel.weightKg > trip.capacityKg || parcel.volumeM3 > trip.capacityM3) return false;
  if (!parcel.vehicleTypes.includes(trip.vehicle.type)) return false;
  const days = Math.abs(parcel.desiredDate.getTime() - trip.departureAt.getTime()) / 86_400_000;
  return days <= TRIP_DATE_TOLERANCE_DAYS;
}
