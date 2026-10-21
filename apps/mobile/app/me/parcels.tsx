import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiFetch, errorMessage } from '@/api/client';
import { useMyParcels } from '@/api/queries';
import { Button } from '@/components/Button';
import { ParcelCard } from '@/components/ParcelCard';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { useSession } from '@/session/SessionContext';
import { newParcelRoute } from '@/state/parcelDraft';
import { space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const GROUPS = {
  active: 'open,negotiating,assigned,in_transit,delivered_pending,disputed',
  done: 'delivered,cancelled,expired',
} as const;

export default function MyParcels() {
  const { t } = useTranslation(['profile', 'parcel', 'offer', 'common']);
  const { user } = useSession();
  const [group, setGroup] = useState<keyof typeof GROUPS>('active');
  const query = useMyParcels(GROUPS[group]);
  const pull = usePullToRefresh(query.refetch);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  async function exportCsv() {
    try {
      const csv = await apiFetch<string>('/me/parcels/export');
      const { Share } = await import('react-native');
      await Share.share({ message: csv, title: 'historique-colis.csv' });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']} header={<ScreenHeader title={t('myParcels')} />}>
      <View style={{ paddingHorizontal: space(5), gap: space(3) }}>
        <Segmented
          value={group}
          onChange={setGroup}
          options={[
            { value: 'active', label: t('offer:tabs.active') },
            { value: 'done', label: t('offer:tabs.finished') },
          ]}
        />
        {user?.accountType === 'professional' && <Button label={t('exportCsv')} variant="outline" icon="download-outline" onPress={exportCsv} />}
      </View>
      <View style={{ flex: 1 }}>
        <QueryView
          query={{ ...query, data: items }}
          isEmpty={(d) => d.length === 0}
          empty={{ icon: 'cube-outline', title: t('parcel:noListings'), actionLabel: t('parcel:newTitle'), onAction: () => router.push(newParcelRoute()) }}
        >
          {(data) => (
            <FlashList
              data={data}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ padding: space(5) }}
              ItemSeparatorComponent={() => <View style={{ height: space(3) }} />}
              renderItem={({ item }) => <ParcelCard parcel={item} showStatus />}
              onEndReached={() => query.hasNextPage && query.fetchNextPage()}
              {...pull}
            />
          )}
        </QueryView>
      </View>
    </Screen>
  );
}
