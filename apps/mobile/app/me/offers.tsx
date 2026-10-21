// Mes offres (F8) : onglets Actives, Acceptées, Terminées, avec statut et dernier prix.

import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MY_OFFER_TABS, type MyOfferTab } from '@ucolis/shared';
import { useMyOffers } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { OfferCard } from '@/components/OfferCard';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { placeLabel } from '@/format';
import { colors, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function MyOffers() {
  const { t } = useTranslation(['offer', 'profile']);
  const [tab, setTab] = useState<MyOfferTab>('active');
  const query = useMyOffers(tab);
  const pull = usePullToRefresh(query.refetch);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen padded={false} edges={['top', 'bottom']} header={<ScreenHeader title={t('profile:myOffers')} />}>
      <View style={{ paddingHorizontal: space(5) }}>
        <Segmented value={tab} onChange={setTab} options={MY_OFFER_TABS.map((v) => ({ value: v, label: t(`tabs.${v}`) }))} />
      </View>
      <View style={{ flex: 1 }}>
        <QueryView query={{ ...query, data: items }} isEmpty={(d) => d.length === 0} empty={{ icon: 'pricetag-outline', title: t('profile:myOffers') }}>
          {(data) => (
            <FlashList
              data={data}
              keyExtractor={(o) => o.id}
              contentContainerStyle={{ padding: space(5) }}
              ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
              onEndReached={() => query.hasNextPage && query.fetchNextPage()}
              {...pull}
              renderItem={({ item }) => (
                <Pressable onPress={() => router.push({ pathname: '/offer/[id]', params: { id: item.id } })} accessibilityRole="button">
                  {item.parcel && (
                    <AppText size="sm" weight="semibold" color={colors.primaryDark} style={{ marginBottom: space(1) }}>
                      {item.parcel.title} · {placeLabel(item.parcel.from)} → {placeLabel(item.parcel.to)}
                    </AppText>
                  )}
                  <OfferCard offer={item} viewerIsSender={false} />
                </Pressable>
              )}
            />
          )}
        </QueryView>
      </View>
    </Screen>
  );
}
