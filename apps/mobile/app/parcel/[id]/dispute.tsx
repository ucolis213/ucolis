// Ouvrir un litige (F16) : motif, description, jusqu'à 5 photos.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DISPUTE_REASONS, type DisputeDto, type DisputeReason, type FileRef } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { PhotoGrid } from '@/components/PhotoGrid';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { colors, space } from '@/theme';

export default function OpenDispute() {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<FileRef[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!reason) return setErrors({ reason: 'validation.required' });
    setPending(true);
    try {
      const d = await api.post<DisputeDto>(`/parcels/${id}/disputes`, { reason, description, photos });
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
      router.replace({ pathname: '/dispute/[id]', params: { id: d.id } });
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (!Object.keys(f).length) Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('disputeTitle')} />} footer={<Button label={t('actions.open_dispute')} variant="danger" onPress={submit} loading={pending} />}>
      <AppText color={colors.textMuted}>{t('disputeHint')}</AppText>
      <AppText weight="semibold">{t('disputeReason')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {DISPUTE_REASONS.map((r) => (
          <Chip key={r} label={t(`disputeReasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      {errors.reason && (
        <AppText size="xs" color={colors.danger}>
          {t(`errors:${errors.reason}`)}
        </AppText>
      )}
      <TextField label={t('disputeDescription')} value={description} onChangeText={setDescription} multiline maxLength={2000} error={errors.description} style={{ minHeight: 120, textAlignVertical: 'top' }} />
      <PhotoGrid photos={photos} onChange={setPhotos} purpose="dispute_photo" />
    </Screen>
  );
}
