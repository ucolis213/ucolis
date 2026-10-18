import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, fontFamily, fontSizes, MAX_FONT_SCALE, type FontWeight } from '../theme';

type Size = keyof typeof fontSizes;

export interface AppTextProps extends TextProps {
  size?: Size;
  weight?: FontWeight;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'auto';
}

/** Texte de base : police selon la langue, taille système respectée jusqu'à 130 %. */
export function AppText({
  size = 'md',
  weight = 'regular',
  color = colors.navy,
  align = 'auto',
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[
        styles.base,
        { fontSize: fontSizes[size], fontFamily: fontFamily(weight), color, textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({ base: { writingDirection: 'auto' } });
