import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, fontSizes, MAX_FONT_SCALE, MIN_TOUCH, radii, space } from '../theme';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  /** Clé de traduction de l'espace « errors » (ex. validation.email) ou message déjà traduit. */
  error?: string;
  hint?: string;
  password?: boolean;
}

/** Champ de saisie : libellé au-dessus, erreur sous le champ concerné. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, password, style, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const message = error ? t(`errors:${error}`, { defaultValue: error }) : undefined;

  return (
    <View style={styles.wrap}>
      <AppText size="sm" weight="medium">
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          focused && { borderColor: colors.primary },
          !!message && { borderColor: colors.danger },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          secureTextEntry={password && hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, { fontFamily: fontFamily() }, style]}
          {...rest}
        />
        {password && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>
      {message ? (
        <AppText size="xs" color={colors.danger} accessibilityLiveRegion="polite">
          {message}
        </AppText>
      ) : hint ? (
        <AppText size="xs" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space(1.5) },
  box: {
    minHeight: MIN_TOUCH + 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    paddingHorizontal: space(3),
    gap: space(2),
  },
  input: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.navy,
    paddingVertical: space(2.5),
    textAlign: 'auto',
  },
});
