// Faire une offre (F8) : au prix demandé en un geste, ou prix proposé avec message, véhicule et date d'enlèvement.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_PRICE_DA } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { useParcel } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { CommissionBreakdown, useWalletBlocked, WalletBlockedBanner } from '@/components/CommissionBreakdown';
import { DateSelect, PriceInput, SectionCard } from '@/components/FormBits';
import { LoadingSkeleton } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/States';
import { TextField } from '@/components/TextField';
import { price } from '@/format';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';

export default function MakeOffer() {
  const { t } = useTranslation(['offer', 'parcel', 'common', 'errors']);
  const { id, asking } = useLocalSearchParams<{ id: string; asking?: string }>();
  const { user } = useSession();
  const parcel = useParcel(id);
  const qc = useQueryClient();
  const atAsking = asking === '1';
  const compatible = useMemo(
    () => (user?.vehicles ?? []).filter((v) => parcel.data?.vehicleTypes.includes(v.type)),
    [user, parcel.data],
  );
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const blocked = useWalletBlocked();

  if (parcel.isPending || !parcel.data) {
    return (
      <Screen header={<ScreenHeader title={t('parcel:actions.make_offer')} />}>
        <LoadingSkeleton />
      </Screen>
    );
  }
  const p = parcel.data;
  const selectedVehicle = vehicleId ?? compatible.find((v) => v.isDefault)?.id ?? compatible[0]?.id ?? null;

  if (!user?.vehicles.length || !compatible.length) {
    return (
      <Screen edges={['top', 'bottom']} header={<ScreenHeader title={t('parcel:actions.make_offer')} />}>
        <EmptyState
          icon="car-outline"
          title={user?.vehicles.length ? t('noVehicleMatch') : t('needVehicle')}
          actionLabel={t('profile:addVehicle')}
          onAction={() => router.push('/me/vehicles')}
        />
      </Screen>
    );
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (!atAsking && (!offerPrice || offerPrice < MIN_PRICE_DA)) e.price = 'validation.minPrice';
    if (!pickupDate) e.proposedPickupDate = 'validation.required';
    setErrors(e);
    if (Object.keys(e).length) return;
    setPending(true);
    try {
      const offer = await api.post<{ id: string }>(`/parcels/${id}/offers`, {
        ...(atAsking ? { atAskingPrice: true } : { price: offerPrice }),
        vehicleId: selectedVehicle,
        proposedPickupDate: pickupDate!.toISOString(),
        message: message.trim() || undefined,
      });
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
      void qc.invalidateQueries({ queryKey: ['me', 'offers'] });
      Alert.alert(t('sent'));
      router.replace({ pathname: '/offer/[id]', params: { id: offer.id } });
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (!Object.keys(fields).length) Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={atAsking ? t('parcel:actions.accept_asking_price') : t('parcel:actions.make_offer')} />}
      footer={<Button label={t('send')} onPress={submit} loading={pending} disabled={blocked} />}
    >
      <SectionCard>
        <AppText weight="bold">{p.title}</AppText>
        <AppText size="sm" color={colors.textMuted}>
          {t('parcel:requestedPrice')} : {price(p.requestedPrice)}
        </AppText>
      </SectionCard>
      {blocked && <WalletBlockedBanner />}
      {atAsking ? (
        <AppText size="xl" weight="bold" color={colors.primary}>
          {price(p.requestedPrice)}
        </AppText>
      ) : (
        <PriceInput label={t('price')} value={offerPrice} onChange={setOfferPrice} error={errors.price} hint={`≥ ${price(MIN_PRICE_DA)}`} />
      )}
      <CommissionBreakdown grossPrice={atAsking ? p.requestedPrice : offerPrice} />
      <AppText weight="semibold">{t('vehicle')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {compatible.map((v) => (
          <Chip key={v.id} label={`${t(`parcel:vehicleTypes.${v.type}`)} · ${v.brand} ${v.model}`} selected={selectedVehicle === v.id} onPress={() => setVehicleId(v.id)} />
        ))}
      </View>
      <DateSelect label={t('pickupDate')} value={pickupDate} onChange={setPickupDate} error={errors.proposedPickupDate} />
      <TextField label={t('message')} value={message} onChangeText={setMessage} multiline maxLength={500} style={{ minHeight: 80, textAlignVertical: 'top' }} />
    </Screen>
  );
}
