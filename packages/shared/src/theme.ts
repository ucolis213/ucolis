// Jetons de design : définis une fois, repris par le mobile (src/theme) et par le back-office (Tailwind).

import type { ParcelStatus } from './enums';

export const colors = {
  primary: '#FF6B35',
  primaryDark: '#E5531F',
  primarySoft: '#FFF0EA',
  navy: '#1C1C2E',
  accent: '#4ECDC4',
  accentSoft: '#E6F8F7',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#F5A524',
  warningSoft: '#FEF5E6',
  surface: '#FFFFFF',
  background: '#F6F7F9',
  border: '#E4E6EB',
  textMuted: '#6B6F80',
  textSubtle: '#9A9DAB',
} as const;

export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

/** Espacements par pas de 4. */
export const space = (n: number) => n * 4;

export const radii = { card: 12, input: 10, chip: 999 } as const;

/** Cible tactile minimale (accessibilité). */
export const MIN_TOUCH = 44;

/** Couleur de chaque statut de colis, déclarée une seule fois. */
export const parcelStatusColors: Record<ParcelStatus, { fg: string; bg: string }> = {
  open: { fg: colors.primaryDark, bg: colors.primarySoft },
  negotiating: { fg: '#B7791F', bg: colors.warningSoft },
  assigned: { fg: colors.navy, bg: '#ECECF4' },
  in_transit: { fg: '#1F8F88', bg: colors.accentSoft },
  delivered_pending: { fg: '#B7791F', bg: colors.warningSoft },
  delivered: { fg: '#1F8F88', bg: colors.accentSoft },
  cancelled: { fg: colors.textMuted, bg: '#EFF0F3' },
  expired: { fg: colors.textMuted, bg: '#EFF0F3' },
  disputed: { fg: colors.danger, bg: colors.dangerSoft },
};
