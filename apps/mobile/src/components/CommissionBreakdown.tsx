// Ventilation des gains du transporteur (prix convenu, frais de dossier, commission, gains nets) et
// fenêtre expliquant la grille. Rien ne s'affiche tant que la commission n'est pas activée.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  commissionBreakdown,
  commissionTierRanges,
  type CommissionBreakdown as Breakdown,
  type CommissionSettings,
  type ParcelCommissionStatus,
} from '@ucolis/shared';
import { useWallet } from '../api/queries';
import { formatDate, price } from '../format';
import { useAppConfig } from '../hooks/useAppConfig';
import { colors, MIN_TOUCH, radii, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { AppModal } from '@/components/AppModal';

const SUCCESS = colors.accentDark;

/** Réglage de la commission s'il est activé, sinon null (service gratuit). */
export function useCommission(): CommissionSettings | null {
  const config = useAppConfig();
  const commission = config.data?.commission;
  return commission?.enabled ? commission : null;
}

/** Solde sous le seuil : plus d'offre ni de course (l'API refuse aussi, en 422). */
export function useWalletBlocked(): boolean {
  const commission = useCommission();
  const wallet = useWallet(!!commission);
  return !!commission && !!wallet.data?.blocked;
}

export function WalletBlockedBanner() {
  const { t } = useTranslation('wallet');
  return (
    <View style={styles.blocked} accessibilityRole="alert">
      <View style={styles.row}>
        <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
        <AppText size="sm" weight="medium" color={colors.danger} style={styles.flex}>
          {t('blocked')}
        </AppText>
      </View>
      <Button label={t('topUp')} variant="outline" icon="wallet-outline" onPress={() => router.push('/me/wallet')} />
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText size={strong ? 'md' : 'sm'} weight={strong ? 'bold' : 'regular'} color={strong ? SUCCESS : colors.textMuted} style={styles.flex}>
        {label}
      </AppText>
      <AppText size={strong ? 'lg' : 'sm'} weight={strong ? 'bold' : 'medium'} color={strong ? SUCCESS : colors.navy}>
        {value}
      </AppText>
    </View>
  );
}

/**
 * Ventilation pour un prix donné (calculée avec la grille en vigueur), ou figée sur le colis à
 * l'acceptation (`frozen`, qui fait foi).
 */
export function CommissionBreakdown({
  grossPrice,
  frozen,
}: {
  grossPrice: number | null;
  frozen?: (Breakdown & { status: ParcelCommissionStatus; chargedAt: string | null }) | null;
}) {
  const { t } = useTranslation('wallet');
  const settings = useCommission();
  const [gridOpen, setGridOpen] = useState(false);
  if (!frozen && (!settings || !grossPrice)) return null;
  const b = frozen ?? commissionBreakdown(grossPrice!, settings!);
  const note = frozen ? t(`breakdown.${frozen.status}`, { date: frozen.chargedAt ? formatDate(frozen.chargedAt) : '' }) : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText weight="bold" style={styles.flex}>
          {t('breakdown.title')}
        </AppText>
        {settings && (
          <Pressable onPress={() => setGridOpen(true)} hitSlop={8} style={styles.info} accessibilityRole="button" accessibilityLabel={t('info')}>
            <Ionicons name="information-circle-outline" size={22} color={colors.primaryDark} />
          </Pressable>
        )}
      </View>
      <Row label={t('breakdown.gross')} value={price(b.grossPrice)} />
      <Row label={t('breakdown.fixedFee')} value={`- ${price(b.fixedFee)}`} />
      <Row label={t('breakdown.commission', { rate: b.ratePercent })} value={`- ${price(b.variableCommission)}`} />
      <View style={styles.divider} />
      <View style={styles.net}>
        <Row label={t('breakdown.net')} value={price(b.netEarnings)} strong />
      </View>
      {note && (
        <AppText size="xs" color={colors.textMuted}>
          {note}
        </AppText>
      )}
      {settings && <CommissionGridModal visible={gridOpen} settings={settings} onClose={() => setGridOpen(false)} />}
    </View>
  );
}

export function CommissionGridModal({ visible, settings, onClose }: { visible: boolean; settings: CommissionSettings; onClose: () => void }) {
  const { t } = useTranslation('wallet');
  const ranges = commissionTierRanges(settings.tiers);
  const rangeLabel = (r: (typeof ranges)[number]) => {
    if (r.from === null && r.upTo !== null) return t('grid.below', { amount: price(r.upTo + 1) });
    if (r.upTo === null) return t('grid.above', { amount: price((r.from ?? 1) - 1) });
    return t('grid.between', { from: price(r.from!), to: price(r.upTo) });
  };
  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <ScrollView contentContainerStyle={{ gap: space(4) }}>
            <AppText size="lg" weight="bold">
              {t('grid.title')}
            </AppText>
            <AppText size="sm" color={colors.textMuted}>
              {t('grid.intro', { fee: price(settings.fixedFee) })}
            </AppText>
            <View style={styles.table}>
              {ranges.map((r, i) => (
                <View key={i} style={[styles.tableRow, i > 0 && styles.tableBorder]}>
                  <AppText size="sm" style={styles.flex}>
                    {rangeLabel(r)}
                  </AppText>
                  <AppText size="sm" weight="bold" color={colors.primaryDark}>
                    {`${r.ratePercent} %`}
                  </AppText>
                </View>
              ))}
            </View>
            <AppText size="sm" color={colors.textMuted}>
              {t('grid.footer', { min: price(settings.minBalance) })}
            </AppText>
            <Button label={t('close')} variant="outline" onPress={onClose} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: space(2), padding: space(4), borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH - 8 },
  info: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginEnd: -space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  blocked: { gap: space(3), padding: space(4), borderRadius: radii.card, backgroundColor: colors.dangerSoft },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space(1) },
  net: { backgroundColor: colors.accentSoft, borderRadius: radii.input, paddingHorizontal: space(3), paddingVertical: space(2) },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,28,46,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radii.card * 2, borderTopRightRadius: radii.card * 2, padding: space(5) },
  table: { borderRadius: radii.input, borderWidth: 1, borderColor: colors.border },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(3), paddingVertical: space(3) },
  tableBorder: { borderTopWidth: 1, borderTopColor: colors.border },
});
