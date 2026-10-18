import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@ucolis/shared';
import { AppSettingModel } from '../src/modules/settings/model';
import { createSettingsService, mergeSettings } from '../src/modules/settings/service';
import { useDatabase } from './helpers';

describe('mergeSettings', () => {
  it('fusionne les objets et remplace les valeurs simples', () => {
    const s = mergeSettings([
      { key: 'limits', value: { activeParcelsIndividual: 8 } },
      { key: 'autoConfirmHours', value: 48 },
      { key: 'inconnue', value: 1 },
      { key: 'minAppVersion', value: null },
    ]);
    expect(s.limits.activeParcelsIndividual).toBe(8);
    expect(s.limits.activeParcelsPro).toBe(20);
    expect(s.autoConfirmHours).toBe(48);
    expect(s.minAppVersion).toBe(DEFAULT_SETTINGS.minAppVersion);
    expect(s).not.toHaveProperty('inconnue');
  });

  it('ne modifie jamais les valeurs par défaut partagées', () => {
    mergeSettings([{ key: 'limits', value: { maxCounterOffers: 9 } }]);
    expect(DEFAULT_SETTINGS.limits.maxCounterOffers).toBe(3);
  });
});

describe('createSettingsService (MongoDB)', () => {
  useDatabase();

  it('renvoie les valeurs par défaut sans réglage en base', async () => {
    expect(await createSettingsService().getAll()).toEqual(DEFAULT_SETTINGS);
  });

  it('applique les réglages enregistrés', async () => {
    await AppSettingModel.create({ key: 'requireCarrierVerification', value: false });
    const s = await createSettingsService().getAll();
    expect(s.requireCarrierVerification).toBe(false);
  });

  it('garantit une clé unique et connue', async () => {
    await AppSettingModel.create({ key: 'parcelExpiryDays', value: 7 });
    await expect(AppSettingModel.create({ key: 'parcelExpiryDays', value: 9 })).rejects.toThrow();
    await expect(AppSettingModel.create({ key: 'nope', value: 1 })).rejects.toThrow();
  });
});
