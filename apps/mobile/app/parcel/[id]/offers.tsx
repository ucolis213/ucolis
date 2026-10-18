// Offres reçues par l'expéditeur (F8) : tri par prix ou par note, accepter, refuser, contre-proposer.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACTIVE_OFFER_STATUSES, type OfferDto } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { useParcel, useParcelOffers } from '@/api/queries';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { OfferCard } from '@/components/OfferCard';
import { PromptModal } from '@/components/PromptModal';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { price } from '@/format';
import { useAppConfig } from '@/hooks/useAppConfig';
import { space } from '@/theme';

export default function ParcelOffers() {
  const { t } = useTranslation(['offer', 'parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sort, setSort] = useState<'recent' | 'price' | 'rating'>('recent');
  const parcel = useParcel(id);
  const query = useParcelOffers(id, sort);
  const config = useAppConfig();
  const qc = useQueryClient();
  const [countering, setCountering] = useState<OfferDto | null>(null);
  const maxCounters = config.data?.limits.maxCounterOffers ?? 3;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  };

  async function accept(o: OfferDto) {
    if (!(await confirm({ title: t('accept'), message: t('acceptConfirm', { price: price(o.price) }) }))) return;
    await run(async () => {
      await api.post(`/offers/${o.id}/accept`);
      router.replace({ pathname: '/parcel/[id]', params: { id } });
    });
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('offersFor', { title: parcel.data?.title ?? '' })} />} onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <Segmented
        value={sort}
        onChange={setSort}
        options={[
          { value: 'recent', label: t('sortRecent') },
          { value: 'price', label: t('sortPrice') },
          { value: 'rating', label: t('sortRating') },
        ]}
      />
      <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty={{ icon: 'pricetag-outline', title: t('parcel:noOffers') }}>
        {(data) => (
          <View style={{ gap: space(3) }}>
            {data.items.map((o) => {
              const active = ACTIVE_OFFER_STATUSES.includes(o.status);
              return (
                <OfferCard
                  key={o.id}
                  offer={o}
                  viewerIsSender
                  showRounds
                  actions={
                    o.status === 'pending' ? (
                      <>
                        <View style={{ flex: 1 }}>
                          <Button label={t('accept')} onPress={() => accept(o)} />
                        </View>
                        {o.counterCount < maxCounters && (
                          <View style={{ flex: 1 }}>
                            <Button label={t('counter')} variant="outline" onPress={() => setCountering(o)} />
                          </View>
                        )}
                        <Button label={t('reject')} variant="ghost" fullWidth={false} onPress={() => run(() => api.post(`/offers/${o.id}/reject`))} />
                      </>
                    ) : active ? (
                      <Button label={t('reject')} variant="ghost" fullWidth={false} onPress={() => run(() => api.post(`/offers/${o.id}/reject`))} />
                    ) : undefined
                  }
                />
              );
            })}
          </View>
        )}
      </QueryView>
      <PromptModal
        visible={countering !== null}
        title={t('counter')}
        message={countering ? t('counterLeft', { count: maxCounters - countering.counterCount }) : undefined}
        label={t('counterPrice')}
        required
        inputProps={{ keyboardType: 'number-pad' }}
        onCancel={() => setCountering(null)}
        onConfirm={async (value) => {
          const o = countering!;
          setCountering(null);
          await run(() => api.post(`/offers/${o.id}/counter`, { price: Number(value.replace(/\D/g, '')) }));
        }}
      />
    </Screen>
  );
}
