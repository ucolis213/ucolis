import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useFavorites } from '@/api/queries';
import { ParcelCard } from '@/components/ParcelCard';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { space } from '@/theme';

export default function Favorites() {
  const { t } = useTranslation('profile');
  const query = useFavorites();
  const qc = useQueryClient();
  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('favorites')} />} onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty={{ icon: 'heart-outline', title: t('favoritesEmpty') }}>
        {(d) => (
          <View style={{ gap: space(3) }}>
            {d.items.map((p) => (
              <ParcelCard
                key={p.id}
                parcel={p}
                showStatus
                onToggleFavorite={async () => {
                  await api.delete(`/me/favorites/${p.id}`);
                  void qc.invalidateQueries({ queryKey: ['me', 'favorites'] });
                  void qc.invalidateQueries({ queryKey: ['parcels'] });
                }}
              />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
