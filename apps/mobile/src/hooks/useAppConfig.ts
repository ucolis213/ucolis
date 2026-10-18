import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { compareVersions, type PublicAppConfig } from '@ucolis/shared';
import { fetchAppConfig } from '../api/client';

export const appVersion = () => Constants.expoConfig?.version ?? '0.0.0';

export function useAppConfig() {
  return useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig, staleTime: 5 * 60_000 });
}

export type StartupRoute = 'update-required' | 'maintenance' | 'onboarding' | 'accept-terms' | 'home';

/** Aiguillage du splash. Sans réseau, on laisse passer : l'API refusera ce qui doit l'être. */
export function startupRoute(opts: {
  config: PublicAppConfig | undefined;
  installedVersion: string;
  onboardingDone: boolean;
  acceptedTermsVersion?: string | null;
}): StartupRoute {
  const { config, installedVersion, onboardingDone, acceptedTermsVersion } = opts;
  if (config && compareVersions(installedVersion, config.minAppVersion) < 0) return 'update-required';
  if (config?.maintenance.enabled) return 'maintenance';
  if (!onboardingDone) return 'onboarding';
  if (config && acceptedTermsVersion !== undefined && acceptedTermsVersion !== config.termsVersion) {
    return 'accept-terms';
  }
  return 'home';
}
