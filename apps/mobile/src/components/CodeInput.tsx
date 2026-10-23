// Code numérique (email, mot de passe oublié, code de remise) : une case par chiffre attendu.
// Un seul champ invisible posé sur les cases reçoit la saisie : pavé numérique, collage et remplissage
// automatique du code reçu (iOS) fonctionnent comme sur un champ classique.

import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, MAX_FONT_SCALE, radii, space } from '../theme';
import { AppText } from './AppText';

export function CodeInput({
  label,
  length,
  value,
  onChange,
  onComplete,
  error,
  autoFocus = false,
  oneTimeCode = true,
}: {
  label: string;
  length: number;
  value: string;
  onChange: (code: string) => void;
  /** Appelé quand toutes les cases sont remplies (ex. validation directe). */
  onComplete?: (code: string) => void;
  /** Clé de traduction de l'espace « errors » ou message déjà traduit. */
  error?: string;
  autoFocus?: boolean;
  /** Code reçu par email ou SMS : proposé par le clavier (iOS) ou le gestionnaire de mots de passe. */
  oneTimeCode?: boolean;
}) {
  const { t } = useTranslation();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const message = error ? t(`errors:${error}`, { defaultValue: error }) : undefined;
  const digits = value.split('');

  return (
    <View style={styles.wrap}>
      <AppText size="sm" weight="medium">
        {label}
      </AppText>
      <Pressable onPress={() => input.current?.focus()} style={styles.row} accessible={false}>
        {Array.from({ length }, (_, i) => {
          // Case active : la prochaine à remplir, ou la dernière quand le code est complet.
          const active = focused && i === Math.min(digits.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.cell,
                !!digits[i] && styles.cellFilled,
                active && styles.cellActive,
                !!message && styles.cellError,
              ]}
            >
              <AppText size="xl" weight="bold">
                {digits[i] ?? ''}
              </AppText>
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={value}
          onChangeText={(v) => {
            const code = v.replace(/\D/g, '').slice(0, length);
            onChange(code);
            if (code.length === length && code !== value) onComplete?.(code);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={length}
          autoFocus={autoFocus}
          autoComplete={oneTimeCode ? 'one-time-code' : 'off'}
          textContentType={oneTimeCode ? 'oneTimeCode' : 'none'}
          caretHidden
          contextMenuHidden={false}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={label}
          accessibilityHint={t('codeDigits', { n: length })}
          style={[styles.hidden, { fontFamily: fontFamily() }]}
        />
      </Pressable>
      {message && (
        <AppText size="xs" color={colors.danger}>
          {message}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(1.5) },
  // Un code se lit de gauche à droite, même en arabe.
  row: { flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: space(2) },
  cell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.85,
    borderRadius: radii.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: { borderColor: colors.navy },
  cellActive: { borderColor: colors.primary, borderWidth: 2 },
  cellError: { borderColor: colors.danger },
  // Posé sur les cases, presque transparent : il reçoit les touchers, la saisie et le collage.
  hidden: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
});
