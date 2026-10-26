// Thème mobile : jetons de shared + typographie. Inter en latin, Cairo en arabe.
// La direction ne change qu'au redémarrage (Updates.reloadAsync), I18nManager.isRTL est donc stable.

import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { I18nManager } from 'react-native';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Cairo_400Regular } from '@expo-google-fonts/cairo/400Regular';
import { Cairo_500Medium } from '@expo-google-fonts/cairo/500Medium';
import { Cairo_600SemiBold } from '@expo-google-fonts/cairo/600SemiBold';
import { Cairo_700Bold } from '@expo-google-fonts/cairo/700Bold';

import { applyBrandColor, colors, isRtl, isValidBrandColor, type Locale } from '@ucolis/shared';

export { colors, fontSizes, radii, space, MIN_TOUCH, parcelStatusColors } from '@ucolis/shared';

// Couleur de marque (réglage branding du back-office). Les styles sont calculés au chargement des écrans :
// la couleur enregistrée est donc appliquée ici, de façon synchrone, avant tout écran.
const BRAND_KEY = 'ucolis.brand-color';
try {
  const stored = SecureStore.getItem(BRAND_KEY);
  if (stored) applyBrandColor(stored);
} catch {
  // Stockage indisponible (tests) : couleur par défaut.
}

/** Enregistre une nouvelle couleur de marque, appliquée au prochain lancement ; true si elle a été enregistrée. */
export function storeBrandColor(hex: string): boolean {
  if (hex.toUpperCase() === colors.primary || !isValidBrandColor(hex)) return false;
  try {
    SecureStore.setItem(BRAND_KEY, hex);
    return SecureStore.getItem(BRAND_KEY) === hex;
  } catch {
    return false;
  }
}

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
};

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const LATIN: Record<FontWeight, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const ARABIC: Record<FontWeight, string> = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
};

/**
 * Langue de lecture droite-à-gauche. Elle suit la langue choisie et non I18nManager.isRTL : la mise en page
 * RTL n'est effective qu'après un redémarrage natif (dans Expo Go, parfois seulement après l'avoir fermé),
 * alors que les textes arabes se lisent déjà de droite à gauche.
 */
const readsRtl = () => isRtl(i18n.language as Locale) || I18nManager.isRTL;

export const fontFamily = (weight: FontWeight = 'regular') => (readsRtl() ? ARABIC : LATIN)[weight];

/** Respect de la taille de police du système jusqu'à 130 %. */
export const MAX_FONT_SCALE = 1.3;

/** Icônes directionnelles inversées en RTL. */
export const forwardIcon = () => (I18nManager.isRTL ? 'chevron-back' : 'chevron-forward');
export const backIcon = () => (I18nManager.isRTL ? 'chevron-forward' : 'chevron-back');
/** Flèche d'un trajet (départ → arrivée), orientée dans le sens de lecture. */
export const routeArrow = () => (readsRtl() ? '←' : '→');

/**
 * Chiffres des pastilles (notifications, messages non lus) : toujours en Inter, hauteur de ligne fixe.
 * Cairo a de grandes marges hautes et basses qui décentrent un chiffre dans une petite pastille.
 */
export const badgeText = {
  fontFamily: 'Inter_700Bold',
  fontSize: 11,
  lineHeight: 14,
  includeFontPadding: false,
  textAlign: 'center',
  color: '#FFFFFF',
} as const;

export const shadow = {
  shadowColor: '#1C1C2E',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
