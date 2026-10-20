// Étape 1 : adresses de départ et d'arrivée, choisies comme dans une application de VTC (recherche, position,
// récents ou carte) ; wilaya et commune déduites du point, corrigeables ; précisions libres.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AddressSearch, type AddressField } from '@/components/AddressSearch';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { WilayaCommuneSelect } from '@/components/WilayaCommuneSelect';
import { WizardFrame } from '@/components/WizardFrame';
import { placeLabel } from '@/format';
import { stepErrors } from '@/state/draftPayload';
import { useParcelDraft, type DraftPlace } from '@/state/parcelDraft';
import { colors, MIN_TOUCH, radii, space } from '@/theme';

const FIELDS: AddressField[] = ['pickup', 'dropoff'];

export default function RouteStep() {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const { draft, update, touched, editingId, start } = useParcelDraft();
  const [searching, setSearching] = useState<AddressField | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Brouillon trouvé à l'ouverture : proposé à la reprise.
  useEffect(() => {
    if (fresh || editingId) return;
    if (touched) {
      Alert.alert(t('resumeDraft'), t('resumeDraftBody'), [
        { text: t('discard'), style: 'destructive', onPress: () => start() },
        { text: t('resume') },
      ]);
    }
    // Une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function next() {
    const e = stepErrors('route', draft);
    setErrors(e);
    if (Object.keys(e).length === 0) router.push('/parcel/new/details');
  }

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

  return (
    <WizardFrame step="route" onNext={next}>
      <View
        style={[
          styles.summary,
          !!firstError && !(draft.pickup && draft.dropoff) && { borderColor: colors.danger },
        ]}
      >
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
      {firstError && !(draft.pickup && draft.dropoff) && (
        <AppText size="xs" color={colors.danger}>
          {t(`errors:${firstError}`, { defaultValue: firstError })}
        </AppText>
      )}
      {FIELDS.map(details)}
      <AddressSearch
        visible={searching !== null}
        field={searching ?? 'pickup'}
        values={{ pickup: draft.pickup, dropoff: draft.dropoff }}
        onFieldChange={setSearching}
        onClose={() => setSearching(null)}
        onSelect={(key, place) =>
          update({ [key]: { ...place, details: draft[key]?.details ?? '' } })
        }
      />
    </WizardFrame>
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
