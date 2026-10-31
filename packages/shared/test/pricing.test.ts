import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICING,
  chargeableWeightKg,
  distanceCost,
  handlingCost,
  isPriceUnusuallyHigh,
  sizeFactor,
  suggestPrice,
  volumeM3FromCm,
} from '../src/pricing';

describe('distanceCost', () => {
  it('applique les tranches marginales', () => {
    expect(distanceCost(0)).toBe(0);
    expect(distanceCost(50)).toBe(60);
    expect(distanceCost(100)).toBe(120);
    expect(distanceCost(300)).toBe(120 + 160);
    expect(distanceCost(352)).toBe(306);
    expect(distanceCost(700)).toBe(120 + 160 + 150 + 30);
  });
});

describe('handlingCost', () => {
  it('rend la manutention dégressive par tranches de poids', () => {
    expect(handlingCost(0)).toBe(0);
    expect(handlingCost(10)).toBe(100);
    expect(handlingCost(30)).toBe(300);
    expect(handlingCost(200)).toBe(300 + 1020);
    expect(handlingCost(600)).toBe(300 + 1020 + 800);
  });
});

describe('sizeFactor', () => {
  it('vaut 1 sans poids, grandit avec le poids taxé et plafonne pour un véhicule plein', () => {
    expect(sizeFactor(0)).toBe(1);
    expect(sizeFactor(50)).toBe(2);
    expect(sizeFactor(10_000)).toBe(DEFAULT_PRICING.maxSizeFactor);
  });
});

describe('suggestPrice', () => {
  it("reproduit l'exemple du PRD : Alger → Oran, 352 km, 5 kg, 40×30×30 cm", () => {
    const volumeM3 = volumeM3FromCm(40, 30, 30);
    expect(volumeM3).toBe(0.036);
    expect(chargeableWeightKg(5, volumeM3)).toBe(7.2);
    // 150 + 306 × 1,144 + 7,2 × 10 = 572,06 → 600, sous le tarif des sociétés de livraison
    expect(suggestPrice({ distanceKm: 352, weightKg: 5, volumeM3 })).toBe(600);
  });

  it('garde un prix abordable pour un objet volumineux sur un trajet court', () => {
    // 15 kg mais 3 m³ (600 kg taxés), 1 km, fragile : (150 + 1,2 × 8 + 2 120) × 1,1 = 2 507,56 → 2 550
    expect(suggestPrice({ distanceKm: 1, weightKg: 15, volumeM3: 3, fragile: true })).toBe(2550);
  });

  it('majore un colis fragile', () => {
    const input = { distanceKm: 352, weightKg: 60, volumeM3: volumeM3FromCm(70, 70, 180) };
    expect(suggestPrice({ ...input, fragile: true })).toBeGreaterThan(suggestPrice(input));
  });

  it('ne dépend que de la distance sans poids ni volume (publication rapide)', () => {
    // 150 + 306 = 456 → 500
    expect(suggestPrice({ distanceKm: 352, weightKg: 0, volumeM3: 0 })).toBe(500);
  });

  it('ignore une distance négative et respecte le prix minimum', () => {
    expect(suggestPrice({ distanceKm: -5, weightKg: 0, volumeM3: 0 })).toBe(DEFAULT_PRICING.minPrice);
    const settings = { ...DEFAULT_PRICING, baseFee: 0, minPrice: 100 };
    expect(suggestPrice({ distanceKm: 0, weightKg: 0, volumeM3: 0 }, settings)).toBe(100);
  });

  it('signale un prix demandé supérieur à 3 fois le prix suggéré', () => {
    expect(isPriceUnusuallyHigh(4501, 1500)).toBe(true);
    expect(isPriceUnusuallyHigh(4500, 1500)).toBe(false);
  });
});
