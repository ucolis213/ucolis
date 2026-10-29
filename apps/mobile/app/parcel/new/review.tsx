// Récapitulatif puis publication (ou enregistrement d'une modification). En cas d'erreur de l'API,
// l'assistant revient à l'étape fautive.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { haversineKm } from '@ucolis/shared';
import { AppText } from '@/components/AppText';
import { cdn } from '@/components/Avatar';
import { KeyValue, SectionCard } from '@/components/FormBits';
import { RouteAddresses } from '@/components/RouteStops';
import { WizardFrame } from '@/components/WizardFrame';
import { distance, formatDate, price, weight } from '@/format';
import { usePublishParcel } from '@/hooks/usePublishParcel';
import { draftVolume, stepOfField } from '@/state/draftPayload';
import { useParcelDraft } from '@/state/parcelDraft';
import { colors, radii, space } from '@/theme';

/** Adresse saisie, suivie des précisions éventuelles. */
const fullAddress = (p: { address: string; details?: string }) => p.address + (p.details ? ` · ${p.details}` : '');

const STEP_ROUTES = {
  route: '/parcel/new/route',
  details: '/parcel/new/details',
  options: '/parcel/new/options',
  photos: '/parcel/new/photos',
} as const;

export default function ReviewStep() {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const { draft, editingId } = useParcelDraft();
  const { publish, pending } = usePublishParcel((fields) =>
    router.push(STEP_ROUTES[stepOfField(Object.keys(fields)[0]!)]),
  );

  const km = draft.pickup && draft.dropoff ? haversineKm(draft.pickup.location, draft.dropoff.location) : 0;

  return (
    <WizardFrame step="review" onNext={publish} loading={pending} nextLabel={editingId ? t('saveChanges') : t('publish')}>
      <ScrollView horizontal contentContainerStyle={styles.photos} showsHorizontalScrollIndicator={false}>
        {draft.photos.map((p) => (
          <Image key={p.publicId} source={{ uri: cdn(p.url, 300) }} style={styles.photo} contentFit="cover" />
        ))}
      </ScrollView>
      <AppText size="lg" weight="bold">
        {draft.title}
      </AppText>
      <SectionCard title={t('steps.route')}>
        <RouteAddresses
          stops={[
            { title: t('common:from'), address: draft.pickup ? fullAddress(draft.pickup) : '-' },
            { title: t('common:to'), address: draft.dropoff ? fullAddress(draft.dropoff) : '-' },
          ]}
        />
        <KeyValue label={t('common:distance')} value={distance(km)} />
      </SectionCard>
      <SectionCard title={t('characteristics')}>
        <KeyValue label={t('category')} value={draft.category ? t(`categories.${draft.category}`) : '-'} />
        <KeyValue label={t('weight')} value={draft.weightKg ? weight(draft.weightKg) : '-'} />
        <KeyValue
          label={t('dimensions')}
          value={`${draft.dimensionsCm.length} × ${draft.dimensionsCm.width} × ${draft.dimensionsCm.height} cm (${draftVolume(draft)} m³)`}
        />
        {draft.fragile && <KeyValue label={t('fragile')} value="✓" />}
        <KeyValue label={t('vehicleTypesLabel')} value={draft.vehicleTypes.map((v) => t(`vehicleTypes.${v}`)).join(', ')} />
      </SectionCard>
      <SectionCard title={t('steps.options')}>
        <KeyValue label={t('desiredDate')} value={draft.desiredDate ? `${formatDate(draft.desiredDate)} · ${draft.desiredTime ?? t(`common:timeSlots.${draft.timeSlot}`)}` : '-'} />
        {draft.flexibleDates && <KeyValue label={t('flexibleDates')} value="✓" />}
        {draft.urgent && <KeyValue label={t('urgent')} value="✓" />}
        {draft.recipientName ? <KeyValue label={t('recipient')} value={`${draft.recipientName} · ${draft.recipientPhone}`} /> : null}
        <KeyValue label={t('paymentArrangement')} value={draft.paymentArrangement ? t(`common:payment.${draft.paymentArrangement}`) : '-'} />
        <KeyValue
          label={t('requestedPrice')}
          value={
            <AppText weight="bold" color={colors.primary}>
              {draft.requestedPrice ? price(draft.requestedPrice) : '-'}
            </AppText>
          }
        />
      </SectionCard>
      {draft.description ? (
        <SectionCard title={t('description')}>
          <AppText size="sm">{draft.description}</AppText>
        </SectionCard>
      ) : null}
    </WizardFrame>
  );
}

const styles = StyleSheet.create({
  photos: { gap: space(2) },
  photo: { width: 120, height: 120, borderRadius: radii.input },
});
