import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ParcelStatus } from '@ucolis/shared';
import { colors, parcelStatusColors, radii, space } from '../theme';
import { AppText } from './AppText';

type Kind = 'pro' | 'identity' | 'urgent' | 'fragile';

const KINDS: Record<Kind, { fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pro: { fg: colors.navy, bg: '#ECECF4', icon: 'briefcase' },
  identity: { fg: '#1F8F88', bg: colors.accentSoft, icon: 'shield-checkmark' },
  urgent: { fg: '#B7791F', bg: colors.warningSoft, icon: 'flash' },
  fragile: { fg: colors.danger, bg: colors.dangerSoft, icon: 'wine' },
};

export function Badge({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const k = KINDS[kind];
  return (
    <View style={[styles.base, { backgroundColor: k.bg }]}>
      <Ionicons name={k.icon} size={12} color={k.fg} />
      <AppText size="xs" weight="semibold" color={k.fg}>
        {t(`badges.${kind}`)}
      </AppText>
    </View>
  );
}

export function StatusBadge({ status }: { status: ParcelStatus }) {
  const { t } = useTranslation();
  const c = parcelStatusColors[status];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]}>
      <AppText size="xs" weight="semibold" color={c.fg}>
        {t(`parcelStatus.${status}`)}
      </AppText>
    </View>
  );
}

const TONES = {
  neutral: { fg: colors.navy, bg: '#ECECF4' },
  primary: { fg: colors.primaryDark, bg: colors.primarySoft },
  success: { fg: '#1F8F88', bg: colors.accentSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
} as const;
export type PillTone = keyof typeof TONES;

/** Étiquette libre (statut pro, vérification, véhicule par défaut…). */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const c = TONES[tone];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]}>
      <AppText size="xs" weight="semibold" color={c.fg}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space(1),
    paddingHorizontal: space(2),
    paddingVertical: space(0.5),
    borderRadius: radii.chip,
  },
});
