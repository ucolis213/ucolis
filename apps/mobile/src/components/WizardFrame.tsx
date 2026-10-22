// Cadre commun de l'assistant de publication : en-tête, progression, barre d'actions.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useParcelDraft } from '../state/parcelDraft';
import { colors, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';

export const WIZARD_STEPS = ['route', 'details', 'options', 'photos'] as const;

export function WizardFrame({
  step,
  children,
  onNext,
  nextLabel,
  loading,
}: {
  step: (typeof WIZARD_STEPS)[number] | 'review';
  children: ReactNode;
  onNext: () => void;
  nextLabel?: string;
  loading?: boolean;
}) {
  const { t } = useTranslation(['parcel', 'common']);
  const editing = useParcelDraft((s) => s.editingId);
  const index = step === 'review' ? WIZARD_STEPS.length : WIZARD_STEPS.indexOf(step);
  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={
        <View>
          <ScreenHeader title={editing ? t('editTitle') : t('newTitle')} />
          <View style={styles.progress}>
            {WIZARD_STEPS.map((s, i) => (
              <View key={s} style={[styles.bar, i <= index && styles.barOn]} />
            ))}
          </View>
          <AppText size="xs" color={colors.textMuted} style={styles.step}>
            {step === 'review' ? t('steps.review') : `${t('stepOf', { current: index + 1, total: WIZARD_STEPS.length })} · ${t(`steps.${step}`)}`}
          </AppText>
        </View>
      }
      footer={<Button label={nextLabel ?? t('common:next')} onPress={onNext} loading={loading} />}
    >
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: space(1.5), paddingHorizontal: space(5) },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  barOn: { backgroundColor: colors.primary },
  step: { paddingHorizontal: space(5), paddingTop: space(2) },
});
