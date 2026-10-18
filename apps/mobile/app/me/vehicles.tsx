import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MAX_VEHICLES } from '@ucolis/shared';
import { useVehicles } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { Pill } from '@/components/Badge';
import { Button } from '@/components/Button';
import { SectionCard } from '@/components/FormBits';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, space } from '@/theme';

export default function Vehicles() {
  const { t } = useTranslation(['profile', 'parcel']);
  const query = useVehicles();
  const count = query.data?.items.length ?? 0;
  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={t('vehicles')} />}
      footer={count < MAX_VEHICLES ? <Button label={t('addVehicle')} icon="add" onPress={() => router.push({ pathname: '/me/vehicle/[id]', params: { id: 'new' } })} /> : undefined}
    >
      <QueryView query={query} isEmpty={(d) => d.items.length === 0} empty={{ icon: 'car-outline', title: t('noVehicles') }}>
        {(d) => (
          <View style={{ gap: space(3) }}>
            {d.items.map((v) => (
              <Pressable key={v.id} onPress={() => router.push({ pathname: '/me/vehicle/[id]', params: { id: v.id } })} accessibilityRole="button">
                <SectionCard title={`${v.brand} ${v.model}`} right={v.isDefault ? <Pill label={t('defaultVehicle')} tone="primary" /> : undefined}>
                  <AppText size="sm" color={colors.textMuted}>
                    {t(`parcel:vehicleTypes.${v.type}`)} · {v.plate} · {v.capacityKg} kg · {v.volumeM3} m³
                  </AppText>
                </SectionCard>
              </Pressable>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
