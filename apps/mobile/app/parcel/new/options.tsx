// Étape 3 : véhicules (pré-cochés selon le gabarit), date et créneau, urgent, destinataire,
// règlement convenu, prix demandé pré-rempli avec le prix suggéré du barème partagé.

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PRICING,
  PAYMENT_ARRANGEMENTS,
  TIME_SLOTS,
  timeSlotOf,
  VEHICLE_TYPES,
  haversineKm,
  isPriceUnusuallyHigh,
  suggestPrice,
  suggestedVehicleTypes,
} from '@ucolis/shared';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { DateSelect, PriceInput, SectionCard, SwitchRow, TimeSelect } from '@/components/FormBits';
import { TextField } from '@/components/TextField';
import { WizardFrame } from '@/components/WizardFrame';
import { price } from '@/format';
import { useAppConfig } from '@/hooks/useAppConfig';
import { draftVolume, stepErrors } from '@/state/draftPayload';
import { useParcelDraft } from '@/state/parcelDraft';
import { colors, space } from '@/theme';

export default function OptionsStep() {
  const { t } = useTranslation(['parcel', 'common', 'auth', 'errors']);
  const { draft, update } = useParcelDraft();
  const config = useAppConfig();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suggested = useMemo(() => {
    if (!draft.pickup || !draft.dropoff || !draft.weightKg) return null;
    return suggestPrice(
      { distanceKm: haversineKm(draft.pickup.location, draft.dropoff.location), weightKg: draft.weightKg, volumeM3: draftVolume(draft) },
      config.data?.pricing ?? DEFAULT_PRICING,
    );
  }, [draft, config.data]);

  // Pré-remplissages, seulement si l'utilisateur n'a encore rien choisi.
  useEffect(() => {
    const patch: Partial<typeof draft> = {};
    if (!draft.vehicleTypes.length && draft.weightKg) patch.vehicleTypes = [...suggestedVehicleTypes(draft.weightKg, draftVolume(draft))];
    if (draft.requestedPrice === null && suggested) patch.requestedPrice = suggested;
    if (Object.keys(patch).length) update(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  function next() {
    const e = stepErrors('options', draft);
    setErrors(e);
    if (Object.keys(e).length === 0) router.push('/parcel/new/photos');
  }

  const toggleVehicle = (v: (typeof VEHICLE_TYPES)[number]) =>
    update({ vehicleTypes: draft.vehicleTypes.includes(v) ? draft.vehicleTypes.filter((x) => x !== v) : [...draft.vehicleTypes, v] });

  return (
    <WizardFrame step="options" onNext={next}>
      <AppText weight="semibold">{t('vehicleTypesLabel')}</AppText>
      <View style={styles.chips}>
        {VEHICLE_TYPES.map((v) => (
          <Chip key={v} label={t(`vehicleTypes.${v}`)} selected={draft.vehicleTypes.includes(v)} onPress={() => toggleVehicle(v)} />
        ))}
      </View>
      {errors.vehicleTypes && (
        <AppText size="xs" color={colors.danger}>
          {t(`errors:${errors.vehicleTypes}`)}
        </AppText>
      )}

      <DateSelect label={t('desiredDate')} value={draft.desiredDate ? new Date(draft.desiredDate) : null} onChange={(d) => update({ desiredDate: d.toISOString() })} error={errors.desiredDate} />
      <TimeSelect
        label={t('desiredTime')}
        value={draft.desiredTime ?? null}
        onChange={(desiredTime) => update(desiredTime ? { desiredTime, timeSlot: timeSlotOf(desiredTime) } : { desiredTime })}
        hint={t('desiredTimeHint')}
        error={errors.desiredTime}
      />
      <AppText weight="semibold">{t('timeSlot')}</AppText>
      <View style={styles.chips}>
        {TIME_SLOTS.map((s) => (
          <Chip key={s} label={t(`common:timeSlots.${s}`)} selected={draft.timeSlot === s} onPress={() => update(draft.desiredTime && timeSlotOf(draft.desiredTime) !== s ? { timeSlot: s, desiredTime: null } : { timeSlot: s })} />
        ))}
      </View>
      <SwitchRow label={t('flexibleDates')} value={draft.flexibleDates} onChange={(flexibleDates) => update({ flexibleDates })} />
      <SwitchRow label={t('urgent')} value={draft.urgent} onChange={(urgent) => update({ urgent })} />

      <SectionCard title={t('recipient')}>
        <AppText size="xs" color={colors.textMuted}>
          {t('recipientHint')}
        </AppText>
        <TextField label={t('recipientName')} value={draft.recipientName} onChangeText={(recipientName) => update({ recipientName })} error={errors['recipient.name']} />
        <TextField
          label={t('recipientPhone')}
          value={draft.recipientPhone}
          onChangeText={(recipientPhone) => update({ recipientPhone })}
          keyboardType="phone-pad"
          hint={t('auth:phoneHint')}
          error={errors['recipient.phone']}
        />
      </SectionCard>

      <AppText weight="semibold">{t('paymentArrangement')}</AppText>
      <View style={styles.chips}>
        {PAYMENT_ARRANGEMENTS.map((p) => (
          <Chip key={p} label={t(`common:payment.${p}`)} selected={draft.paymentArrangement === p} onPress={() => update({ paymentArrangement: p })} />
        ))}
      </View>
      <AppText size="xs" color={colors.textMuted}>
        {t('paymentHint')}
      </AppText>
      {errors.paymentArrangement && (
        <AppText size="xs" color={colors.danger}>
          {t('errors:validation.required')}
        </AppText>
      )}

      <PriceInput
        label={`${t('requestedPrice')}${suggested && draft.requestedPrice === suggested ? ` (${t('estimated')})` : ''}`}
        value={draft.requestedPrice}
        onChange={(requestedPrice) => update({ requestedPrice })}
        hint={suggested ? t('suggested', { price: price(suggested) }) : undefined}
        error={errors.requestedPrice}
      />
      {/* Comparaison booléenne : un prix à 0 ne doit pas être rendu comme texte. */}
      {!!suggested && !!draft.requestedPrice && isPriceUnusuallyHigh(draft.requestedPrice, suggested) && (
        <AppText size="sm" color="#B7791F">
          {t('priceWarning')}
        </AppText>
      )}
    </WizardFrame>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
