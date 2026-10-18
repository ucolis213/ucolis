// Publier un trajet (F9) : départ, arrivée, 0 à 5 étapes, date et heure, véhicule, capacité, prix
// indicatif, récurrence hebdomadaire sur 8 semaines au plus, note.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAX_TRIP_STOPS, getWilaya, type TripDto } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateSelect, NumberInput, PriceInput, SectionCard, SwitchRow } from '@/components/FormBits';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Select } from '@/components/Select';
import { EmptyState } from '@/components/States';
import { TextField } from '@/components/TextField';
import { WilayaCommuneSelect, useWilayaOptions, type PlaceValue } from '@/components/WilayaCommuneSelect';
import { useSession } from '@/session/SessionContext';
import { colors, space } from '@/theme';

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }));

/** Point de la commune (centre), pour la carte et les calculs de distance. */
const locationOf = (p: PlaceValue) => {
  const w = getWilaya(p.wilayaCode);
  const c = w?.communes.find((x) => x.code === p.commune);
  return c?.center ?? w?.center ?? { lat: 36.75, lng: 3.05 };
};

export default function NewTrip() {
  const { t } = useTranslation(['trip', 'parcel', 'common', 'offer', 'profile']);
  const { user } = useSession();
  const qc = useQueryClient();
  const wilayas = useWilayaOptions();
  const [from, setFrom] = useState<PlaceValue>({ wilayaCode: user?.wilayaCode ?? '', commune: user?.commune ?? '' });
  const [to, setTo] = useState<PlaceValue>({ wilayaCode: '', commune: '' });
  const [stops, setStops] = useState<string[]>([]);
  const [date, setDate] = useState<Date | null>(null);
  const [hour, setHour] = useState('8');
  const [vehicleId, setVehicleId] = useState<string | null>(user?.vehicles.find((v) => v.isDefault)?.id ?? user?.vehicles[0]?.id ?? null);
  const vehicle = user?.vehicles.find((v) => v.id === vehicleId);
  const [capacityKg, setCapacityKg] = useState<number | null>(vehicle?.capacityKg ?? null);
  const [capacityM3, setCapacityM3] = useState<number | null>(vehicle?.volumeM3 ?? null);
  const [hintMode, setHintMode] = useState<'flat' | 'per_kg' | null>(null);
  const [hintAmount, setHintAmount] = useState<number | null>(null);
  const [recurring, setRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const days = t('days', { returnObjects: true }) as string[];

  const departureAt = useMemo(() => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(Number(hour), 0, 0, 0);
    return d;
  }, [date, hour]);

  if (user && user.carrierVerification.status !== 'approved') {
    return (
      <Screen edges={['top', 'bottom']} header={<ScreenHeader title={t('newTitle')} />}>
        <EmptyState icon="shield-checkmark-outline" title={t('offer:needVerification')} actionLabel={t('common:continue')} onAction={() => router.replace('/me/carrier-verification')} />
      </Screen>
    );
  }
  if (!user?.vehicles.length) {
    return (
      <Screen edges={['top', 'bottom']} header={<ScreenHeader title={t('newTitle')} />}>
        <EmptyState icon="car-outline" title={t('profile:noVehicles')} actionLabel={t('profile:addVehicle')} onAction={() => router.replace('/me/vehicles')} />
      </Screen>
    );
  }

  async function publish() {
    setPending(true);
    setErrors({});
    try {
      const res = await api.post<{ items: TripDto[] }>('/trips', {
        from: { ...from, location: locationOf(from) },
        to: { ...to, location: locationOf(to) },
        stops,
        departureAt: departureAt?.toISOString(),
        vehicleId,
        capacityKg,
        capacityM3,
        priceHint: hintMode && hintAmount ? { mode: hintMode, amount: hintAmount } : null,
        recurrence: recurring && weekdays.length && until ? { weekdays, until: until.toISOString() } : null,
        note: note.trim() || undefined,
      });
      void qc.invalidateQueries({ queryKey: ['me', 'trips'] });
      void qc.invalidateQueries({ queryKey: ['trips'] });
      Alert.alert(t('published'));
      router.replace({ pathname: '/trip/[id]', params: { id: res.items[0]!.id } });
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(f);
      if (!Object.keys(f).length) Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('newTitle')} />} footer={<Button label={t('publish')} onPress={publish} loading={pending} />}>
      <SectionCard title={t('common:from')}>
        <WilayaCommuneSelect value={from} onChange={setFrom} errors={{ wilaya: errors['from.wilayaCode'], commune: errors['from.commune'] }} />
      </SectionCard>
      <SectionCard title={t('stops')}>
        {stops.map((s, i) => (
          <View key={`${s}-${i}`} style={styles.stop}>
            <AppText style={styles.flex}>
              {i + 1}. {wilayas.find((w) => w.value === s)?.label}
            </AppText>
            <AppText color={colors.danger} onPress={() => setStops(stops.filter((_, k) => k !== i))} accessibilityRole="button">
              ✕
            </AppText>
          </View>
        ))}
        {stops.length < MAX_TRIP_STOPS && <Select label={t('addStop')} value={undefined} options={wilayas} onChange={(v) => setStops([...stops, v])} />}
      </SectionCard>
      <SectionCard title={t('common:to')}>
        <WilayaCommuneSelect value={to} onChange={setTo} errors={{ wilaya: errors['to.wilayaCode'], commune: errors['to.commune'] }} />
      </SectionCard>
      <DateSelect label={t('departureDate')} value={date} onChange={setDate} error={errors.departureAt} />
      <Select label={t('departureTime')} value={hour} options={HOURS} onChange={setHour} />

      <AppText weight="semibold">{t('offer:vehicle')}</AppText>
      <View style={styles.chips}>
        {user.vehicles.map((v) => (
          <Chip
            key={v.id}
            label={`${t(`parcel:vehicleTypes.${v.type}`)} · ${v.brand}`}
            selected={vehicleId === v.id}
            onPress={() => {
              setVehicleId(v.id);
              setCapacityKg(v.capacityKg);
              setCapacityM3(v.volumeM3);
            }}
          />
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <NumberInput label={t('capacityKg')} value={capacityKg} onChange={setCapacityKg} error={errors.capacityKg} />
        </View>
        <View style={styles.flex}>
          <NumberInput label={t('capacityM3')} value={capacityM3} onChange={setCapacityM3} error={errors.capacityM3} />
        </View>
      </View>

      <AppText weight="semibold">{t('priceHint')}</AppText>
      <View style={styles.chips}>
        <Chip label={t('flat')} selected={hintMode === 'flat'} onPress={() => setHintMode(hintMode === 'flat' ? null : 'flat')} />
        <Chip label={t('perKg')} selected={hintMode === 'per_kg'} onPress={() => setHintMode(hintMode === 'per_kg' ? null : 'per_kg')} />
      </View>
      {hintMode && <PriceInput label={t('priceHint')} value={hintAmount} onChange={setHintAmount} />}

      <SwitchRow label={t('recurrence')} value={recurring} onChange={setRecurring} />
      {recurring && (
        <>
          <View style={styles.chips}>
            {days.map((d, i) => (
              <Chip key={d} label={d} selected={weekdays.includes(i)} onPress={() => setWeekdays(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])} />
            ))}
          </View>
          <DateSelect label={t('until')} value={until} onChange={setUntil} days={57} error={errors['recurrence.until']} />
        </>
      )}
      <TextField label={t('note')} value={note} onChangeText={setNote} multiline maxLength={300} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space(3) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  stop: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
});
