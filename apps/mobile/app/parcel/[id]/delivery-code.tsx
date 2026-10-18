// Code de remise (F11). Expéditeur : affiche le code et l'envoie au destinataire (SMS, WhatsApp).
// Transporteur retenu : saisit le code donné par le destinataire ; 5 erreurs bloquent la saisie.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ApiError, api, errorMessage } from '@/api/client';
import { useParcel } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { LoadingSkeleton } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState } from '@/components/States';
import { TextField } from '@/components/TextField';
import { colors, radii, space } from '@/theme';
import { stopTracking } from '@/tracking/location';

export default function DeliveryCode() {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const parcel = useParcel(id);
  const role = parcel.data?.viewer.role;
  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('deliveryCode')} />}>
      {!parcel.data ? <LoadingSkeleton rows={2} /> : role === 'sender' ? <ShowCode id={id} title={parcel.data.title} /> : <EnterCode id={id} locked={parcel.data.deliveryCodeLocked} />}
    </Screen>
  );
}

function ShowCode({ id, title }: { id: string; title: string }) {
  const { t } = useTranslation(['parcel', 'common']);
  const code = useQuery({ queryKey: ['parcel', id, 'code'], queryFn: () => api.get<{ code: string }>(`/parcels/${id}/delivery-code`) });
  if (code.isPending) return <LoadingSkeleton rows={1} />;
  if (code.isError) return <ErrorState message={errorMessage(t, code.error)} onRetry={() => code.refetch()} />;
  return (
    <>
      <View style={styles.codeBox} accessibilityLabel={code.data.code.split('').join(' ')}>
        {code.data.code.split('').map((d, i) => (
          <View key={i} style={styles.digit}>
            <AppText size="xxl" weight="bold">
              {d}
            </AppText>
          </View>
        ))}
      </View>
      <AppText color={colors.textMuted} align="center">
        {t('deliveryCodeHint')}
      </AppText>
      <Button label={t('sendToRecipient')} icon="share-social-outline" onPress={() => Share.share({ message: t('shareCodeMessage', { title, code: code.data.code }) })} />
    </>
  );
}

function EnterCode({ id, locked }: { id: string; locked: boolean }) {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!/^\d{4}$/.test(code)) return setError('validation.deliveryCode');
    setPending(true);
    setError(undefined);
    try {
      await api.post(`/parcels/${id}/delivery-code`, { code });
      await stopTracking(id);
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
      router.replace({ pathname: '/parcel/[id]/review', params: { id } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CODE') {
        setError(t('codeAttemptsLeft', { count: Number(err.details?.attemptsLeft ?? 0) }));
      } else {
        setError(errorMessage(t, err));
        void qc.invalidateQueries({ queryKey: ['parcel', id] });
      }
    } finally {
      setPending(false);
    }
  }

  if (locked) {
    return (
      <>
        <AppText color={colors.danger}>{t('errors:DELIVERY_CODE_LOCKED')}</AppText>
        <Button label={t('actions.declare_delivery')} onPress={() => router.replace({ pathname: '/parcel/[id]/declare', params: { id } })} />
      </>
    );
  }
  return (
    <>
      <TextField
        label={t('enterCode')}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        error={error}
        style={{ fontSize: 32, letterSpacing: 16, textAlign: 'center' }}
      />
      <Button label={t('common:confirm')} onPress={submit} loading={pending} />
      <Button label={t('actions.declare_delivery')} variant="ghost" onPress={() => router.replace({ pathname: '/parcel/[id]/declare', params: { id } })} />
    </>
  );
}

const styles = StyleSheet.create({
  codeBox: { flexDirection: 'row', justifyContent: 'center', gap: space(3), marginVertical: space(6) },
  digit: { width: 64, height: 76, borderRadius: radii.card, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
