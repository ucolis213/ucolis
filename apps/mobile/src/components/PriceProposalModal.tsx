// Contre-offre de l'expéditeur ou nouvelle proposition du transporteur (F8) : montant borné, sans message.
// Les bornes reprennent les règles de l'API (COUNTER_PRICE_NOT_LOWER, REOFFER_PRICE_NOT_HIGHER), qui les impose.

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isRoundPrice, MIN_PRICE_DA } from '@ucolis/shared';
import { price as formatPrice } from '../format';
import { colors, radii, space } from '../theme';
import { AppModal } from './AppModal';
import { AppText } from './AppText';
import { Button } from './Button';
import { PriceInput } from './FormBits';

export function PriceProposalModal({
  visible,
  title,
  message,
  label,
  below,
  above,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  /** Le prix doit être strictement inférieur à cette valeur (contre-offre). */
  below?: number;
  /** Le prix doit être strictement supérieur à cette valeur (nouvelle proposition). */
  above?: number;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (input: { price: number }) => void | Promise<void>;
}) {
  const { t } = useTranslation(['offer', 'common']);
  const [value, setValue] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (visible) {
      setValue(null);
    }
  }, [visible]);

  let error: string | undefined;
  if (value !== null) {
    if (value < MIN_PRICE_DA) error = 'validation.minPrice';
    else if (!isRoundPrice(value)) error = 'validation.roundPrice';
    else if (below !== undefined && value >= below) error = 'COUNTER_PRICE_NOT_LOWER';
    else if (above !== undefined && value <= above) error = 'REOFFER_PRICE_NOT_HIGHER';
  }
  const hint =
    below !== undefined ? t('priceBelow', { price: formatPrice(below) }) : above !== undefined ? t('priceAbove', { price: formatPrice(above) }) : undefined;

  return (
    <AppModal avoidKeyboard={false} visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('common:cancel')} />
        <View style={styles.sheet}>
          <AppText size="lg" weight="bold">
            {title}
          </AppText>
          {message && (
            <AppText size="sm" color={colors.textMuted}>
              {message}
            </AppText>
          )}
          <PriceInput label={label} value={value} onChange={setValue} error={error} hint={hint} autoFocus />
          {/* Action principale pleine largeur, annulation discrète en dessous : aucun libellé tronqué. */}
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              loading={pending}
              disabled={value === null || !!error}
              onPress={async () => {
                setPending(true);
                try {
                  await onConfirm({ price: value! });
                } finally {
                  setPending(false);
                }
              }}
            />
            <Button label={t('common:cancel')} variant="ghost" onPress={onCancel} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,28,46,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.card * 2, borderTopRightRadius: radii.card * 2, padding: space(5), gap: space(4) },
  actions: { gap: space(1) },
});
