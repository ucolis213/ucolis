import { Pressable, StyleSheet } from 'react-native';
import { colors, MIN_TOUCH, radii, space } from '../theme';
import { AppText } from './AppText';

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.base, selected ? styles.on : styles.off]}
    >
      <AppText size="sm" weight="medium" color={selected ? '#FFFFFF' : colors.navy}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH - 6,
    paddingHorizontal: space(4),
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  off: { backgroundColor: colors.surface, borderColor: colors.border },
});
