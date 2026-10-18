import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ParcelDto } from '@ucolis/shared';
import { formatDateTime } from '../format';
import { colors, parcelStatusColors, space } from '../theme';
import { AppText } from './AppText';

/** Historique des statuts du colis, du plus ancien au plus récent. */
export function StatusTimeline({ history }: { history: ParcelDto['statusHistory'] }) {
  const { t } = useTranslation();
  return (
    <View>
      {history.map((h, i) => {
        const c = parcelStatusColors[h.to];
        const last = i === history.length - 1;
        return (
          <View key={`${h.to}-${h.at}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: c.fg }]} />
              {!last && <View style={styles.line} />}
            </View>
            <View style={styles.body}>
              <AppText weight={last ? 'bold' : 'medium'}>{t(`parcelStatus.${h.to}`)}</AppText>
              <AppText size="xs" color={colors.textMuted}>
                {formatDateTime(h.at)}
              </AppText>
              {h.reason && (
                <AppText size="xs" color={colors.textMuted}>
                  {h.reason}
                </AppText>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(3) },
  rail: { alignItems: 'center', width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  body: { flex: 1, paddingBottom: space(3) },
});
