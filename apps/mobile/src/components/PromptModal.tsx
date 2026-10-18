// Saisie courte dans une fenêtre (motif d'annulation, prix…), identique sur iOS et Android.

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { TextField, type TextFieldProps } from './TextField';

export function PromptModal({
  visible,
  title,
  message,
  label,
  confirmLabel,
  required = false,
  destructive = false,
  inputProps,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  confirmLabel?: string;
  required?: boolean;
  destructive?: boolean;
  inputProps?: Partial<TextFieldProps>;
  onCancel: () => void;
  onConfirm: (value: string) => void | Promise<void>;
}) {
  const { t } = useTranslation('common');
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('cancel')} />
        <View style={styles.sheet}>
          <AppText size="lg" weight="bold">
            {title}
          </AppText>
          {message && (
            <AppText size="sm" color={colors.textMuted}>
              {message}
            </AppText>
          )}
          <TextField label={label} value={value} onChangeText={setValue} autoFocus {...inputProps} />
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label={t('cancel')} variant="outline" onPress={onCancel} />
            </View>
            <View style={styles.flex}>
              <Button
                label={confirmLabel ?? t('confirm')}
                variant={destructive ? 'danger' : 'primary'}
                loading={pending}
                disabled={required && !value.trim()}
                onPress={async () => {
                  setPending(true);
                  try {
                    await onConfirm(value.trim());
                  } finally {
                    setPending(false);
                  }
                }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,28,46,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.card * 2, borderTopRightRadius: radii.card * 2, padding: space(5), gap: space(4) },
  actions: { flexDirection: 'row', gap: space(3) },
});
