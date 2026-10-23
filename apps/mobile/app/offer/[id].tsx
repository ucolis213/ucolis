// Détail d'une offre et négociation (F8). Transporteur : accepter la contre-offre, garder son prix,
// reproposer, retirer. Expéditeur : accepter, refuser, contre-proposer (3 au maximum).

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '@/api/client';
import { useOffer } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CommissionBreakdown, useWalletBlocked, WalletBlockedBanner } from '@/components/CommissionBreakdown';
import { confirm } from '@/components/ConfirmDialog';
import { OfferCard } from '@/components/OfferCard';
import { PriceProposalModal } from '@/components/PriceProposalModal';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { price } from '@/format';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useSocketEvent } from '@/realtime/socket';
import { colors, radii, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function OfferDetail() {
  const { t } = useTranslation(['offer', 'parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useOffer(id);
  const pull = usePullToRefresh(query.refetch);
  const qc = useQueryClient();
  const config = useAppConfig();
  const [prompt, setPrompt] = useState<'counter' | 'reoffer' | null>(null);
  // Geste en cours : un seul à la fois, pour éviter les doubles envois.
  const [busy, setBusy] = useState<string | null>(null);
  const maxCounters = config.data?.limits.maxCounterOffers ?? 3;
  const blocked = useWalletBlocked();

  useSocketEvent<{ offerId: string }>('offer:updated', (e) => {
    if (e.offerId === id) void query.refetch();
  });

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: ['offer', id] });
      void qc.invalidateQueries({ queryKey: ['me', 'offers'] });
      if (query.data) void qc.invalidateQueries({ queryKey: ['parcel', query.data.parcelId] });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('title')} />} {...pull}>
      <QueryView query={query}>
        {(o) => {
          const sender = o.viewerIsSender;
          const active = o.status === 'pending' || o.status === 'countered';
          const btn = (key: string) => ({ loading: busy === key, disabled: busy !== null && busy !== key });
          const actions: React.ReactNode[] = [];
          if (!sender && o.status === 'countered' && o.counterPrice) {
            const counterPrice = o.counterPrice;
            actions.push(
              <Button
                key="ac"
                label={t('acceptCounter', { price: price(counterPrice) })}
                icon="checkmark-circle-outline"
                {...btn('ac')}
                disabled={blocked || (busy !== null && busy !== 'ac')}
                onPress={async () =>
                  (await confirm({ title: t('acceptCounter', { price: price(counterPrice) }), message: t('acceptCounterConfirm', { price: price(counterPrice) }) })) &&
                  run('ac', () => api.post(`/offers/${o.id}/accept-counter`))
                }
              />,
              <Button
                key="ro"
                label={t('reoffer')}
                variant="outline"
                icon="swap-horizontal-outline"
                disabled={blocked || busy !== null}
                onPress={() => setPrompt('reoffer')}
              />,
              <Button key="rc" label={t('rejectCounter', { price: price(o.price) })} variant="outline" {...btn('rc')} onPress={() => run('rc', () => api.post(`/offers/${o.id}/reject-counter`))} />,
            );
          }
          if (!sender && active) {
            actions.push(
              <Button
                key="w"
                label={t('withdraw')}
                variant="ghost"
                {...btn('w')}
                onPress={async () => (await confirm({ title: t('withdrawConfirm'), destructive: true })) && run('w', () => api.post(`/offers/${o.id}/withdraw`))}
              />,
            );
          }
          if (sender && o.status === 'pending') {
            actions.push(
              <Button
                key="a"
                label={t('accept')}
                icon="checkmark-circle-outline"
                {...btn('a')}
                onPress={async () => (await confirm({ title: t('accept'), message: t('acceptConfirm', { price: price(o.price) }) })) && run('a', () => api.post(`/offers/${o.id}/accept`))}
              />,
            );
            if (o.counterCount < maxCounters) {
              actions.push(<Button key="c" label={t('counter')} variant="outline" icon="swap-horizontal-outline" disabled={busy !== null} onPress={() => setPrompt('counter')} />);
            }
          }
          if (sender && active) {
            actions.push(
              <Button
                key="r"
                label={t('reject')}
                variant="ghost"
                {...btn('r')}
                onPress={async () =>
                  (await confirm({ title: t('rejectConfirm'), message: t('rejectConfirmMessage'), destructive: true })) && run('r', () => api.post(`/offers/${o.id}/reject`))
                }
              />,
            );
          }
          return (
            <View style={{ gap: space(4) }}>
              <AppText weight="bold" color={colors.primaryDark} onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: o.parcelId } })} accessibilityRole="link">
                {o.parcelTitle} · {price(o.parcelRequestedPrice)}
              </AppText>
              <OfferCard offer={o} viewerIsSender={sender} showRounds />
              {!sender && o.status === 'countered' && o.counterPrice && (
                <View style={styles.callout}>
                  <AppText weight="bold">{t('counterReceived', { price: price(o.counterPrice) })}</AppText>
                  <AppText size="sm" color={colors.textMuted}>
                    {t('yourPrice', { price: price(o.price) })}
                  </AppText>
                </View>
              )}
              {((sender && o.status === 'countered') || (!sender && o.status === 'pending')) && (
                <AppText size="sm" color={colors.textMuted}>
                  {t(sender ? 'waitingCarrier' : 'waitingSender')}
                </AppText>
              )}
              {!sender && blocked && active && <WalletBlockedBanner />}
              {!sender && <CommissionBreakdown grossPrice={o.finalPrice ?? o.counterPrice ?? o.price} />}
              {sender && o.status === 'pending' && (
                <AppText size="sm" color={colors.textMuted}>
                  {o.counterCount >= maxCounters ? t('counterLimit') : t('counterLeft', { count: maxCounters - o.counterCount })}
                </AppText>
              )}
              {actions}
              {o.status === 'accepted' && (
                <Button label={t('parcel:actions.message')} variant="outline" icon="chatbubble-outline" onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: o.parcelId } })} />
              )}
              <PriceProposalModal
                visible={prompt !== null}
                title={prompt === 'counter' ? t('counter') : t('reoffer')}
                message={
                  prompt === 'counter'
                    ? `${t('carrierAsks', { price: price(o.price) })} ${t('counterLeft', { count: maxCounters - o.counterCount })}`
                    : o.counterPrice
                      ? t('counterReceived', { price: price(o.counterPrice) })
                      : undefined
                }
                label={prompt === 'counter' ? t('counterPrice') : t('price')}
                below={prompt === 'counter' ? o.price : undefined}
                above={prompt === 'reoffer' ? (o.counterPrice ?? undefined) : undefined}
                confirmLabel={prompt === 'counter' ? t('sendCounter') : t('sendReoffer')}
                onCancel={() => setPrompt(null)}
                onConfirm={async (input) => {
                  const kind = prompt;
                  setPrompt(null);
                  await run(kind!, () => api.post(`/offers/${o.id}/${kind === 'counter' ? 'counter' : 'reoffer'}`, input));
                }}
              />
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  callout: { backgroundColor: colors.primarySoft, borderRadius: radii.card, padding: space(4), gap: space(1) },
});
