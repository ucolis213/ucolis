// Démarrer la livraison (F11, F12). Information bien visible avant la demande système de localisation
// (exigence Google Play) ; un refus de l'arrière-plan n'empêche pas de démarrer.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api, errorMessage } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, space } from '@/theme';
import { requestTrackingPermissions, startTracking } from '@/tracking/location';

export default function StartDelivery() {
  const { t } = useTranslation(['common', 'parcel']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    try {
      const perms = await requestTrackingPermissions();
      await api.post(`/parcels/${id}/start`);
      // La livraison est démarrée : un partage de position incomplet ne l'empêche pas.
      const mode = perms.foreground ? await startTracking(id).catch(() => null) : null;
      if (mode !== 'background') Alert.alert(t(mode === 'foreground' ? 'permissions.locationForegroundOnly' : 'permissions.locationDenied'));
      void qc.invalidateQueries({ queryKey: ['parcel', id] });
      router.replace({ pathname: '/parcel/[id]', params: { id } });
    } catch (err) {
      Alert.alert(errorMessage(t, err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title={t('parcel:actions.start_delivery')} />}
      footer={<Button label={t('permissions.locationAllow')} onPress={start} loading={pending} />}
    >
      <View style={styles.icon}>
        <Ionicons name="navigate-circle" size={72} color={colors.accent} />
      </View>
      <AppText size="lg" weight="bold" align="center">
        {t('permissions.locationTitle')}
      </AppText>
      <AppText color={colors.textMuted}>{t('permissions.locationBody')}</AppText>
      <AppText size="sm" color={colors.textMuted}>
        {t('parcel:confirmStart')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({ icon: { alignItems: 'center', marginVertical: space(4) } });
