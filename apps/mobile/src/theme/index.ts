// Thème mobile : jetons de shared + typographie. Inter en latin, IBM Plex Sans Arabic en arabe.
// La direction ne change qu'au redémarrage (Updates.reloadAsync), I18nManager.isRTL est donc stable.

import { I18nManager } from 'react-native';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';

export { colors, fontSizes, radii, space, MIN_TOUCH, parcelStatusColors } from '@ucolis/shared';

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
};

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const LATIN: Record<FontWeight, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const ARABIC: Record<FontWeight, string> = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};

export const fontFamily = (weight: FontWeight = 'regular') =>
  (I18nManager.isRTL ? ARABIC : LATIN)[weight];

/** Respect de la taille de police du système jusqu'à 130 %. */
export const MAX_FONT_SCALE = 1.3;

/** Icônes directionnelles inversées en RTL. */
export const forwardIcon = () => (I18nManager.isRTL ? 'chevron-back' : 'chevron-forward');
export const backIcon = () => (I18nManager.isRTL ? 'chevron-forward' : 'chevron-back');

export const shadow = {
  shadowColor: '#1C1C2E',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
