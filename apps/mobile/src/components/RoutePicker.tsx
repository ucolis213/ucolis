// Adresses de départ et d'arrivée choisies comme dans une application de VTC (recherche, position, récents ou
// carte). En publication complète, wilaya, commune et précisions de chaque adresse sont aussi modifiables.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { placeLabel } from '../format';
import { useParcelDraft, type DraftPlace } from '../state/parcelDraft';
import { colors, MIN_TOUCH, radii, space } from '../theme';
import { AddressSearch, type AddressField } from './AddressSearch';
import { AppText } from './AppText';
import { TextField } from './TextField';
import { WilayaCommuneSelect } from './WilayaCommuneSelect';

const FIELDS: AddressField[] = ['pickup', 'dropoff'];

export function RoutePicker({ errors, showDetails = false }: { errors: Record<string, string>; showDetails?: boolean }) {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const { draft, update } = useParcelDraft();
  const [searching, setSearching] = useState<AddressField | null>(null);

  const errorOf = (key: AddressField) =>
    Object.entries(errors).find(([k]) => k.startsWith(key))?.[1];

  const summaryRow = (key: AddressField) => {
    const p = draft[key];
    const missing = !!errorOf(key) && !p;
    return (
      <Pressable
        style={styles.summaryRow}
        onPress={() => setSearching(key)}
        accessibilityRole="button"
        accessibilityLabel={t(key)}
      >
        <View style={styles.flex}>
          <AppText size="xs" color={missing ? colors.danger : colors.textMuted}>
            {t(key)}
          </AppText>
          <AppText
            numberOfLines={1}
            weight={p ? 'medium' : 'regular'}
            color={p ? colors.navy : colors.textSubtle}
          >
            {p ? p.address : t(key === 'pickup' ? 'whereFrom' : 'whereTo')}
          </AppText>
        </View>
        <Ionicons name="search" size={18} color={colors.textMuted} />
      </Pressable>
    );
  };

  const details = (key: AddressField) => {
    const p = draft[key];
    if (!p) return null;
    return (
      <View key={key} style={styles.block}>
        <View style={styles.blockTitle}>
          <View style={key === 'pickup' ? styles.dot : styles.square} />
          <AppText weight="bold">{t(key)}</AppText>
        </View>
        <AppText size="xs" color={colors.textMuted}>
          {placeLabel(p)}
        </AppText>
        <WilayaCommuneSelect
          value={{ wilayaCode: p.wilayaCode, commune: p.commune }}
          onChange={(v) => update({ [key]: { ...p, ...v } as DraftPlace })}
          errors={{ commune: errors[`${key}.commune`] }}
        />
        <TextField
          label={t('addressDetails')}
          value={p.details ?? ''}
          onChangeText={(text) => update({ [key]: { ...p, details: text } as DraftPlace })}
          maxLength={200}
        />
      </View>
    );
  };

  const firstError = FIELDS.map(errorOf).find(Boolean);
  const incomplete = !!firstError && !(draft.pickup && draft.dropoff);

  return (
    <>
      <View style={[styles.summary, incomplete && { borderColor: colors.danger }]}>
        {/* Repères reliés : rond pour le départ, carré pour l'arrivée. */}
        <View style={styles.rail}>
          <View style={styles.dot} />
          <View style={styles.line} />
          <View style={styles.square} />
        </View>
        <View style={styles.flex}>
          {summaryRow('pickup')}
          <View style={styles.divider} />
          {summaryRow('dropoff')}
        </View>
      </View>
      {incomplete && (
        <AppText size="xs" color={colors.danger}>
          {t(`errors:${firstError}`, { defaultValue: firstError })}
        </AppText>
      )}
      {showDetails && FIELDS.map(details)}
      <AddressSearch
        visible={searching !== null}
        field={searching ?? 'pickup'}
        values={{ pickup: draft.pickup, dropoff: draft.dropoff }}
        onFieldChange={setSearching}
        onClose={() => setSearching(null)}
        onSelect={(key, place) => update({ [key]: { ...place, details: draft[key]?.details ?? '' } })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: {
    flexDirection: 'row',
    gap: space(3),
    paddingHorizontal: space(3),
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rail: { alignItems: 'center', paddingVertical: space(6) },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  line: { flex: 1, width: 2, marginVertical: space(1), backgroundColor: colors.border },
  square: { width: 10, height: 10, backgroundColor: colors.navy },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    minHeight: MIN_TOUCH + 16,
    paddingVertical: space(2),
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  block: { gap: space(3) },
  blockTitle: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
