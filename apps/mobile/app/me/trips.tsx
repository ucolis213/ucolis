import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyTrips } from '@/api/queries';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TripCard } from '@/components/TripCard';
import { space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function MyTrips() {
  const { t } = useTranslation(['profile', 'trip']);
  const query = useMyTrips();
  const pull = usePullToRefresh(query.refetch);
  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('myTrips')} />} {...pull}>
      <QueryView
        query={query}
        isEmpty={(d) => d.items.length === 0}
        empty={{ icon: 'car-outline', title: t('trip:noTrips'), actionLabel: t('trip:newTitle'), onAction: () => router.push('/trip/new') }}
      >
        {(d) => (
          <View style={{ gap: space(3) }}>
            {d.items.map((trip) => (
              <TripCard key={trip.id} trip={trip} showStatus />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
