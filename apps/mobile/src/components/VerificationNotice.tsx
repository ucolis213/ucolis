// Vérification des transporteurs, facultative par défaut : conseil au transporteur non vérifié quand il répond à
// une annonce, information neutre pour l'expéditeur sur une offre. Si le back-office la rend obligatoire, l'API
// refuse avec CARRIER_NOT_VERIFIED et showVerificationRequired invite à la compléter.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { CarrierVerificationStatus } from '@ucolis/shared';
import { ApiError } from '../api/client';
import { colors, radii, space } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

/** Refus de l'API faute de vérification (réglage activé) : propose de la compléter. Vrai si l'erreur est traitée. */
export function showVerificationRequired(t: TFunction, err: unknown): boolean {
  if (!(err instanceof ApiError) || err.code !== 'CARRIER_NOT_VERIFIED') return false;
  Alert.alert(t('offer:needVerification'), undefined, [
    { text: t('common:cancel'), style: 'cancel' },
    { text: t('common:continue'), onPress: () => router.push('/me/carrier-verification') },
  ]);
  return true;
}

/**
 * Avant de répondre à une annonce : un transporteur qui n'a pas encore envoyé son dossier (ou dont le dossier a été
 * refusé ou a expiré) est invité à se faire vérifier, et peut aussi continuer sans. Dossier en cours : on continue.
 */
export function askToVerify(t: TFunction, status: CarrierVerificationStatus, onContinue: () => void) {
  if (status === 'approved' || status === 'pending') return onContinue();
  Alert.alert(t('offer:verificationTipTitle'), t('offer:verificationPromptBody'), [
    { text: t('offer:continueWithoutVerification'), onPress: onContinue },
    { text: t('offer:verifyAccount'), style: 'default', onPress: () => router.push('/me/carrier-verification') },
  ]);
}

/** Transporteur non vérifié : il peut répondre, la vérification lui est conseillée (ou annoncée en cours). */
export function CarrierVerificationTip({ status }: { status: CarrierVerificationStatus }) {
  const { t } = useTranslation('offer');
  if (status === 'approved') return null;
  const pending = status === 'pending';
  return (
    <View style={styles.tip} accessibilityRole="summary">
      <View style={styles.row}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
        <AppText weight="bold" style={styles.flex}>
          {t(pending ? 'verificationPendingTitle' : 'verificationTipTitle')}
        </AppText>
      </View>
      <AppText size="sm" color={colors.textMuted}>
        {t(pending ? 'verificationPendingBody' : 'verificationTipBody')}
      </AppText>
      {!pending && (
        <Button
          label={t('verifyAccount')}
          variant="outline"
          icon="shield-checkmark-outline"
          onPress={() => router.push('/me/carrier-verification')}
        />
      )}
    </View>
  );
}

/** Expéditeur : le transporteur de cette offre n'a pas encore fait vérifier son identité. */
export function UnverifiedCarrierNote() {
  const { t } = useTranslation('offer');
  return (
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
      <AppText size="xs" color={colors.textMuted} style={styles.flex}>
        {t('unverifiedCarrierNote')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  tip: {
    gap: space(2),
    padding: space(4),
    borderRadius: radii.card,
    backgroundColor: colors.primarySoft,
  },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2) },
});
