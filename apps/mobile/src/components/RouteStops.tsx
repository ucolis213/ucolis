import { StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';
import { AppText } from './AppText';

/** Départ et arrivée l'un sous l'autre, reliés par un trait : point bleu clair au départ, carré bleu à l'arrivée. */
export function RouteStops({ from, to, size = 'sm' }: { from: string; to: string; size?: 'sm' | 'md' }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.rail} accessible={false}>
        <View style={styles.start} />
        <View style={styles.line} />
        <View style={styles.end} />
      </View>
      <View style={styles.labels}>
        <AppText size={size} weight="medium" numberOfLines={1}>
          {from}
        </AppText>
        <AppText size={size} weight="medium" numberOfLines={1}>
          {to}
        </AppText>
      </View>
    </View>
  );
}

/**
 * Adresses complètes d'un trajet, chacune sous son titre (Départ, Arrivée), sur toute la largeur.
 * Le trait part du repère de départ et descend jusqu'à celui de l'arrivée, quelle que soit la longueur des adresses.
 */
export function RouteAddresses({ stops }: { stops: { title: string; address: string }[] }) {
  return (
    <View>
      {stops.map((s, i) => {
        const last = i === stops.length - 1;
        return (
          <View key={s.title} style={styles.stop} accessible accessibilityLabel={`${s.title}, ${s.address}`}>
            <View style={styles.stopRail}>
              <View style={i === 0 ? styles.start : styles.end} />
              {!last && <View style={styles.line} />}
            </View>
            <View style={[styles.stopText, !last && styles.stopGap]}>
              <AppText size="xs" weight="semibold" color={colors.textMuted}>
                {s.title}
              </AppText>
              <AppText size="sm" weight="medium">
                {s.address}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: space(2.5) },
  stop: { flexDirection: 'row', gap: space(3) },
  // Repère aligné sur le titre ; le trait remplit la hauteur restante de l'adresse.
  stopRail: { width: 10, alignItems: 'center', paddingTop: 4 },
  stopText: { flex: 1, gap: space(0.5) },
  stopGap: { paddingBottom: space(4) },
  rail: { width: 10, alignItems: 'center', paddingVertical: 6 },
  start: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  line: { flex: 1, width: 2, marginVertical: 2, borderRadius: 1, backgroundColor: colors.border },
  end: { width: 10, height: 10, borderRadius: 3, backgroundColor: colors.primary },
  labels: { flex: 1, gap: space(1.5) },
});
