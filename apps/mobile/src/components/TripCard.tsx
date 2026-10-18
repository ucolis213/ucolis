import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TripDto } from '@ucolis/shared';
import { formatDateTime, price, wilayaName } from '../format';
import { colors, radii, shadow, space } from '../theme';
import { AppText } from './AppText';
import { RatingStars } from './RatingStars';

export function TripCard({ trip, showStatus = false }: { trip: TripDto; showStatus?: boolean }) {
  const { t } = useTranslation(['trip', 'parcel']);
  const route = [trip.from.wilayaCode, ...trip.stops, trip.to.wilayaCode].map(wilayaName).join(' → ');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={route}
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="car" size={22} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText weight="semibold" numberOfLines={2}>
            {route}
          </AppText>
          <AppText size="sm" color={colors.textMuted}>
            {formatDateTime(trip.departureAt)}
          </AppText>
        </View>
        {showStatus && (
          <AppText size="xs" weight="semibold" color={colors.primaryDark}>
            {t(`statuses.${trip.status}`)}
          </AppText>
        )}
      </View>
      <View style={styles.footer}>
        <AppText size="xs" color={colors.textMuted} style={styles.flex}>
          {t(`parcel:vehicleTypes.${trip.vehicle.type}`)} · {trip.capacityKg} kg · {trip.capacityM3} m³
        </AppText>
        {trip.priceHint && (
          <AppText size="sm" weight="bold" color={colors.primary}>
            {price(trip.priceHint.amount)}
            {trip.priceHint.mode === 'per_kg' ? ' / kg' : ''}
          </AppText>
        )}
      </View>
      <View style={styles.carrier}>
        <AppText size="xs" weight="medium">
          {trip.carrier.displayName}
        </AppText>
        {trip.carrier.rating.count > 0 && <RatingStars value={trip.carrier.rating.average} size={11} />}
        {trip.carrier.badges.identity && <Ionicons name="shield-checkmark" size={12} color="#1F8F88" />}
        {trip.carrier.badges.pro && <Ionicons name="briefcase" size={12} color={colors.navy} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radii.card, backgroundColor: colors.surface, padding: space(3), gap: space(2), ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  carrier: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
});
