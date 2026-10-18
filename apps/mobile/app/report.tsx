// Signalement générique (F16) : type et cible en paramètres.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { REPORT_REASONS, type ReportReason } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { space } from '@/theme';

export default function Report() {
  const { t } = useTranslation(['common']);
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!reason) return;
    setPending(true);
    try {
      await api.post('/reports', { targetType: type, targetId: id, reason, description: description.trim() || undefined });
      Alert.alert(t('report.sent'));
      router.back();
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('report.title')} />} footer={<Button label={t('send')} onPress={submit} loading={pending} disabled={!reason} />}>
      <AppText weight="semibold">{t('report.reason')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r} label={t(`report.reasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <TextField label={t('report.description')} value={description} onChangeText={setDescription} multiline maxLength={1000} style={{ minHeight: 100, textAlignVertical: 'top' }} />
    </Screen>
  );
}
