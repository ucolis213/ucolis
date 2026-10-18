import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, space } from '../theme';
import { AppText } from './AppText';

/** Bandeau « Hors connexion » ; TanStack Query met les requêtes en pause sans réseau. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const online = state.isConnected !== false && state.isInternetReachable !== false;
        onlineManager.setOnline(online);
        setOffline(!online);
      }),
    [],
  );

  if (!offline) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + space(1) }]} accessibilityRole="alert">
      <AppText size="sm" weight="semibold" color="#FFFFFF" align="center">
        {t('offlineBanner')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.navy, paddingBottom: space(2), paddingHorizontal: space(4) },
});
