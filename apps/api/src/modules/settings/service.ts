// Lecture des réglages : les valeurs en base priment sur les valeurs par défaut de shared.

import { APP_SETTING_KEYS, DEFAULT_SETTINGS, type AppSettings } from '@ucolis/shared';
import { AppSettingModel } from './model';

export interface SettingsReader {
  getAll(): Promise<AppSettings>;
}

export function mergeSettings(rows: { key: string; value: unknown }[]): AppSettings {
  const merged: AppSettings = structuredClone(DEFAULT_SETTINGS);
  const known = new Set<string>(APP_SETTING_KEYS);
  for (const { key, value } of rows) {
    if (!known.has(key) || value === undefined || value === null) continue;
    const current = merged[key as keyof AppSettings];
    const next =
      typeof current === 'object' && !Array.isArray(current) && typeof value === 'object'
        ? { ...current, ...value }
        : value;
    (merged as unknown as Record<string, unknown>)[key] = next;
  }
  return merged;
}

export function createSettingsService(model = AppSettingModel): SettingsReader {
  return {
    async getAll() {
      const rows = await model.find({}, { key: 1, value: 1 }).lean();
      return mergeSettings(rows);
    },
  };
}
