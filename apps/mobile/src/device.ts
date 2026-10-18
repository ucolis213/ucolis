// Identifiant d'appareil stable, gardé dans expo-secure-store (lié au jeton de rafraîchissement).

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Platform as AppPlatform } from '@ucolis/shared';

const DEVICE_ID_KEY = 'ucolis.deviceId';

const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = randomId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

export async function deviceInfo(): Promise<{
  deviceId: string;
  deviceName: string;
  platform: AppPlatform;
}> {
  return {
    deviceId: await getDeviceId(),
    deviceName: Constants.deviceName ?? Application.applicationName ?? 'mobile',
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  };
}
