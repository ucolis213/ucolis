// Étape 2 : titre, catégorie, description, poids (g ou kg), dimensions (cm ou m), fragile, objets interdits.

import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PARCEL_CATEGORIES } from '@ucolis/shared';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { CheckRow, NumberInput } from '@/components/FormBits';
import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { WizardFrame } from '@/components/WizardFrame';
import { draftVolume, stepErrors } from '@/state/draftPayload';
import { useParcelDraft } from '@/state/parcelDraft';
import { colors, space } from '@/theme';

export default function DetailsStep() {
  const { t } = useTranslation(['parcel', 'common']);
  const { draft, update } = useParcelDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const weightFactor = draft.weightUnit === 'g' ? 1000 : 1;
  const dimFactor = draft.dimensionUnit === 'm' ? 0.01 : 1;
  const round = (v: number) => Math.round(v * 1000) / 1000;

  function next() {
    const e = stepErrors('details', draft);
    setErrors(e);
    if (Object.keys(e).length === 0) router.push('/parcel/new/options');
  }

  const dim = (key: 'length' | 'width' | 'height') => (
    <View style={styles.flex}>
      <NumberInput
        label={t(key)}
        value={draft.dimensionsCm[key] === null ? null : round(draft.dimensionsCm[key]! * dimFactor)}
        onChange={(v) => update({ dimensionsCm: { ...draft.dimensionsCm, [key]: v === null ? null : round(v / dimFactor) } })}
        error={errors[`dimensionsCm.${key}`]}
      />
    </View>
  );

  return (
    <WizardFrame step="details" onNext={next}>
      <TextField
        label={t('title')}
        placeholder={t('titlePlaceholder')}
        value={draft.title}
        onChangeText={(title) => update({ title })}
        maxLength={80}
        error={errors.title}
      />
      <Select
        label={t('category')}
        value={draft.category ?? undefined}
        options={PARCEL_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
        onChange={(v) => update({ category: v as never })}
        error={errors.category}
      />
      <TextField
        label={t('description')}
        value={draft.description}
        onChangeText={(description) => update({ description })}
        multiline
        maxLength={1000}
        hint={`${draft.description.length} / 1000`}
        style={{ minHeight: 88, textAlignVertical: 'top' }}
      />

      <View style={styles.unitRow}>
        <AppText weight="semibold" style={styles.flex}>
          {t('weight')}
        </AppText>
        {(['g', 'kg'] as const).map((u) => (
          <Chip key={u} label={u} selected={draft.weightUnit === u} onPress={() => update({ weightUnit: u })} />
        ))}
      </View>
      <NumberInput
        label={`${t('weight')} (${draft.weightUnit})`}
        value={draft.weightKg === null ? null : round(draft.weightKg * weightFactor)}
        onChange={(v) => update({ weightKg: v === null ? null : round(v / weightFactor) })}
        error={errors.weightKg}
      />

      <View style={styles.unitRow}>
        <AppText weight="semibold" style={styles.flex}>
          {t('dimensions')}
        </AppText>
        {(['cm', 'm'] as const).map((u) => (
          <Chip key={u} label={u} selected={draft.dimensionUnit === u} onPress={() => update({ dimensionUnit: u })} />
        ))}
      </View>
      <View style={styles.row}>
        {dim('length')}
        {dim('width')}
        {dim('height')}
      </View>
      <AppText size="sm" color={colors.textMuted}>
        {t('volume', { value: draftVolume(draft) })}
      </AppText>

      <CheckRow label={t('fragile')} checked={draft.fragile} onChange={(fragile) => update({ fragile })} />
      <CheckRow
        label={t('prohibited')}
        checked={draft.prohibitedItemsDeclared}
        onChange={(prohibitedItemsDeclared) => update({ prohibitedItemsDeclared })}
        error={errors.prohibitedItemsDeclared}
      />
    </WizardFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space(2) },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
