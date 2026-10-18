import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICING,
  chargeableWeightKg,
  distanceCost,
  isPriceUnusuallyHigh,
  suggestPrice,
  volumeM3FromCm,
} from '../src/pricing';

describe('distanceCost', () => {
  it('applique les tranches marginales', () => {
    expect(distanceCost(0)).toBe(0);
    expect(distanceCost(50)).toBe(400);
    expect(distanceCost(100)).toBe(800);
    expect(distanceCost(300)).toBe(800 + 1200);
    expect(distanceCost(352)).toBe(2260);
    expect(distanceCost(700)).toBe(800 + 1200 + 1500 + 400);
  });
});

describe('suggestPrice', () => {
  it("reproduit l'exemple du PRD : Alger → Oran, 352 km, 5 kg, 40×30×30 cm", () => {
    const volumeM3 = volumeM3FromCm(40, 30, 30);
    expect(volumeM3).toBe(0.036);
    expect(chargeableWeightKg(5, volumeM3)).toBe(7.2);
    expect(suggestPrice({ distanceKm: 352, weightKg: 5, volumeM3 })).toBe(3250);
  });

  it('arrondit au multiple de 50 supérieur et retient le poids réel quand il domine', () => {
    // 600 + 80 + 50 × 20 = 1 680 → 1 700
    expect(suggestPrice({ distanceKm: 10, weightKg: 20, volumeM3: 0.01 })).toBe(1700);
    // valeur déjà ronde : 600 + 0 + 50 × 1 = 650
    expect(suggestPrice({ distanceKm: 0, weightKg: 1, volumeM3: 0 })).toBe(650);
  });

  it('ignore une distance négative et respecte le prix minimum', () => {
    const settings = { ...DEFAULT_PRICING, baseFee: 0, perKg: 0, minPrice: 100 };
    expect(suggestPrice({ distanceKm: -5, weightKg: 1, volumeM3: 0 }, settings)).toBe(100);
  });

  it('signale un prix demandé supérieur à 3 fois le prix suggéré', () => {
    expect(isPriceUnusuallyHigh(9751, 3250)).toBe(true);
    expect(isPriceUnusuallyHigh(9750, 3250)).toBe(false);
  });
});
