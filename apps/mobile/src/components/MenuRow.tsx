import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { badgeText, colors, forwardIcon, MAX_FONT_SCALE, MIN_TOUCH, radii, shadow, space } from '../theme';
import { AppText } from './AppText';

export function MenuSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title && (
        <AppText size="sm" weight="semibold" color={colors.textMuted}>
          {title}
        </AppText>
      )}
      <View style={styles.card}>
        {/* Le trait sous la dernière ligne passe sous le bord de la carte. */}
        <View style={styles.rows}>{children}</View>
      </View>
    </View>
  );
}

export function MenuRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
  badge = 0,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  /** Nombre d'éléments non lus, en pastille rouge avant la flèche ; rien à zéro. */
  badge?: number;
  right?: ReactNode;
}) {
  const color = danger ? colors.danger : colors.navy;
  const details = [value, badge > 0 ? String(badge) : undefined].filter(Boolean).join(', ');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={details ? `${label}, ${details}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.background }]}
    >
      <View style={[styles.iconTile, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <AppText weight="medium" color={color} style={styles.flex}>
        {label}
      </AppText>
      {value && (
        <AppText size="sm" color={colors.textMuted} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      )}
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={badgeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
      {right ?? (onPress && <Ionicons name={forwardIcon()} size={18} color={colors.textSubtle} />)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Valeur longue (email) : tronquée, sans écraser le libellé sur un écran étroit.
  value: { flexShrink: 1, maxWidth: '50%' },
  section: { gap: space(2.5) },
  rows: { marginBottom: -StyleSheet.hairlineWidth },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radii.card, backgroundColor: colors.surface, overflow: 'hidden', ...shadow },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: MIN_TOUCH + 16,
    paddingHorizontal: space(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
