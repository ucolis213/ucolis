import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ParcelCardDto } from '@ucolis/shared';
import { distance, formatDate, placeLabel, price, weight } from '../format';
import { colors, MIN_TOUCH, radii, shadow, space } from '../theme';
import { AppText } from './AppText';
import { cdn } from './Avatar';
import { Badge, StatusBadge } from './Badge';
import { RatingStars } from './RatingStars';

export function ParcelCard({
  parcel,
  onToggleFavorite,
  showStatus = false,
}: {
  parcel: ParcelCardDto;
  onToggleFavorite?: (p: ParcelCardDto) => void;
  showStatus?: boolean;
}) {
  const { t } = useTranslation(['parcel', 'common']);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/parcel/[id]', params: { id: parcel.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`${parcel.title}, ${price(parcel.requestedPrice)}`}
    >
      <View style={styles.row}>
        {parcel.coverPhoto ? (
          <Image source={{ uri: cdn(parcel.coverPhoto.url, 240) }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.placeholder]}>
            <Ionicons name="cube-outline" size={32} color={colors.primary} />
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText weight="semibold" numberOfLines={1} style={styles.flex}>
              {parcel.title}
            </AppText>
            {onToggleFavorite && (
              <Pressable
                hitSlop={10}
                onPress={() => onToggleFavorite(parcel)}
                accessibilityRole="button"
                accessibilityLabel={t('actions.favorite')}
                accessibilityState={{ selected: !!parcel.isFavorite }}
              >
                <Ionicons
                  name={parcel.isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={parcel.isFavorite ? colors.danger : colors.textSubtle}
                />
              </Pressable>
            )}
          </View>
          <AppText size="sm" color={colors.textMuted} numberOfLines={1}>
            {placeLabel(parcel.pickup)} → {placeLabel(parcel.dropoff)}
          </AppText>
          <AppText size="xs" color={colors.textMuted}>
            {[
              distance(parcel.distanceKm),
              parcel.weightKg !== null && weight(parcel.weightKg),
              parcel.desiredDate
                ? `${formatDate(parcel.desiredDate, { year: undefined })}${parcel.desiredTime ? ` ${parcel.desiredTime}` : ''}`
                : t('flexibleDate'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <View style={styles.badges}>
            {showStatus && <StatusBadge status={parcel.status} />}
            {parcel.urgent && <Badge kind="urgent" />}
            {parcel.fragile && <Badge kind="fragile" />}
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.sender}>
          <AppText size="xs" weight="medium" numberOfLines={1} style={styles.shrink}>
            {parcel.sender.displayName}
          </AppText>
          {parcel.sender.rating.count > 0 && <RatingStars value={parcel.sender.rating.average} size={11} />}
          {parcel.sender.badges.pro && <Ionicons name="briefcase" size={12} color={colors.navy} />}
          {parcel.sender.badges.identity && <Ionicons name="shield-checkmark" size={12} color="#1F8F88" />}
        </View>
        <AppText size="xs" color={colors.textMuted}>
          {t('offersCount', { count: parcel.offersCount })}
        </AppText>
        <AppText weight="bold" color={colors.primary}>
          {price(parcel.requestedPrice)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  card: { borderRadius: radii.card, backgroundColor: colors.surface, padding: space(3), gap: space(3), ...shadow },
  row: { flexDirection: 'row', gap: space(3) },
  photo: { width: 84, height: 84, borderRadius: radii.input },
  placeholder: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: space(1) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: MIN_TOUCH - 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space(2),
  },
  sender: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
});
