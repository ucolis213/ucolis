// Jetons de design : définis une fois, repris par le mobile (src/theme) et par le back-office (Tailwind).

import type { ParcelStatus } from './enums';

/** Couleur de marque par défaut (bleu) ; le super-administrateur peut la changer (réglage branding). */
export const DEFAULT_PRIMARY_COLOR = '#1A73E8';
export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
/** Contraste minimal du texte blanc sur la couleur de marque (WCAG AA, texte des boutons). */
export const MIN_BRAND_CONTRAST = 4.5;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(c: number[]): string {
  return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const mix = (hex: string, other: number, ratio: number) => toHex(rgb(hex).map((v) => v + (other - v) * ratio));

/** Rapport de contraste WCAG entre la couleur et le blanc (1 à 21). */
export function contrastWithWhite(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/** Nuances dérivées d'une seule couleur : foncée (texte, contour) et douce (fonds). */
export function brandPalette(primary: string) {
  return { primary: primary.toUpperCase(), primaryDark: mix(primary, 0, 0.18), primarySoft: mix(primary, 255, 0.9) };
}

export const isValidBrandColor = (hex: string) => HEX_COLOR.test(hex) && contrastWithWhite(hex) >= MIN_BRAND_CONTRAST;

// Objet modifiable : applyBrandColor le met à jour au démarrage, avant le calcul des styles.
export const colors = {
  ...brandPalette(DEFAULT_PRIMARY_COLOR),
  navy: '#0E1B3D',
  accent: '#0EA5E9',
  accentDark: '#0369A1',
  accentSoft: '#E0F2FE',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#F5A524',
  warningDark: '#B7791F',
  warningSoft: '#FEF5E6',
  neutralSoft: '#EEF2F8',
  surface: '#FFFFFF',
  background: '#F4F7FC',
  border: '#E3E9F3',
  textMuted: '#5F6B85',
  textSubtle: '#9AA4B8',
};

export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

/** Espacements par pas de 4. */
export const space = (n: number) => n * 4;

/** Formes généreuses : cartes et feuilles très arrondies, boutons et champs arrondis, puces en pilule. */
export const radii = { card: 20, button: 16, input: 14, tile: 18, sheet: 28, chip: 999 } as const;

/** Cible tactile minimale (accessibilité). */
export const MIN_TOUCH = 44;

/** Couleur de chaque statut de colis, déclarée une seule fois. */
export const parcelStatusColors: Record<ParcelStatus, { fg: string; bg: string }> = {
  open: { fg: colors.primaryDark, bg: colors.primarySoft },
  negotiating: { fg: colors.warningDark, bg: colors.warningSoft },
  assigned: { fg: colors.navy, bg: colors.neutralSoft },
  in_transit: { fg: colors.accentDark, bg: colors.accentSoft },
  delivered_pending: { fg: colors.warningDark, bg: colors.warningSoft },
  delivered: { fg: colors.accentDark, bg: colors.accentSoft },
  cancelled: { fg: colors.textMuted, bg: colors.neutralSoft },
  expired: { fg: colors.textMuted, bg: colors.neutralSoft },
  disputed: { fg: colors.danger, bg: colors.dangerSoft },
};

/**
 * Applique une couleur de marque (aux jetons et aux couleurs de statut qui en dépendent).
 * Refuse une couleur invalide ou trop claire pour du texte blanc ; renvoie true si elle est appliquée.
 */
export function applyBrandColor(hex: string): boolean {
  if (!isValidBrandColor(hex)) return false;
  const palette = brandPalette(hex);
  Object.assign(colors, palette);
  parcelStatusColors.open = { fg: palette.primaryDark, bg: palette.primarySoft };
  return true;
}
