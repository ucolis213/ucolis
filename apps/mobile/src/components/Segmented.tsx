import { Pressable, StyleSheet, View } from 'react-native';
import { colors, MIN_TOUCH, radii, shadow, space } from '../theme';
import { AppText } from './AppText';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; badge?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.item, on && styles.on]}
          >
            <AppText size="sm" weight="semibold" color={on ? colors.primary : colors.textMuted}>
              {o.label}
              {o.badge ? ` (${o.badge})` : ''}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: space(1), borderRadius: radii.chip, backgroundColor: colors.neutralSoft },
  item: { flex: 1, minHeight: MIN_TOUCH - 4, alignItems: 'center', justifyContent: 'center', borderRadius: radii.chip },
  on: { backgroundColor: colors.surface, ...shadow },
});
