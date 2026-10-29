// Mon portefeuille : solde (rouge si négatif), état de la commission, recharge et historique des opérations.

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WalletDto, WalletTransactionDto } from '@ucolis/shared';
import { useWallet, useWalletTransactions } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CommissionGridModal, useCommission } from '@/components/CommissionBreakdown';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatDate, formatDateTime, price } from '@/format';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { colors, radii, shadow, space } from '@/theme';

const SUCCESS = colors.accentDark;

export default function Wallet() {
  const { t } = useTranslation(['wallet', 'common']);
  const wallet = useWallet();
  const history = useWalletTransactions();
  const pull = usePullToRefresh(() => Promise.all([wallet.refetch(), history.refetch()]));
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen padded={false} edges={['top', 'bottom']} header={<ScreenHeader title={t('title')} />}>
      <QueryView query={wallet}>
        {(w) => (
          <FlashList
            data={w.enabled && w.eligible ? items : []}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: space(5) }}
            ListHeaderComponent={<Summary wallet={w} hasHistory={items.length > 0} />}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => <TransactionRow tx={item} />}
            onEndReached={() => history.hasNextPage && history.fetchNextPage()}
            {...pull}
          />
        )}
      </QueryView>
    </Screen>
  );
}

function Notice({ icon, text, tone = 'muted' }: { icon: keyof typeof Ionicons.glyphMap; text: string; tone?: 'muted' | 'danger' }) {
  const fg = tone === 'danger' ? colors.danger : colors.navy;
  return (
    <View style={[styles.notice, { backgroundColor: tone === 'danger' ? colors.dangerSoft : colors.surface }]}>
      <Ionicons name={icon} size={20} color={fg} />
      <AppText size="sm" color={fg} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

function Summary({ wallet: w, hasHistory }: { wallet: WalletDto; hasHistory: boolean }) {
  const { t } = useTranslation(['wallet', 'common']);
  const settings = useCommission();
  const [gridOpen, setGridOpen] = useState(false);

  if (!w.enabled) return <Notice icon="gift-outline" text={t('free')} />;
  if (!w.eligible) return <Notice icon="shield-checkmark-outline" text={t('notEligible')} />;

  return (
    <View style={styles.summary}>
      <View style={styles.balanceCard}>
        <AppText size="sm" color={colors.textMuted}>
          {t('balance')}
        </AppText>
        <AppText size="xxl" weight="bold" color={w.balance < 0 ? colors.danger : SUCCESS} accessibilityLiveRegion="polite">
          {price(w.balance)}
        </AppText>
        <Button
          label={t('topUp')}
          icon="add-circle-outline"
          disabled={!!w.pendingTopUp}
          onPress={() => router.push('/me/wallet-topup')}
        />
      </View>
      {w.blocked && <Notice icon="alert-circle-outline" text={t('blocked')} tone="danger" />}
      {w.pendingTopUp && <Notice icon="hourglass-outline" text={t('pending', { amount: price(w.pendingTopUp.amount) })} />}
      {!w.active && w.effectiveFrom && <Notice icon="calendar-outline" text={t('announced', { date: formatDate(w.effectiveFrom) })} />}
      <View style={styles.links}>
        {settings && <Button label={t('grid.title')} variant="ghost" icon="information-circle-outline" onPress={() => setGridOpen(true)} />}
        <Button label={t('myTopUps')} variant="ghost" icon="receipt-outline" onPress={() => router.push('/me/wallet-topup')} />
      </View>
      <AppText weight="bold">{t('history')}</AppText>
      {!hasHistory && (
        <AppText size="sm" color={colors.textMuted}>
          {t('noTransactions')}
        </AppText>
      )}
      {settings && <CommissionGridModal visible={gridOpen} settings={settings} onClose={() => setGridOpen(false)} />}
    </View>
  );
}

function TransactionRow({ tx }: { tx: WalletTransactionDto }) {
  const { t } = useTranslation('wallet');
  const credit = tx.amount >= 0;
  const open = tx.parcel ? () => router.push({ pathname: '/parcel/[id]', params: { id: tx.parcel!.id } }) : undefined;
  return (
    <View style={styles.tx}>
      <Ionicons name={credit ? 'arrow-down-circle' : 'arrow-up-circle'} size={28} color={credit ? SUCCESS : colors.danger} />
      <View style={styles.flex}>
        <AppText size="sm" weight="semibold">
          {t(`types.${tx.type}`)}
        </AppText>
        {tx.parcel && (
          <AppText size="xs" color={colors.primaryDark} onPress={open} accessibilityRole="link">
            {t('parcelRef', { reference: tx.parcel.reference })}
          </AppText>
        )}
        {!tx.parcel && tx.note && (
          <AppText size="xs" color={colors.textMuted}>
            {tx.note}
          </AppText>
        )}
        <AppText size="xs" color={colors.textMuted}>
          {formatDateTime(tx.createdAt)}
        </AppText>
      </View>
      <View style={styles.amount}>
        <AppText weight="bold" color={credit ? SUCCESS : colors.danger}>
          {`${credit ? '+' : '-'} ${price(Math.abs(tx.amount))}`}
        </AppText>
        <AppText size="xs" color={colors.textMuted}>
          {t('balanceAfter', { balance: price(tx.balanceAfter) })}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { gap: space(4), marginBottom: space(3) },
  balanceCard: { gap: space(2), padding: space(5), borderRadius: radii.card, backgroundColor: colors.surface, ...shadow },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radii.card },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  separator: { height: space(2) },
  tx: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radii.card, backgroundColor: colors.surface },
  amount: { alignItems: 'flex-end' },
});
