import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, forwardIcon, MIN_TOUCH, radii, shadow, space } from '../theme';
import { AppText } from './AppText';

export function MenuSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title && (
        <AppText size="sm" weight="semibold" color={colors.textMuted}>
          {title}
        </AppText>
      )}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function MenuRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
}) {
  const color = danger ? colors.danger : colors.navy;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.background }]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <AppText color={color} style={styles.flex}>
        {label}
      </AppText>
      {value && (
        <AppText size="sm" color={colors.textMuted} numberOfLines={1}>
          {value}
        </AppText>
      )}
      {right ?? (onPress && <Ionicons name={forwardIcon()} size={18} color={colors.textSubtle} />)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: space(2) },
  card: { borderRadius: radii.card, backgroundColor: colors.surface, overflow: 'hidden', ...shadow },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: MIN_TOUCH + 8,
    paddingHorizontal: space(4),
  },
});
