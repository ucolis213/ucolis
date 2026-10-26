// Mes livraisons : colis envoyés en cours, et colis que je transporte (offres acceptées).

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyOffers, useMyParcels } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { SectionCard } from '@/components/FormBits';
import { ParcelCard } from '@/components/ParcelCard';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { placeLabel, price } from '@/format';
import { colors, routeArrow, space } from '@/theme';

export default function MyDeliveries() {
  const { t } = useTranslation(['profile', 'common']);
  const [side, setSide] = useState<'sender' | 'carrier'>('sender');
  const sent = useMyParcels('assigned,in_transit,delivered_pending,disputed,delivered');
  const carried = useMyOffers('accepted');
  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('deliveriesTitle')} />}>
      <Segmented
        value={side}
        onChange={setSide}
        options={[
          { value: 'sender', label: t('asSender') },
          { value: 'carrier', label: t('asCarrier') },
        ]}
      />
      {side === 'sender' ? (
        <QueryView query={{ ...sent, data: sent.data?.pages.flatMap((p) => p.items) }} isEmpty={(d) => d.length === 0} empty={{ icon: 'cube-outline', title: t('common:emptyTitle') }}>
          {(items) => (
            <View style={{ gap: space(3) }}>
              {items.map((p) => (
                <ParcelCard key={p.id} parcel={p} showStatus />
              ))}
            </View>
          )}
        </QueryView>
      ) : (
        <QueryView query={{ ...carried, data: carried.data?.pages.flatMap((p) => p.items) }} isEmpty={(d) => d.length === 0} empty={{ icon: 'car-outline', title: t('common:emptyTitle') }}>
          {(items) => (
            <View style={{ gap: space(3) }}>
              {items.map((o) =>
                o.parcel ? (
                  <Pressable key={o.id} onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: o.parcel!.id } })} accessibilityRole="button">
                    <SectionCard>
                      <AppText weight="bold">{o.parcel.title}</AppText>
                      <AppText size="sm" color={colors.textMuted}>
                        {placeLabel(o.parcel.from)} {routeArrow()} {placeLabel(o.parcel.to)}
                      </AppText>
                      <AppText size="sm" weight="semibold">
                        {t(`common:parcelStatus.${o.parcel.status}`)} · {price(o.finalPrice ?? o.price)}
                      </AppText>
                    </SectionCard>
                  </Pressable>
                ) : null,
              )}
            </View>
          )}
        </QueryView>
      )}
    </Screen>
  );
}
