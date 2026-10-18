// Étape 1 : adresses de départ et d'arrivée sur la carte ; wilaya et commune déduites, corrigeables.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { MapPicker } from '@/components/MapPicker';
import { TextField } from '@/components/TextField';
import { WilayaCommuneSelect } from '@/components/WilayaCommuneSelect';
import { WizardFrame } from '@/components/WizardFrame';
import { placeLabel } from '@/format';
import { stepErrors } from '@/state/draftPayload';
import { useParcelDraft, type DraftPlace } from '@/state/parcelDraft';
import { colors, MIN_TOUCH, radii, space } from '@/theme';

export default function RouteStep() {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const { draft, update, touched, editingId, start } = useParcelDraft();
  const [picking, setPicking] = useState<'pickup' | 'dropoff' | null>(null);
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

  const place = (key: 'pickup' | 'dropoff') => {
    const p = draft[key];
    const error = Object.entries(errors).find(([k]) => k.startsWith(key))?.[1];
    return (
      <View style={styles.block}>
        <AppText weight="bold">{t(key)}</AppText>
        <Pressable style={[styles.pick, !!error && !p && { borderColor: colors.danger }]} onPress={() => setPicking(key)} accessibilityRole="button" accessibilityLabel={t('chooseOnMap')}>
          <Ionicons name="location" size={22} color={key === 'pickup' ? colors.primary : colors.navy} />
          <View style={styles.flex}>
            <AppText numberOfLines={2} color={p ? colors.navy : colors.textSubtle}>
              {p ? p.address : t('chooseOnMap')}
            </AppText>
            {p && (
              <AppText size="xs" color={colors.textMuted}>
                {placeLabel(p)}
              </AppText>
            )}
          </View>
          <Ionicons name="map-outline" size={20} color={colors.primaryDark} />
        </Pressable>
        {p && (
          <>
            <WilayaCommuneSelect
              value={{ wilayaCode: p.wilayaCode, commune: p.commune }}
              onChange={(v) => update({ [key]: { ...p, ...v } as DraftPlace })}
              errors={{ commune: errors[`${key}.commune`] }}
            />
            <TextField
              label={t('addressDetails')}
              value={p.details ?? ''}
              onChangeText={(details) => update({ [key]: { ...p, details } as DraftPlace })}
              maxLength={200}
            />
          </>
        )}
        {error && !p && (
          <AppText size="xs" color={colors.danger}>
            {t(`errors:${error}`, { defaultValue: error })}
          </AppText>
        )}
      </View>
    );
  };

  return (
    <WizardFrame step="route" onNext={next}>
      {place('pickup')}
      {place('dropoff')}
      <MapPicker
        visible={picking !== null}
        title={picking ? t(picking) : ''}
        initial={picking ? (draft[picking]?.location ?? null) : null}
        onClose={() => setPicking(null)}
        onPick={(p) => {
          if (picking) update({ [picking]: { ...p, details: draft[picking]?.details ?? '' } });
          setPicking(null);
        }}
      />
    </WizardFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: space(3) },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: MIN_TOUCH + 16,
    padding: space(3),
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
