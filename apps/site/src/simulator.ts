// Estimation du simulateur : même barème que l'application (shared/pricing), entre les centres des wilayas.

import { DEFAULT_PRICING, chargeableWeightKg, getWilaya, haversineKm, suggestPrice, volumeM3FromCm } from '@ucolis/shared';

/** Tailles types proposées au visiteur, avec poids réel et dimensions en cm. */
export const SIZE_PRESETS = {
  envelope: { weightKg: 0.5, cm: [30, 22, 2] },
  small: { weightKg: 3, cm: [30, 20, 15] },
  medium: { weightKg: 10, cm: [50, 40, 30] },
  large: { weightKg: 25, cm: [80, 60, 50] },
  appliance: { weightKg: 60, cm: [70, 70, 180] },
} as const;
export type SizePreset = keyof typeof SIZE_PRESETS;

/** Trajet dans la même wilaya : distance type d'une course en ville. */
export const SAME_WILAYA_KM = 8;

export interface Estimate {
  distanceKm: number;
  chargeableKg: number;
  price: number;
}

export function estimate(fromCode: string, toCode: string, size: SizePreset, fragile: boolean): Estimate {
  const from = getWilaya(fromCode);
  const to = getWilaya(toCode);
  const distanceKm = !from || !to || fromCode === toCode ? SAME_WILAYA_KM : Math.round(haversineKm(from.center, to.center));
  const { weightKg, cm } = SIZE_PRESETS[size];
  const volumeM3 = volumeM3FromCm(cm[0], cm[1], cm[2]);
  return {
    distanceKm,
    chargeableKg: chargeableWeightKg(weightKg, volumeM3, DEFAULT_PRICING.volumetricFactor),
    price: suggestPrice({ distanceKm, weightKg, volumeM3, fragile }),
  };
}
