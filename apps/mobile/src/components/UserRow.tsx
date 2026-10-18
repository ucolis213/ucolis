import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { UserSummary } from '@ucolis/shared';
import { colors, radii, shadow, space } from '../theme';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { RatingStars } from './RatingStars';

/** Avatar, nom, note et badges ; ouvre le profil public. */
export function UserRow({
  user,
  right,
  subtitle,
  plain = false,
}: {
  user: UserSummary;
  right?: ReactNode;
  subtitle?: string;
  plain?: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
      accessibilityRole="button"
      accessibilityLabel={user.displayName}
      style={[styles.row, !plain && styles.card]}
    >
      <Avatar file={user.avatar} name={user.displayName} size={44} />
      <View style={styles.flex}>
        <AppText weight="semibold" numberOfLines={1}>
          {user.displayName}
        </AppText>
        {subtitle && (
          <AppText size="xs" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
        <View style={styles.meta}>
          {user.rating.count > 0 && (
            <RatingStars value={user.rating.average} count={user.rating.count} size={12} />
          )}
          {user.badges.pro && <Badge kind="pro" />}
          {user.badges.identity && <Badge kind="identity" />}
        </View>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space(0.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  card: { padding: space(3), borderRadius: radii.card, backgroundColor: colors.surface, ...shadow },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(1.5) },
});
