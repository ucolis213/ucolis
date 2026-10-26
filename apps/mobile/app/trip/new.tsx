// Publier un trajet (F9) : départ, arrivée, 0 à 5 étapes, date et heure, véhicule, capacité, prix
// indicatif, récurrence hebdomadaire sur 8 semaines au plus, note.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAX_TRIP_STOPS, getWilaya, type TripDto } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { AddressSearch } from '@/components/AddressSearch';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateSelect, NumberInput, PriceInput, SectionCard, SwitchRow, TimeSelect } from '@/components/FormBits';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/States';
import { TextField } from '@/components/TextField';
import type { PickedPlace } from '@/components/MapPicker';
import { RouteFields } from '@/components/RoutePicker';
import { placeLabel } from '@/format';
import { showVerificationRequired } from '@/components/VerificationNotice';
import { useSession } from '@/session/SessionContext';
import { colors, MIN_TOUCH, space } from '@/theme';

/** Départ proposé par défaut : la commune du profil (son centre), modifiable comme toute adresse. */
function homePlace(wilayaCode?: string | null, commune?: string | null): PickedPlace | null {
  const w = wilayaCode ? getWilaya(wilayaCode) : undefined;
  const c = w?.communes.find((x) => x.code === commune);
  if (!w || !c) return null;
  return { address: placeLabel({ wilayaCode: w.code, commune: c.code }), wilayaCode: w.code, commune: c.code, location: c.center };
}

/** Point envoyé à l'API : wilaya, commune et position précise de l'adresse choisie. */
const endpoint = (p: PickedPlace | null) => (p ? { wilayaCode: p.wilayaCode, commune: p.commune, location: p.location } : undefined);

/** Une étape est une wilaya traversée (PRD F9) : seule la wilaya de l'adresse choisie est envoyée, sans doublon. */
const stopWilayas = (stops: PickedPlace[]) => [...new Set(stops.map((s) => s.wilayaCode))];

export default function NewTrip() {
  const { t } = useTranslation(['trip', 'parcel', 'common', 'offer', 'profile']);
  const { user } = useSession();
  const qc = useQueryClient();
  const [from, setFrom] = useState<PickedPlace | null>(() => homePlace(user?.wilayaCode, user?.commune));
  const [to, setTo] = useState<PickedPlace | null>(null);
  const [stops, setStops] = useState<PickedPlace[]>([]);
  const [addingStop, setAddingStop] = useState(false);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('08:00');
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
  // Erreurs de l'API (from.*, to.*) rapportées aux champs Départ et Arrivée.
  const routeErrors = Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => /^(from|to)(\.|$)/.test(k))
      .map(([k, v]) => [k.startsWith('from') ? 'pickup' : 'dropoff', v]),
  );

  const departureAt = useMemo(() => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
    return d;
  }, [date, time]);

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
        from: endpoint(from),
        to: endpoint(to),
        stops: stopWilayas(stops),
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
      if (showVerificationRequired(t, err)) return;
      const f = fieldErrors(err);
      setErrors(f);
      if (!Object.keys(f).length) Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={t('newTitle')} />} footer={<Button label={t('publish')} onPress={publish} loading={pending} />}>
      {/* Même saisie que pour un colis : recherche, position actuelle, adresses récentes ou carte. */}
      <RouteFields
        value={{ pickup: from, dropoff: to }}
        onChange={(field, place) => (field === 'pickup' ? setFrom(place) : setTo(place))}
        errors={routeErrors}
        placeholders={{ pickup: t('whereFrom'), dropoff: t('whereTo') }}
      />
      <SectionCard title={t('stops')}>
        {stops.map((s, i) => (
          <View key={`${s.address}-${i}`} style={styles.stop}>
            <View style={styles.ring} />
            <AppText style={styles.flex} numberOfLines={1}>
              {s.address}
            </AppText>
            <AppText color={colors.danger} onPress={() => setStops(stops.filter((_, k) => k !== i))} accessibilityRole="button">
              ✕
            </AppText>
          </View>
        ))}
        {stops.length < MAX_TRIP_STOPS && (
          <Pressable style={styles.addStop} onPress={() => setAddingStop(true)} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <AppText weight="semibold" color={colors.primary}>
              {t('addStop')}
            </AppText>
          </Pressable>
        )}
        {errors.stops && (
          <AppText size="xs" color={colors.danger}>
            {t(`errors:${errors.stops}`, { defaultValue: errors.stops })}
          </AppText>
        )}
      </SectionCard>
      {/* Même recherche que le départ et l'arrivée, sur un seul champ. */}
      <AddressSearch
        visible={addingStop}
        fields={['stop']}
        field="stop"
        title={t('addStop')}
        values={{}}
        placeholders={{ stop: t('whereStop') }}
        onFieldChange={() => undefined}
        onClose={() => setAddingStop(false)}
        onSelect={(_, place) => setStops((prev) => [...prev, place])}
      />
      <DateSelect label={t('departureDate')} value={date} onChange={setDate} error={errors.departureAt} />
      <TimeSelect label={t('departureTime')} value={time} onChange={(v) => v && setTime(v)} required />

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
      {hintMode && <PriceInput label={t('priceHint')} value={hintAmount} onChange={setHintAmount} error={errors['priceHint.amount']} />}

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
  stop: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 32 },
  ring: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.navy },
  addStop: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: MIN_TOUCH },
});
