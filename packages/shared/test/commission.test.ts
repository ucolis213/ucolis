import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMMISSION,
  commissionBreakdown,
  commissionRate,
  commissionTierRanges,
  isCommissionActive,
  isWalletBlocked,
} from '../src/commission';
import { APP_SETTING_SCHEMAS, DEFAULT_SETTINGS, toPublicConfig } from '../src/settings';

describe('grille de commission', () => {
  it('applique le taux de la tranche du prix entier, 3 000 DA compris à 12 %', () => {
    expect(commissionRate(100)).toBe(15);
    expect(commissionRate(999)).toBe(15);
    expect(commissionRate(1000)).toBe(12);
    expect(commissionRate(3000)).toBe(12);
    expect(commissionRate(3001)).toBe(10);
    expect(commissionRate(10000)).toBe(10);
    expect(commissionRate(10001)).toBe(8);
  });

  it('calcule frais fixes, part variable et gains nets', () => {
    expect(commissionBreakdown(2500)).toEqual({
      grossPrice: 2500,
      fixedFee: 50,
      ratePercent: 12,
      variableCommission: 300,
      totalCommission: 350,
      netEarnings: 2150,
    });
    expect(commissionBreakdown(800)).toMatchObject({ variableCommission: 120, totalCommission: 170, netEarnings: 630 });
    expect(commissionBreakdown(15000)).toMatchObject({ ratePercent: 8, variableCommission: 1200, netEarnings: 13750 });
  });

  it('arrondit au dinar et ne dépasse jamais le prix', () => {
    expect(commissionBreakdown(1005).variableCommission).toBe(121);
    expect(commissionBreakdown(40)).toMatchObject({ fixedFee: 40, variableCommission: 0, totalCommission: 40, netEarnings: 0 });
    expect(commissionBreakdown(55)).toMatchObject({ fixedFee: 50, variableCommission: 5, netEarnings: 0 });
    expect(commissionBreakdown(-10).totalCommission).toBe(0);
  });

  it('suit la grille configurée', () => {
    const custom = { fixedFee: 0, tiers: [{ upTo: null, ratePercent: 5 }] };
    expect(commissionBreakdown(2000, custom)).toMatchObject({ fixedFee: 0, totalCommission: 100 });
    expect(commissionRate(10, [])).toBe(0);
  });

  it('décrit les tranches pour l’affichage', () => {
    expect(commissionTierRanges()).toEqual([
      { from: null, upTo: 999, ratePercent: 15 },
      { from: 1000, upTo: 3000, ratePercent: 12 },
      { from: 3001, upTo: 10000, ratePercent: 10 },
      { from: 10001, upTo: null, ratePercent: 8 },
    ]);
  });

  it('n’est active qu’une fois activée et en vigueur', () => {
    const at = new Date('2026-12-01T00:00:00Z');
    expect(isCommissionActive(DEFAULT_COMMISSION, at)).toBe(false);
    expect(isCommissionActive({ enabled: true, effectiveFrom: null }, at)).toBe(true);
    expect(isCommissionActive({ enabled: true, effectiveFrom: '2027-01-01T00:00:00Z' }, at)).toBe(false);
    expect(isCommissionActive({ enabled: true, effectiveFrom: '2026-11-01T00:00:00Z' }, at)).toBe(true);
  });

  it('bloque sous le solde minimal', () => {
    expect(isWalletBlocked(0)).toBe(false);
    expect(isWalletBlocked(-1)).toBe(true);
    expect(isWalletBlocked(100, 200)).toBe(true);
  });
});

describe('réglage commission', () => {
  const schema = APP_SETTING_SCHEMAS.commission;

  it('est gratuit au lancement et public', () => {
    expect(DEFAULT_SETTINGS.commission.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.commission.welcomeBonus).toBe(1000);
    expect(toPublicConfig(DEFAULT_SETTINGS).commission).toEqual(DEFAULT_COMMISSION);
    expect(schema.safeParse(DEFAULT_COMMISSION).success).toBe(true);
  });

  it('refuse des tranches mal ordonnées ou une date invalide', () => {
    const tiers = [
      { upTo: 3000, ratePercent: 12 },
      { upTo: 1000, ratePercent: 15 },
      { upTo: null, ratePercent: 8 },
    ];
    expect(schema.safeParse({ ...DEFAULT_COMMISSION, tiers }).success).toBe(false);
    expect(schema.safeParse({ ...DEFAULT_COMMISSION, tiers: [{ upTo: 1000, ratePercent: 5 }] }).success).toBe(false);
    expect(schema.safeParse({ ...DEFAULT_COMMISSION, effectiveFrom: 'demain' }).success).toBe(false);
    expect(schema.safeParse({ ...DEFAULT_COMMISSION, effectiveFrom: '2027-01-01T00:00:00.000Z' }).success).toBe(true);
    expect(schema.safeParse({ ...DEFAULT_COMMISSION, topUp: { ...DEFAULT_COMMISSION.topUp, minAmount: 5000, maxAmount: 100 } }).success).toBe(false);
  });
});
