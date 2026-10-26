import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { colors, MIN_TOUCH, radii, space } from '../theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'dangerGhost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.navy, fg: '#FFFFFF', border: colors.navy },
  outline: { bg: colors.surface, fg: colors.navy, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primaryDark, border: 'transparent' },
  dangerGhost: { bg: 'transparent', fg: colors.danger, border: 'transparent' },
  danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
};

export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = true,
  disabled,
  ...rest
}: ButtonProps) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        },
        fullWidth && styles.full,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={20} color={v.fg} />}
          {/* Une seule ligne : le libellé rétrécit un peu plutôt que de se couper au milieu d'un mot. */}
          <AppText weight="semibold" color={v.fg} align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.label}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(MIN_TOUCH, 50),
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: space(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2), maxWidth: '100%' },
  label: { flexShrink: 1 },
});
