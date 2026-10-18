// Déclarer la livraison sans code (F11) : photo de preuve et note facultatives, validation automatique à 72 h.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FileRef } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PhotoGrid } from '@/components/PhotoGrid';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { colors } from '@/theme';
import { stopTracking } from '@/tracking/location';

export default function DeclareDelivery() {
  const { t } = useTranslation(['parcel', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [photos, setPhotos] = useState<FileRef[]>([]);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      await api.post(`/parcels/${id}/declare-delivered`, { photo: photos[0] ?? null, note: note.trim() || undefined });
      await stopTracking(id);
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
      router.replace({ pathname: '/parcel/[id]', params: { id } });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('declareTitle')} />} footer={<Button label={t('actions.declare_delivery')} onPress={submit} loading={pending} />}>
      <AppText color={colors.textMuted}>{t('declareHint')}</AppText>
      <AppText weight="semibold">{t('proofPhoto')}</AppText>
      <PhotoGrid photos={photos} onChange={setPhotos} max={1} purpose="delivery_proof" />
      <TextField label={t('proofNote')} value={note} onChangeText={setNote} multiline maxLength={500} />
    </Screen>
  );
}
