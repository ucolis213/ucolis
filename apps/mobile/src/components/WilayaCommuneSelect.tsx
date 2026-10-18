// Wilaya puis commune (liste dépendante), noms dans la langue active depuis shared/geo.

import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WILAYAS, getWilaya, placeName } from '@ucolis/shared';
import { currentLocale } from '../i18n';
import { space } from '../theme';
import { Select } from './Select';

export interface PlaceValue {
  wilayaCode: string;
  commune: string;
}

export function useWilayaOptions() {
  const locale = currentLocale();
  return useMemo(
    () => WILAYAS.map((w) => ({ value: w.code, label: `${w.code} · ${placeName(w, locale)}` })),
    [locale],
  );
}

export function WilayaCommuneSelect({
  value,
  onChange,
  errors = {},
  withCommune = true,
}: {
  value: PlaceValue;
  onChange: (v: PlaceValue) => void;
  errors?: { wilaya?: string; commune?: string };
  withCommune?: boolean;
}) {
  const { t } = useTranslation('auth');
  const locale = currentLocale();
  const wilayaOptions = useWilayaOptions();
  const communeOptions = useMemo(
    () =>
      (getWilaya(value.wilayaCode)?.communes ?? [])
        .map((c) => ({ value: c.code, label: placeName(c, locale) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [value.wilayaCode, locale],
  );

  return (
    <View style={{ gap: space(4) }}>
      <Select
        label={t('wilaya')}
        value={value.wilayaCode || undefined}
        options={wilayaOptions}
        error={errors.wilaya}
        onChange={(wilayaCode) => onChange({ wilayaCode, commune: '' })}
      />
      {withCommune && (
        <Select
          label={t('commune')}
          value={value.commune || undefined}
          options={communeOptions}
          disabled={!value.wilayaCode}
          error={errors.commune}
          onChange={(commune) => onChange({ ...value, commune })}
        />
      )}
    </View>
  );
}
