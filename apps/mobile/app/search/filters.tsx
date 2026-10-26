// Filtres des annonces (F7) ou des trajets (F9), avec « Enregistrer cette recherche » (F10).

import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PARCEL_SORTS, RADIUS_OPTIONS_KM, VEHICLE_TYPES } from '@ucolis/shared';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateSelect, NumberInput, PriceInput, SwitchRow } from '@/components/FormBits';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/SheetContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Select } from '@/components/Select';
import { useWilayaOptions } from '@/components/WilayaCommuneSelect';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useFilters, type ParcelFilters, type TripFilters } from '@/state/filters';
import { colors, routeArrow, space } from '@/theme';

export default function Filters() {
  const { scope: scopeParam } = useLocalSearchParams<{ scope?: string }>();
  const store = useFilters();
  const scope = scopeParam === 'trips' ? 'trips' : 'parcels';
  return <Sheet>{scope === 'trips' ? <TripFiltersForm initial={store.trips} /> : <ParcelFiltersForm initial={store.parcels} />}</Sheet>;
}

function ChipGroup<T extends string>({ value, options, onChange }: { value?: T; options: { value: T; label: string }[]; onChange: (v: T | undefined) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(value === o.value ? undefined : o.value)} />
      ))}
    </View>
  );
}

function ParcelFiltersForm({ initial }: { initial: ParcelFilters }) {
  const { t } = useTranslation(['parcel', 'common', 'errors']);
  const setParcels = useFilters((s) => s.setParcels);
  const requireAuth = useRequireAuth();
  const [f, setF] = useState<ParcelFilters>(initial);
  const wilayas = useWilayaOptions();
  const set = (patch: Partial<ParcelFilters>) => setF((cur) => ({ ...cur, ...patch }));

  async function setRadius(radiusKm: number | undefined) {
    if (!radiusKm) return set({ radiusKm: undefined, lat: undefined, lng: undefined });
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    set({ radiusKm, lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  function apply() {
    setParcels(f);
    router.back();
  }

  function save() {
    requireAuth(() => {
      Alert.prompt?.(t('filters.searchName'), undefined, async (name) => {
        if (!name?.trim()) return;
        await saveSearch(name.trim());
      });
      // Android n'a pas Alert.prompt : nom automatique à partir du trajet.
      if (!Alert.prompt) void saveSearch([f.fromWilaya, f.toWilaya].filter(Boolean).join(` ${routeArrow()} `) || t('filters.title'));
    });
  }

  async function saveSearch(name: string) {
    try {
      const { sort: _sort, ...filters } = f;
      await api.post('/me/saved-searches', { name, scope: 'parcels', filters, notify: true });
      Alert.alert(t('filters.saved'));
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    }
  }

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={t('filters.title')} right={<AppText weight="semibold" color={colors.primaryDark} onPress={() => setF({ sort: 'recent' })}>{t('common:reset')}</AppText>} />}
      footer={
        <>
          <Button label={t('common:apply')} onPress={apply} />
          <Button label={t('filters.saveSearch')} variant="ghost" icon="notifications-outline" onPress={save} />
        </>
      }
    >
      <AppText weight="semibold">{t('common:sortBy')}</AppText>
      <View style={styles.chips}>
        {PARCEL_SORTS.map((s) => (
          <Chip key={s} label={t(`sort.${s}`)} selected={f.sort === s} onPress={() => (s === 'nearest' && !f.lat ? setRadius(100).then(() => set({ sort: s })) : set({ sort: s }))} />
        ))}
      </View>
      <Select label={t('filters.fromWilaya')} value={f.fromWilaya} options={wilayas} onChange={(v) => set({ fromWilaya: v })} />
      <Select label={t('filters.toWilaya')} value={f.toWilaya} options={wilayas} onChange={(v) => set({ toWilaya: v })} />
      <NumberInput label={t('filters.maxWeight')} value={f.maxWeight ?? null} onChange={(v) => set({ maxWeight: v ?? undefined })} />
      <AppText weight="semibold">{t('filters.vehicleType')}</AppText>
      <ChipGroup value={f.vehicleType} options={VEHICLE_TYPES.map((v) => ({ value: v, label: t(`vehicleTypes.${v}`) }))} onChange={(v) => set({ vehicleType: v })} />
      <DateSelect label={t('filters.dateFrom')} value={f.dateFrom ? new Date(f.dateFrom) : null} onChange={(d) => set({ dateFrom: d.toISOString() })} />
      <DateSelect label={t('filters.dateTo')} value={f.dateTo ? new Date(f.dateTo) : null} onChange={(d) => set({ dateTo: d.toISOString() })} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <PriceInput label={t('filters.priceMin')} value={f.priceMin ?? null} onChange={(v) => set({ priceMin: v ?? undefined })} />
        </View>
        <View style={styles.flex}>
          <PriceInput label={t('filters.priceMax')} value={f.priceMax ?? null} onChange={(v) => set({ priceMax: v ?? undefined })} />
        </View>
      </View>
      <AppText weight="semibold">{t('filters.radius')}</AppText>
      <ChipGroup
        value={f.radiusKm ? String(f.radiusKm) : undefined}
        options={RADIUS_OPTIONS_KM.map((r) => ({ value: String(r), label: `${r} km` }))}
        onChange={(v) => setRadius(v ? Number(v) : undefined)}
      />
      <SwitchRow label={t('filters.urgentOnly')} value={!!f.urgent} onChange={(v) => set({ urgent: v || undefined })} />
      <SwitchRow label={t('filters.proOnly')} value={!!f.proOnly} onChange={(v) => set({ proOnly: v || undefined })} />
      <SwitchRow label={t('filters.verifiedOnly')} value={!!f.verifiedOnly} onChange={(v) => set({ verifiedOnly: v || undefined })} />
    </Screen>
  );
}

function TripFiltersForm({ initial }: { initial: TripFilters }) {
  const { t } = useTranslation(['parcel', 'common', 'trip']);
  const setTrips = useFilters((s) => s.setTrips);
  const requireAuth = useRequireAuth();
  const [f, setF] = useState<TripFilters>(initial);
  const wilayas = useWilayaOptions();
  const set = (patch: Partial<TripFilters>) => setF((cur) => ({ ...cur, ...patch }));
  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={t('filters.title')} />}
      footer={
        <>
          <Button label={t('common:apply')} onPress={() => (setTrips(f), router.back())} />
          <Button
            label={t('filters.saveSearch')}
            variant="ghost"
            icon="notifications-outline"
            onPress={() =>
              requireAuth(async () => {
                const name = [f.fromWilaya, f.toWilaya].filter(Boolean).join(` ${routeArrow()} `) || t('trip:trips');
                await api.post('/me/saved-searches', { name, scope: 'trips', filters: f, notify: true });
                Alert.alert(t('filters.saved'));
              })
            }
          />
        </>
      }
    >
      <Select label={t('filters.fromWilaya')} value={f.fromWilaya} options={wilayas} onChange={(v) => set({ fromWilaya: v })} />
      <Select label={t('filters.toWilaya')} value={f.toWilaya} options={wilayas} onChange={(v) => set({ toWilaya: v })} />
      <DateSelect label={t('common:date')} value={f.date ? new Date(f.date) : null} onChange={(d) => set({ date: d.toISOString() })} />
      <AppText weight="semibold">{t('filters.vehicleType')}</AppText>
      <ChipGroup value={f.vehicleType} options={VEHICLE_TYPES.map((v) => ({ value: v, label: t(`vehicleTypes.${v}`) }))} onChange={(v) => set({ vehicleType: v })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space(3) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
