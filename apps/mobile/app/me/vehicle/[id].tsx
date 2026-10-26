// Ajout ou édition d'un véhicule (id = "new" pour un ajout).

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VEHICLE_TYPES, vehicleInputSchema, type FileRef, type VehicleDto } from '@ucolis/shared';
import { api, errorMessage, fieldErrors } from '@/api/client';
import { useVehicles } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { confirm } from '@/components/ConfirmDialog';
import { FileField } from '@/components/FileField';
import { NumberInput, SwitchRow } from '@/components/FormBits';
import { LoadingSkeleton } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { colors } from '@/theme';

export default function VehicleForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useVehicles();
  const existing = query.data?.items.find((v) => v.id === id);
  if (id !== 'new' && !existing) {
    return (
      <Screen edges={['top', 'bottom']} header={<ScreenHeader title="" />}>
        <LoadingSkeleton />
      </Screen>
    );
  }
  return <VehicleEditor vehicle={existing ?? null} />;
}

function VehicleEditor({ vehicle }: { vehicle: VehicleDto | null }) {
  const { t } = useTranslation(['profile', 'parcel', 'common']);
  const qc = useQueryClient();
  const { refreshMe } = useSession();
  const [type, setType] = useState<string>(vehicle?.type ?? '');
  const [brand, setBrand] = useState(vehicle?.brand ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const [capacityKg, setCapacity] = useState<number | null>(vehicle?.capacityKg ?? null);
  const [volumeM3, setVolume] = useState<number | null>(vehicle?.volumeM3 ?? null);
  const [photo, setPhoto] = useState<FileRef | null>(vehicle?.photo ?? null);
  const [isDefault, setDefault] = useState(vehicle?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = () => {
    void qc.invalidateQueries({ queryKey: ['me', 'vehicles'] });
    void refreshMe();
    router.back();
  };

  async function save() {
    setFormError(null);
    const parsed = vehicleInputSchema.safeParse({ type, brand, model, plate, capacityKg, volumeM3, photo, isDefault });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (vehicle) await api.patch(`/me/vehicles/${vehicle.id}`, parsed.data);
      else await api.post('/me/vehicles', parsed.data);
      done();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!vehicle || !(await confirm({ title: t('deleteVehicle'), message: `${vehicle.brand} ${vehicle.model}`, destructive: true }))) return;
    try {
      await api.delete(`/me/vehicles/${vehicle.id}`);
      done();
    } catch (err) {
      setFormError(errorMessage(t, err));
    }
  }

  return (
    <Screen scroll edges={['top', 'bottom']} header={<ScreenHeader title={vehicle ? t('editVehicle') : t('addVehicle')} />}>
      <Select
        label={t('vehicleType')}
        value={type || undefined}
        options={VEHICLE_TYPES.map((v) => ({ value: v, label: t(`parcel:vehicleTypes.${v}`) }))}
        onChange={setType}
        error={errors.type}
      />
      <TextField label={t('brand')} value={brand} onChangeText={setBrand} error={errors.brand} maxLength={50} />
      <TextField label={`${t('model')} (${t('common:optional')})`} value={model} onChangeText={setModel} error={errors.model} maxLength={50} />
      <TextField label={t('plate')} hint={t('plateHint')} value={plate} onChangeText={setPlate} error={errors.plate} autoCapitalize="characters" maxLength={20} />
      <NumberInput label={`${t('capacityKg')} (${t('common:optional')})`} value={capacityKg} onChange={setCapacity} error={errors.capacityKg} />
      <NumberInput label={`${t('volumeM3')} (${t('common:optional')})`} value={volumeM3} onChange={setVolume} error={errors.volumeM3} />
      <FileField label={t('common:photo')} value={photo} onChange={setPhoto} purpose="vehicle_photo" />
      <SwitchRow label={t('defaultVehicle')} value={isDefault} onChange={setDefault} />
      {formError && <AppText color={colors.danger}>{formError}</AppText>}
      <Button label={t('common:save')} onPress={save} loading={busy} />
      {vehicle && <Button label={t('deleteVehicle')} variant="danger" onPress={remove} />}
    </Screen>
  );
}
