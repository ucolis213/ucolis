import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, MIN_TOUCH, space } from '../theme';
import { AppText } from './AppText';

/** Affichage (value décimale) ou saisie (onChange) d'une note de 1 à 5. */
export function RatingStars({
  value,
  count,
  size = 16,
  onChange,
}: {
  value: number;
  count?: number;
  size?: number;
  onChange?: (v: number) => void;
}) {
  return (
    <View style={styles.row} accessibilityLabel={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const name = value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline';
        const star = <Ionicons name={name} size={size} color={colors.warning} />;
        return onChange ? (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={styles.touch}
            accessibilityRole="button"
            accessibilityLabel={`${n} / 5`}
            accessibilityState={{ selected: value === n }}
          >
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
      {count !== undefined && (
        <AppText size="xs" color={colors.textMuted}>
          {value.toFixed(1)} ({count})
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(0.5) },
  touch: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
