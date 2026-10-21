// Publication rapide (par défaut) : trajet, titre, description facultative, prix, photos facultatives et
// déclaration des objets interdits. « Ajouter plus de détails » ouvre l'assistant complet avec le même brouillon.

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PRICING, haversineKm, isPriceUnusuallyHigh, suggestPrice } from '@ucolis/shared';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CheckRow, PriceInput } from '@/components/FormBits';
import { PhotoGrid } from '@/components/PhotoGrid';
import { RoutePicker } from '@/components/RoutePicker';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { price } from '@/format';
import { useAppConfig } from '@/hooks/useAppConfig';
import { usePublishParcel } from '@/hooks/usePublishParcel';
import { stepErrors } from '@/state/draftPayload';
import { draftEntryRoute, useParcelDraft } from '@/state/parcelDraft';
import { colors, space } from '@/theme';

export default function QuickPublish() {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const { draft, update, touched, editingId, start } = useParcelDraft();
  const config = useAppConfig();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { publish, pending } = usePublishParcel(setErrors);

  // Brouillon trouvé à l'ouverture : proposé à la reprise, dans le mode où il a été laissé.
  useEffect(() => {
    if (editingId) return;
    if (touched) {
      Alert.alert(t('resumeDraft'), t('resumeDraftBody'), [
        { text: t('discard'), style: 'destructive', onPress: () => start() },
        {
          text: t('resume'),
          onPress: () => {
            if (draft.mode === 'full') router.replace(draftEntryRoute('full'));
          },
        },
      ]);
    }
    // Une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sans poids ni dimensions, le prix suggéré ne dépend que de la distance.
  const suggested = useMemo(() => {
    if (!draft.pickup || !draft.dropoff) return null;
    return suggestPrice(
      { distanceKm: haversineKm(draft.pickup.location, draft.dropoff.location), weightKg: 0, volumeM3: 0 },
      config.data?.pricing ?? DEFAULT_PRICING,
    );
  }, [draft.pickup, draft.dropoff, config.data]);

  // Pré-remplissage du prix, seulement si l'utilisateur n'en a pas encore saisi.
  useEffect(() => {
    if (draft.requestedPrice === null && suggested) update({ requestedPrice: suggested });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  function submit() {
    const e = stepErrors('quick', draft);
    setErrors(e);
    if (Object.keys(e).length === 0) void publish();
  }

  function moreDetails() {
    update({ mode: 'full' });
    router.replace(draftEntryRoute('full'));
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={editingId ? t('editTitle') : t('newTitle')} />}
        footer={
          <Button
            label={editingId ? t('saveChanges') : t('publish')}
            onPress={submit}
            loading={pending}
          />
        }
      >
        <AppText size="sm" color={colors.textMuted}>
          {t('quickHint')}
        </AppText>
        <RoutePicker errors={errors} />
        <TextField
          label={t('title')}
          placeholder={t('titlePlaceholder')}
          value={draft.title}
          onChangeText={(title) => update({ title })}
          maxLength={80}
          error={errors.title}
        />
        <TextField
          label={t('description')}
          value={draft.description}
          onChangeText={(description) => update({ description })}
          multiline
          maxLength={1000}
          hint={`${draft.description.length} / 1000`}
          style={styles.description}
        />
        <PriceInput
          label={`${t('requestedPrice')}${suggested && draft.requestedPrice === suggested ? ` (${t('estimated')})` : ''}`}
          value={draft.requestedPrice}
          onChange={(requestedPrice) => update({ requestedPrice })}
          hint={suggested ? t('suggested', { price: price(suggested) }) : undefined}
          error={errors.requestedPrice}
        />
        {suggested && draft.requestedPrice && isPriceUnusuallyHigh(draft.requestedPrice, suggested) && (
          <AppText size="sm" color="#B7791F">
            {t('priceWarning')}
          </AppText>
        )}

        <View style={styles.section}>
          <AppText weight="semibold">{t('photosOptional')}</AppText>
          <AppText size="xs" color={colors.textMuted}>
            {t('photosOptionalHint')}
          </AppText>
          <PhotoGrid photos={draft.photos} onChange={(photos) => update({ photos })} />
          {errors.photos && (
            <AppText size="xs" color={colors.danger}>
              {t(`errors:${errors.photos}`)}
            </AppText>
          )}
        </View>

        <CheckRow
          label={t('prohibited')}
          checked={draft.prohibitedItemsDeclared}
          onChange={(prohibitedItemsDeclared) => update({ prohibitedItemsDeclared })}
          error={errors.prohibitedItemsDeclared}
        />

        <View style={styles.section}>
          <Button label={t('moreDetails')} variant="outline" icon="options-outline" onPress={moreDetails} />
          <AppText size="xs" color={colors.textMuted} style={styles.center}>
            {t('moreDetailsHint')}
          </AppText>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  description: { minHeight: 88, textAlignVertical: 'top' },
  section: { gap: space(2) },
  center: { textAlign: 'center' },
});
