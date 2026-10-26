// Offres reçues par l'expéditeur (F8) : tri par prix ou par note, accepter, refuser, contre-proposer.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ACTIVE_OFFER_STATUSES, type OfferDto } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { useParcel, useParcelOffers } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { OfferCard } from '@/components/OfferCard';
import { PriceProposalModal } from '@/components/PriceProposalModal';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { price } from '@/format';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useSocketEvent } from '@/realtime/socket';
import { colors, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function ParcelOffers() {
  const { t } = useTranslation(['offer', 'parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sort, setSort] = useState<'recent' | 'price' | 'rating'>('recent');
  const parcel = useParcel(id);
  const query = useParcelOffers(id, sort);
  const pull = usePullToRefresh(query.refetch);
  const config = useAppConfig();
  const qc = useQueryClient();
  const [countering, setCountering] = useState<OfferDto | null>(null);
  // Geste en cours (« action:offre ») : un seul à la fois, pour éviter les doubles envois.
  const [busy, setBusy] = useState<string | null>(null);
  const maxCounters = config.data?.limits.maxCounterOffers ?? 3;

  // Réponse du transporteur (nouveau prix, prix maintenu, retrait) : la liste se met à jour d'elle-même.
  useSocketEvent<{ parcelId: string }>('offer:updated', (e) => {
    if (e.parcelId === id) void query.refetch();
  });

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setBusy(null);
    }
  };

  const btn = (key: string) => ({ loading: busy === key, disabled: busy !== null && busy !== key });

  async function accept(o: OfferDto) {
    if (!(await confirm({ title: t('accept'), message: t('acceptConfirm', { price: price(o.price) }) }))) return;
    await run(`a:${o.id}`, async () => {
      await api.post(`/offers/${o.id}/accept`);
      router.replace({ pathname: '/parcel/[id]', params: { id } });
    });
  }

  async function reject(o: OfferDto) {
    if (!(await confirm({ title: t('rejectConfirm'), message: t('rejectConfirmMessage'), destructive: true }))) return;
    await run(`r:${o.id}`, () => api.post(`/offers/${o.id}/reject`));
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('offersFor', { title: parcel.data?.title ?? '' })} />} {...pull}>
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
              const rejectButton = (
                <Button label={t('reject')} variant="dangerGhost" icon="close" fullWidth={false} {...btn(`r:${o.id}`)} onPress={() => reject(o)} />
              );
              return (
                <OfferCard
                  key={o.id}
                  offer={o}
                  viewerIsSender
                  showRounds
                  actions={
                    o.status === 'pending' ? (
                      // Ligne 1 : les deux choix principaux ; ligne 2 : compteur de contre-offres et refus discret.
                      <View style={styles.actions}>
                        <View style={styles.row}>
                          {o.counterCount < maxCounters && (
                            <View style={styles.flex}>
                              <Button
                                label={t('counter')}
                                variant="outline"
                                icon="swap-horizontal-outline"
                                disabled={busy !== null}
                                onPress={() => setCountering(o)}
                              />
                            </View>
                          )}
                          <View style={styles.flex}>
                            <Button label={t('accept')} icon="checkmark" {...btn(`a:${o.id}`)} onPress={() => accept(o)} />
                          </View>
                        </View>
                        <View style={styles.footer}>
                          <AppText size="xs" color={colors.textMuted} style={styles.flex}>
                            {o.counterCount >= maxCounters ? t('counterLimit') : t('counterLeft', { count: maxCounters - o.counterCount })}
                          </AppText>
                          {rejectButton}
                        </View>
                      </View>
                    ) : active ? (
                      <View style={styles.footer}>
                        <AppText size="sm" color={colors.textMuted} style={styles.flex}>
                          {t('waitingCarrier')}
                        </AppText>
                        {rejectButton}
                      </View>
                    ) : undefined
                  }
                />
              );
            })}
          </View>
        )}
      </QueryView>
      <PriceProposalModal
        visible={countering !== null}
        title={t('counter')}
        message={
          countering
            ? `${t('carrierAsks', { price: price(countering.price) })} ${t('counterLeft', { count: maxCounters - countering.counterCount })}`
            : undefined
        }
        label={t('counterPrice')}
        below={countering?.price}
        confirmLabel={t('sendCounter')}
        onCancel={() => setCountering(null)}
        onConfirm={async (input) => {
          const o = countering!;
          setCountering(null);
          await run(`c:${o.id}`, () => api.post(`/offers/${o.id}/counter`, input));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { width: '100%', gap: space(2) },
  row: { flexDirection: 'row', gap: space(2) },
  footer: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
