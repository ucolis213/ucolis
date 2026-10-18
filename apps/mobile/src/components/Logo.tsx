import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';
import { AppText } from './AppText';

export function Logo({ light = false, size = 32 }: { light?: boolean; size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="UCOLIS">
      <View style={[styles.mark, { width: size * 1.3, height: size * 1.3 }]}>
        <Ionicons name="cube" size={size * 0.8} color="#FFFFFF" />
      </View>
      {/* Le nom de marque reste en lettres latines, dans les deux langues. */}
      <AppText
        weight="bold"
        color={light ? '#FFFFFF' : colors.navy}
        style={{ fontSize: size, fontFamily: 'Inter_700Bold' }}
      >
        U
        <AppText
          weight="bold"
          color={colors.primary}
          style={{ fontSize: size, fontFamily: 'Inter_700Bold' }}
        >
          COLIS
        </AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  mark: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
