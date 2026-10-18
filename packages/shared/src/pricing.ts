// Barème unique du prix suggéré (F6). Le mobile l'affiche, l'API le recalcule à l'enregistrement.
// Prix = arrondi au multiple supérieur de 50 de : base + C(d) + perKg × max(P, facteur × V)

export interface PricingTier {
  /** Borne haute de la tranche en km ; null pour la dernière tranche. */
  upToKm: number | null;
  ratePerKm: number;
}

export interface PricingSettings {
  baseFee: number;
  tiers: PricingTier[];
  perKg: number;
  volumetricFactor: number;
  roundTo: number;
  minPrice: number;
}

export const DEFAULT_PRICING: PricingSettings = {
  baseFee: 600,
  tiers: [
    { upToKm: 100, ratePerKm: 8 },
    { upToKm: 300, ratePerKm: 6 },
    { upToKm: 600, ratePerKm: 5 },
    { upToKm: null, ratePerKm: 4 },
  ],
  perKg: 50,
  volumetricFactor: 200,
  roundTo: 50,
  minPrice: 100,
};

export interface PriceInput {
  distanceKm: number;
  weightKg: number;
  volumeM3: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Coût kilométrique par tranches marginales. */
export function distanceCost(distanceKm: number, tiers = DEFAULT_PRICING.tiers): number {
  let cost = 0;
  let from = 0;
  for (const tier of tiers) {
    if (distanceKm <= from) break;
    const to = tier.upToKm === null ? distanceKm : Math.min(distanceKm, tier.upToKm);
    cost += (to - from) * tier.ratePerKm;
    if (tier.upToKm === null) break;
    from = tier.upToKm;
  }
  return round2(cost);
}

/** Poids taxé : le plus grand du poids réel et du poids volumétrique. */
export function chargeableWeightKg(
  weightKg: number,
  volumeM3: number,
  volumetricFactor = DEFAULT_PRICING.volumetricFactor,
): number {
  return round2(Math.max(weightKg, volumetricFactor * volumeM3));
}

export function suggestPrice(
  input: PriceInput,
  settings: PricingSettings = DEFAULT_PRICING,
): number {
  const distance = Math.max(0, input.distanceKm);
  const raw =
    settings.baseFee +
    distanceCost(distance, settings.tiers) +
    settings.perKg * chargeableWeightKg(input.weightKg, input.volumeM3, settings.volumetricFactor);
  const rounded = settings.roundTo * Math.ceil(round2(raw) / settings.roundTo);
  return Math.max(settings.minPrice, rounded);
}

/** Volume en m³ à partir de dimensions en cm. */
export function volumeM3FromCm(lengthCm: number, widthCm: number, heightCm: number): number {
  return Math.round(((lengthCm * widthCm * heightCm) / 1_000_000) * 10_000) / 10_000;
}

/** Avertissement non bloquant au-dessus de 3 fois le prix suggéré. */
export function isPriceUnusuallyHigh(requested: number, suggested: number): boolean {
  return requested > 3 * suggested;
}
