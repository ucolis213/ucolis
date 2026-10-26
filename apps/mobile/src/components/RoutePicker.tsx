// Adresses de départ et d'arrivée choisies comme dans une application de VTC (recherche, position, récents ou
// carte). RouteFields sert aussi aux trajets ; RoutePicker le relie au brouillon d'annonce et, en publication
// complète, rend wilaya, commune et précisions de chaque adresse modifiables.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { placeLabel } from '../format';
import { useParcelDraft, type DraftPlace } from '../state/parcelDraft';
import { colors, MIN_TOUCH, radii, space } from '../theme';
import { AddressSearch, type AddressField, type AddressPlaceholders } from './AddressSearch';
import { AppText } from './AppText';
import { TextField } from './TextField';
import type { PickedPlace } from './MapPicker';
import { WilayaCommuneSelect } from './WilayaCommuneSelect';

type RouteField = Extract<AddressField, 'pickup' | 'dropoff'>;

const FIELDS: RouteField[] = ['pickup', 'dropoff'];

/** Résumé départ / arrivée et recherche d'adresse. Erreurs indexées par champ (clé commençant par pickup ou dropoff). */
export function RouteFields({
  value,
  onChange,
  errors,
  placeholders,
}: {
  value: Record<RouteField, PickedPlace | null>;
  onChange: (field: RouteField, place: PickedPlace) => void;
  errors: Record<string, string>;
  placeholders?: AddressPlaceholders;
}) {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const [searching, setSearching] = useState<RouteField | null>(null);

  const errorOf = (key: RouteField) =>
    Object.entries(errors).find(([k]) => k.startsWith(key))?.[1];

  const summaryRow = (key: RouteField) => {
    const p = value[key];
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
            {p ? p.address : (placeholders?.[key] ?? t(key === 'pickup' ? 'whereFrom' : 'whereTo'))}
          </AppText>
        </View>
        <Ionicons name="search" size={18} color={colors.textMuted} />
      </Pressable>
    );
  };

  const firstError = FIELDS.map(errorOf).find(Boolean);
  const incomplete = !!firstError && !(value.pickup && value.dropoff);

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
      <AddressSearch
        visible={searching !== null}
        field={searching ?? 'pickup'}
        values={value}
        placeholders={placeholders}
        onFieldChange={(f) => setSearching(f as RouteField)}
        onClose={() => setSearching(null)}
        onSelect={(f, place) => onChange(f as RouteField, place)}
      />
    </>
  );
}

export function RoutePicker({ errors, showDetails = false }: { errors: Record<string, string>; showDetails?: boolean }) {
  const { t } = useTranslation(['parcel', 'common']);
  const { draft, update } = useParcelDraft();

  const details = (key: RouteField) => {
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

  return (
    <>
      <RouteFields
        value={{ pickup: draft.pickup, dropoff: draft.dropoff }}
        errors={errors}
        onChange={(key, place) => update({ [key]: { ...place, details: draft[key]?.details ?? '' } })}
      />
      {showDetails && FIELDS.map(details)}
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
