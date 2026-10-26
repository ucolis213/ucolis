// Alertes (F10) : liste, activer ou désactiver, appliquer aux annonces, supprimer.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SavedSearchDto } from '@ucolis/shared';
import { api } from '@/api/client';
import { useSavedSearches } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { SectionCard } from '@/components/FormBits';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { wilayaName } from '@/format';
import { useFilters, type ParcelFilters, type TripFilters } from '@/state/filters';
import { colors, routeArrow, space } from '@/theme';

export default function Alerts() {
  const { t } = useTranslation(['profile', 'common', 'trip']);
  const query = useSavedSearches();
  const qc = useQueryClient();
  const filters = useFilters();
  const refresh = () => qc.invalidateQueries({ queryKey: ['me', 'saved-searches'] });

  const apply = (a: SavedSearchDto) => {
    filters.setScope(a.scope);
    if (a.scope === 'parcels') {
      filters.resetParcels();
      filters.setParcels(a.filters as Partial<ParcelFilters>);
    } else {
      filters.resetTrips();
      filters.setTrips(a.filters as Partial<TripFilters>);
    }
    router.push('/listings');
  };

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('alerts')} />}>
      <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty={{ icon: 'notifications-outline', title: t('alertsEmpty') }}>
        {(d) => (
          <View style={{ gap: space(3) }}>
            {d.items.map((a) => {
              const f = a.filters as { fromWilaya?: string; toWilaya?: string };
              return (
                <SectionCard
                  key={a.id}
                  title={a.name}
                  right={
                    <Switch
                      value={a.notify}
                      onValueChange={async (notify) => {
                        await api.patch(`/me/saved-searches/${a.id}`, { notify });
                        void refresh();
                      }}
                      trackColor={{ true: colors.primary, false: colors.border }}
                      accessibilityLabel={a.name}
                    />
                  }
                >
                  <AppText size="sm" color={colors.textMuted}>
                    {t(`trip:${a.scope}`)} · {[f.fromWilaya && wilayaName(f.fromWilaya), f.toWilaya && wilayaName(f.toWilaya)].filter(Boolean).join(` ${routeArrow()} `)}
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: space(2) }}>
                    <Button label={t('common:apply')} variant="outline" fullWidth={false} onPress={() => apply(a)} />
                    <Button
                      label={t('common:delete')}
                      variant="ghost"
                      fullWidth={false}
                      onPress={async () => {
                        if (await confirm({ title: t('common:delete'), message: a.name, destructive: true })) {
                          await api.delete(`/me/saved-searches/${a.id}`);
                          void refresh();
                        }
                      }}
                    />
                  </View>
                </SectionCard>
              );
            })}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
