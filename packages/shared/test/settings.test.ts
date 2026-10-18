import { describe, expect, it } from 'vitest';
import {
  APP_SETTING_KEYS,
  DEFAULT_SETTINGS,
  compareVersions,
  toPublicConfig,
} from '../src/settings';

describe('réglages', () => {
  it('reprend les limites du PRD', () => {
    expect(DEFAULT_SETTINGS.limits).toMatchObject({
      activeParcelsIndividual: 5,
      activeParcelsPro: 20,
      activeTripsIndividual: 3,
      activeTripsPro: 10,
      maxCounterOffers: 3,
    });
    expect(DEFAULT_SETTINGS.requireCarrierVerification).toBe(true);
    expect(APP_SETTING_KEYS).toContain('pricing');
  });

  it('expose uniquement les réglages publics', () => {
    const pub = toPublicConfig(DEFAULT_SETTINGS);
    expect(pub).not.toHaveProperty('reviewWindowDays');
    expect(pub.minAppVersion).toBe('1.0.0');
  });

  it('compare des versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0', '1.9.9')).toBe(1);
  });
});
