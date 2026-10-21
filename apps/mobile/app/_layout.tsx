import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import i18n, { initI18n } from '@/i18n';
import { listenToNotificationTaps, registerForPush } from '@/notifications/push';
import { SocketProvider, useSocket } from '@/realtime/socket';
import { SessionProvider, isCarrierIntent, useSession } from '@/session/SessionContext';
import { colors, fontAssets } from '@/theme';
import { flushPendingPosition } from '@/tracking/location';
import { useNearbyPosition } from '@/tracking/nearbyPosition';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: 24 * 3600_000 } },
});

// Cache persisté pour le réseau faible : listes et détails consultés (pas les données sensibles).
const PERSISTED = new Set(['parcels', 'parcel', 'trips', 'trip', 'conversations', 'app-config', 'user']);
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'ucolis.query-cache' });

/**
 * Effets liés à la session : push après connexion, position des transporteurs (colis proches), envoi des
 * positions de livraison en attente au retour du réseau.
 */
function SessionEffects() {
  const { status, user } = useSession();
  const { connected } = useSocket();
  useNearbyPosition(status === 'authenticated' && isCarrierIntent(user?.intent));
  useEffect(() => listenToNotificationTaps(), []);
  useEffect(() => {
    if (status === 'authenticated') registerForPush().catch(() => undefined);
  }, [status]);
  useEffect(() => {
    if (connected) flushPendingPosition().catch(() => undefined);
  }, [connected]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n()
      .catch(() => undefined)
      .finally(() => setI18nReady(true));
  }, []);

  const ready = (fontsLoaded || !!fontError) && i18nReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 3600_000,
          dehydrateOptions: {
            shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])),
          },
        }}
      >
        <SafeAreaProvider>
          <SessionProvider>
            <SocketProvider>
              <SessionEffects />
              <StatusBar style="dark" />
              <OfflineBanner />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
                <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
                <Stack.Screen name="report" options={{ presentation: 'modal' }} />
                <Stack.Screen name="search/filters" options={{ presentation: 'modal' }} />
                <Stack.Screen name="update-required" options={{ gestureEnabled: false }} />
                <Stack.Screen name="maintenance" options={{ gestureEnabled: false }} />
              </Stack>
            </SocketProvider>
          </SessionProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </I18nextProvider>
  );
}
