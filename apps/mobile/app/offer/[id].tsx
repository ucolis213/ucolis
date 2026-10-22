// Détail d'une offre et négociation (F8). Transporteur : accepter la contre-offre, garder son prix,
// reproposer, retirer. Expéditeur : accepter, refuser, contre-proposer (3 au maximum).

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '@/api/client';
import { useOffer } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CommissionBreakdown, useWalletBlocked, WalletBlockedBanner } from '@/components/CommissionBreakdown';
import { confirm } from '@/components/ConfirmDialog';
import { OfferCard } from '@/components/OfferCard';
import { PromptModal } from '@/components/PromptModal';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { price } from '@/format';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useSocketEvent } from '@/realtime/socket';
import { colors, space } from '@/theme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

export default function OfferDetail() {
  const { t } = useTranslation(['offer', 'parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useOffer(id);
  const pull = usePullToRefresh(query.refetch);
  const qc = useQueryClient();
  const config = useAppConfig();
  const [prompt, setPrompt] = useState<'counter' | 'reoffer' | null>(null);
  const maxCounters = config.data?.limits.maxCounterOffers ?? 3;
  const blocked = useWalletBlocked();

  useSocketEvent<{ offerId: string }>('offer:updated', (e) => {
    if (e.offerId === id) void query.refetch();
  });

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: ['offer', id] });
      void qc.invalidateQueries({ queryKey: ['me', 'offers'] });
      if (query.data) void qc.invalidateQueries({ queryKey: ['parcel', query.data.parcelId] });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  };

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('title')} />} {...pull}>
      <QueryView query={query}>
        {(o) => {
          const sender = o.viewerIsSender;
          const actions: React.ReactNode[] = [];
          if (!sender && o.status === 'countered' && o.counterPrice) {
            actions.push(
              <Button key="ac" label={t('acceptCounter', { price: price(o.counterPrice) })} onPress={() => run(() => api.post(`/offers/${o.id}/accept-counter`))} />,
              <Button key="rc" label={t('rejectCounter')} variant="outline" onPress={() => run(() => api.post(`/offers/${o.id}/reject-counter`))} />,
              <Button key="ro" label={t('reoffer')} variant="outline" onPress={() => setPrompt('reoffer')} />,
            );
          }
          if (!sender && (o.status === 'pending' || o.status === 'countered')) {
            actions.push(
              <Button
                key="w"
                label={t('withdraw')}
                variant="ghost"
                onPress={async () => (await confirm({ title: t('withdrawConfirm'), destructive: true })) && run(() => api.post(`/offers/${o.id}/withdraw`))}
              />,
            );
          }
          if (sender && o.status === 'pending') {
            actions.push(
              <Button
                key="a"
                label={t('accept')}
                onPress={async () => (await confirm({ title: t('accept'), message: t('acceptConfirm', { price: price(o.price) }) })) && run(() => api.post(`/offers/${o.id}/accept`))}
              />,
            );
            if (o.counterCount < maxCounters) actions.push(<Button key="c" label={t('counter')} variant="outline" onPress={() => setPrompt('counter')} />);
            actions.push(<Button key="r" label={t('reject')} variant="ghost" onPress={() => run(() => api.post(`/offers/${o.id}/reject`))} />);
          }
          return (
            <View style={{ gap: space(4) }}>
              <AppText weight="bold" color={colors.primaryDark} onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: o.parcelId } })} accessibilityRole="link">
                {o.parcelTitle} · {price(o.parcelRequestedPrice)}
              </AppText>
              <OfferCard offer={o} viewerIsSender={sender} showRounds />
              {!sender && blocked && (o.status === 'pending' || o.status === 'countered') && <WalletBlockedBanner />}
              {!sender && <CommissionBreakdown grossPrice={o.finalPrice ?? o.counterPrice ?? o.price} />}
              {sender && o.status === 'pending' && o.counterCount >= maxCounters && (
                <AppText size="sm" color={colors.textMuted}>
                  {t('counterLimit')}
                </AppText>
              )}
              {sender && o.status === 'pending' && o.counterCount < maxCounters && (
                <AppText size="sm" color={colors.textMuted}>
                  {t('counterLeft', { count: maxCounters - o.counterCount })}
                </AppText>
              )}
              {actions}
              {o.status === 'accepted' && (
                <Button label={t('parcel:actions.message')} variant="outline" icon="chatbubble-outline" onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: o.parcelId } })} />
              )}
              <PromptModal
                visible={prompt !== null}
                title={prompt === 'counter' ? t('counter') : t('reoffer')}
                label={prompt === 'counter' ? t('counterPrice') : t('price')}
                required
                inputProps={{ keyboardType: 'number-pad' }}
                onCancel={() => setPrompt(null)}
                onConfirm={async (v) => {
                  const kind = prompt;
                  setPrompt(null);
                  await run(() => api.post(`/offers/${o.id}/${kind === 'counter' ? 'counter' : 'reoffer'}`, { price: Number(v.replace(/\D/g, '')) }));
                }}
              />
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}
