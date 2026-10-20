// Configuration Expo. Les clés viennent de l'environnement (EAS secrets en build).

import type { ExpoConfig } from 'expo/config';

const LOCATION_FR =
  "UCOLIS partage votre position avec l'expéditeur uniquement pendant une livraison que vous avez démarrée, y compris en arrière-plan, pour qu'il suive son colis en temps réel.";

const config: ExpoConfig = {
  name: 'UCOLIS',
  slug: 'ucolis',
  scheme: 'ucolis',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#F6F7F9',
  runtimeVersion: { policy: 'appVersion' },
  updates: process.env.EAS_UPDATE_URL ? { url: process.env.EAS_UPDATE_URL } : undefined,
  ios: {
    bundleIdentifier: 'dz.ucolis.app',
    supportsTablet: true,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      UIBackgroundModes: ['location', 'remote-notification'],
      NSLocationWhenInUseUsageDescription: LOCATION_FR,
      NSLocationAlwaysAndWhenInUseUsageDescription: LOCATION_FR,
      NSCameraUsageDescription: 'UCOLIS utilise l’appareil photo pour photographier vos colis et vos documents.',
      NSPhotoLibraryUsageDescription: 'UCOLIS accède à vos photos pour illustrer vos colis et envoyer vos documents.',
    },
  },
  android: {
    package: 'dz.ucolis.app',
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'CAMERA',
      'POST_NOTIFICATIONS',
    ],
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '' } },
  },
  // Textes de permission iOS traduits (InfoPlist.strings) : français par défaut, arabe.
  locales: { fr: './locales/fr.json', ar: './locales/ar.json' },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-font',
    ['expo-splash-screen', { backgroundColor: '#1C1C2E' }],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: LOCATION_FR,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    ['expo-notifications', { color: '#FF6B35' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'UCOLIS accède à vos photos pour illustrer vos colis et envoyer vos documents.',
        cameraPermission: 'UCOLIS utilise l’appareil photo pour photographier vos colis et vos documents.',
      },
    ],
    'expo-document-picker',
  ],
  experiments: { typedRoutes: true },
  extra: {
    supportsRTL: true,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
