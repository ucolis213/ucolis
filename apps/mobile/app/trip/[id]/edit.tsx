// Modifier un trajet : capacités, heure de départ, prix indicatif, note.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '@/api/client';
import { useTrip } from '@/api/queries';
import { Button } from '@/components/Button';
import { NumberInput, PriceInput } from '@/components/FormBits';
import { LoadingSkeleton } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';

export default function EditTrip() {
  const { t } = useTranslation(['trip', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const qc = useQueryClient();
  const [capacityKg, setCapacityKg] = useState<number | null>(null);
  const [capacityM3, setCapacityM3] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!trip.data) return;
    setCapacityKg(trip.data.capacityKg);
    setCapacityM3(trip.data.capacityM3);
    setAmount(trip.data.priceHint?.amount ?? null);
    setNote(trip.data.note ?? '');
  }, [trip.data]);

  if (!trip.data) {
    return (
      <Screen header={<ScreenHeader title={t('editTitle')} />}>
        <LoadingSkeleton />
      </Screen>
    );
  }

  async function save() {
    setPending(true);
    try {
      await api.patch(`/trips/${id}`, {
        capacityKg,
        capacityM3,
        note,
        priceHint: amount ? { mode: trip.data!.priceHint?.mode ?? 'flat', amount } : null,
      });
      void qc.invalidateQueries({ queryKey: ['trip', id] });
      router.back();
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('editTitle')} />} footer={<Button label={t('common:save')} onPress={save} loading={pending} />}>
      <NumberInput label={t('capacityKg')} value={capacityKg} onChange={setCapacityKg} />
      <NumberInput label={t('capacityM3')} value={capacityM3} onChange={setCapacityM3} />
      <PriceInput label={t('priceHint')} value={amount} onChange={setAmount} />
      <TextField label={t('note')} value={note} onChangeText={setNote} multiline maxLength={300} />
    </Screen>
  );
}
