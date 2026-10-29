// Barème unique du prix suggéré (F6). Le mobile l'affiche, l'API le recalcule à l'enregistrement.
//
//   W = max(P, facteur volumétrique × V)                      poids taxé
//   T = min(taille max, 1 + W / pas de taille)                 facteur de taille (petit colis ≈ 1, camionnette = max)
//   Prix = arrondi au multiple supérieur de 50 de :
//          (base + C(d) × T + H(W)) × (1 + majoration fragile)
//
// C(d) : coût kilométrique par tranches marginales. H(W) : manutention par tranches de poids, dégressive.
// Le poids n'est plus facturé indépendamment de la distance : un objet volumineux coûte surtout par le trajet
// (un plus gros véhicule), un peu par la manutention. Calibré sur le pouvoir d'achat algérien (voir le PRD).

export interface PricingTier {
  /** Borne haute de la tranche en km ; null pour la dernière tranche. */
  upToKm: number | null;
  ratePerKm: number;
}

export interface WeightTier {
  /** Borne haute de la tranche en kg ; null pour la dernière tranche. */
  upToKg: number | null;
  ratePerKg: number;
}

export interface PricingSettings {
  /** Prise en charge, en DA. */
  baseFee: number;
  /** Coût kilométrique d'un petit colis, par tranches marginales. */
  tiers: PricingTier[];
  /** Manutention par tranches marginales de poids taxé. */
  weightTiers: WeightTier[];
  /** Kilogrammes taxés qui ajoutent 100 % au coût kilométrique. */
  sizeStepKg: number;
  /** Plafond du facteur de taille (véhicule plein). */
  maxSizeFactor: number;
  /** Poids volumétrique en kg par m³. */
  volumetricFactor: number;
  /** Majoration d'un colis fragile (0,1 = +10 %). */
  fragileSurcharge: number;
  roundTo: number;
  minPrice: number;
}

export const DEFAULT_PRICING: PricingSettings = {
  baseFee: 300,
  tiers: [
    { upToKm: 100, ratePerKm: 3 },
    { upToKm: 300, ratePerKm: 2.5 },
    { upToKm: 600, ratePerKm: 2 },
    { upToKm: null, ratePerKm: 1.5 },
  ],
  weightTiers: [
    { upToKg: 30, ratePerKg: 20 },
    { upToKg: 200, ratePerKg: 8 },
    { upToKg: null, ratePerKg: 3 },
  ],
  sizeStepKg: 50,
  maxSizeFactor: 8,
  volumetricFactor: 200,
  fragileSurcharge: 0.1,
  roundTo: 50,
  minPrice: 300,
};

export interface PriceInput {
  distanceKm: number;
  weightKg: number;
  volumeM3: number;
  fragile?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Somme par tranches marginales : chaque tranche facture la part de la quantité qui y tombe. */
function marginal(quantity: number, tiers: { upTo: number | null; rate: number }[]): number {
  let cost = 0;
  let from = 0;
  for (const tier of tiers) {
    if (quantity <= from) break;
    const to = tier.upTo === null ? quantity : Math.min(quantity, tier.upTo);
    cost += (to - from) * tier.rate;
    if (tier.upTo === null) break;
    from = tier.upTo;
  }
  return round2(cost);
}

/** Coût kilométrique par tranches marginales. */
export function distanceCost(distanceKm: number, tiers = DEFAULT_PRICING.tiers): number {
  return marginal(distanceKm, tiers.map((t) => ({ upTo: t.upToKm, rate: t.ratePerKm })));
}

/** Manutention par tranches marginales de poids taxé. */
export function handlingCost(chargeableKg: number, tiers = DEFAULT_PRICING.weightTiers): number {
  return marginal(chargeableKg, tiers.map((t) => ({ upTo: t.upToKg, rate: t.ratePerKg })));
}

/** Poids taxé : le plus grand du poids réel et du poids volumétrique. */
export function chargeableWeightKg(
  weightKg: number,
  volumeM3: number,
  volumetricFactor = DEFAULT_PRICING.volumetricFactor,
): number {
  return round2(Math.max(weightKg, volumetricFactor * volumeM3));
}

/** Facteur de taille appliqué au coût kilométrique : 1 sans poids, plafonné pour un véhicule plein. */
export function sizeFactor(chargeableKg: number, settings: PricingSettings = DEFAULT_PRICING): number {
  return Math.min(settings.maxSizeFactor, 1 + chargeableKg / settings.sizeStepKg);
}

export function suggestPrice(
  input: PriceInput,
  settings: PricingSettings = DEFAULT_PRICING,
): number {
  const distance = Math.max(0, input.distanceKm);
  const weight = chargeableWeightKg(Math.max(0, input.weightKg), Math.max(0, input.volumeM3), settings.volumetricFactor);
  const beforeSurcharge =
    settings.baseFee +
    distanceCost(distance, settings.tiers) * sizeFactor(weight, settings) +
    handlingCost(weight, settings.weightTiers);
  const raw = beforeSurcharge * (input.fragile ? 1 + settings.fragileSurcharge : 1);
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
