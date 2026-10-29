// Même fonction que le mobile : distance recalculée à partir des points, barème lu dans les réglages.

import {
  haversineKm,
  suggestPrice,
  volumeM3FromCm,
  type LatLng,
  type PricingSettings,
} from '@ucolis/shared';

export interface PriceQuoteInput {
  pickup: LatLng;
  dropoff: LatLng;
  weightKg: number;
  dimensionsCm: { length: number; width: number; height: number };
  fragile?: boolean;
}

export function quotePrice(input: PriceQuoteInput, pricing: PricingSettings) {
  const distanceKm = haversineKm(input.pickup, input.dropoff);
  const { length, width, height } = input.dimensionsCm;
  const volumeM3 = volumeM3FromCm(length, width, height);
  const suggestedPrice = suggestPrice({ distanceKm, weightKg: input.weightKg, volumeM3, fragile: !!input.fragile }, pricing);
  return { distanceKm, volumeM3, suggestedPrice };
}
