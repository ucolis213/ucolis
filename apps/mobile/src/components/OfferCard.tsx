import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { OfferDto } from '@ucolis/shared';
import { formatDate, formatDateTime, price } from '../format';
import { colors, radii, shadow, space } from '../theme';
import { AppText } from './AppText';
import { UserRow } from './UserRow';
import { UnverifiedCarrierNote } from './VerificationNotice';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning,
  countered: colors.primary,
  accepted: '#1F8F88',
  rejected: colors.textMuted,
  withdrawn: colors.textMuted,
  cancelled: colors.textMuted,
};

export function OfferRounds({ offer, viewerIsSender }: { offer: OfferDto; viewerIsSender: boolean }) {
  const { t } = useTranslation('offer');
  return (
    <View style={styles.rounds}>
      <AppText size="sm" weight="semibold">
        {t('rounds')}
      </AppText>
      {offer.rounds.map((r, i) => {
        const mine = (r.by === 'sender') === viewerIsSender;
        return (
          <View key={i} style={[styles.round, mine ? styles.roundMine : styles.roundOther]}>
            <AppText size="xs" color={colors.textMuted}>
              {mine ? t('you') : t('counterpart')} · {formatDateTime(r.at)}
            </AppText>
            <AppText weight="bold">{price(r.price)}</AppText>
          </View>
        );
      })}
    </View>
  );
}

export function OfferCard({
  offer,
  viewerIsSender,
  actions,
  showRounds = false,
}: {
  offer: OfferDto;
  viewerIsSender: boolean;
  actions?: ReactNode;
  showRounds?: boolean;
}) {
  const { t } = useTranslation(['offer', 'parcel']);
  return (
    <View style={styles.card}>
      <UserRow
        user={offer.carrier}
        plain
        subtitle={`${t('parcel:vehicleTypes.' + offer.vehicle.type)} · ${offer.vehicle.brand} ${offer.vehicle.model} · ${offer.vehicle.plate}`}
        right={
          <View style={styles.priceBox}>
            <AppText size="lg" weight="bold" color={colors.primary}>
              {price(offer.counterPrice ?? offer.price)}
            </AppText>
            <AppText size="xs" weight="semibold" color={STATUS_COLORS[offer.status]}>
              {t(`statuses.${offer.status}`)}
            </AppText>
          </View>
        }
      />
      {offer.atAskingPrice && (
        <AppText size="sm" weight="semibold" color="#1F8F88">
          {t('atAskingPrice')}
        </AppText>
      )}
      <AppText size="sm" color={colors.textMuted}>
        {t('pickupDate')} : {formatDate(offer.proposedPickupDate)} · {t('deliveries', { count: offer.carrier.deliveredCount })}
      </AppText>
      {viewerIsSender && !offer.carrier.badges.identity && <UnverifiedCarrierNote />}
      {showRounds && offer.rounds.length > 1 && <OfferRounds offer={offer} viewerIsSender={viewerIsSender} />}
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, backgroundColor: colors.surface, padding: space(4), gap: space(2), ...shadow },
  priceBox: { alignItems: 'flex-end' },
  actions: { flexDirection: 'row', gap: space(2), flexWrap: 'wrap' },
  rounds: { gap: space(2), marginTop: space(1) },
  round: { padding: space(2.5), borderRadius: radii.input, maxWidth: '85%', gap: space(0.5) },
  roundMine: { alignSelf: 'flex-end', backgroundColor: colors.primarySoft },
  roundOther: { alignSelf: 'flex-start', backgroundColor: colors.background },
});
