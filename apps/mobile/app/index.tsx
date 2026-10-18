// Splash et aiguillage : session, version minimale, maintenance, onboarding, CGU, puis accueil.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { appVersion, startupRoute, useAppConfig } from '@/hooks/useAppConfig';
import { useSession } from '@/session/SessionContext';
import { ONBOARDING_KEY } from '@/storageKeys';
import { colors, space } from '@/theme';

const TARGETS = {
  'update-required': '/update-required',
  maintenance: '/maintenance',
  onboarding: '/onboarding',
  'accept-terms': '/accept-terms',
  home: '/home',
} as const;

export default function Index() {
  const config = useAppConfig();
  const session = useSession();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setOnboardingDone(v === '1'))
      .catch(() => setOnboardingDone(false));
  }, []);

  // On attend la config, sauf si l'API ne répond pas : le hors-ligne ne doit pas bloquer l'accueil.
  if (onboardingDone === null || config.isPending || session.status === 'loading') {
    return (
      <View style={styles.root}>
        <Logo light size={36} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const route = startupRoute({
    config: config.data,
    installedVersion: appVersion(),
    onboardingDone,
    acceptedTermsVersion: session.user ? session.user.terms.version : undefined,
  });
  return <Redirect href={TARGETS[route]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(8),
  },
});
