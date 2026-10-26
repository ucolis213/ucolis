// Push : enregistrement du jeton Expo après connexion, ouverture de l'élément concerné au toucher.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { getDeviceId } from '../device';
import { colors } from '../theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** ucolis://parcel/abc/offers → /parcel/abc/offers ; ucolis://tracking/abc → /parcel/abc/tracking. */
export function linkToHref(url: string): Href | null {
  if (!url.startsWith('ucolis://')) return null;
  const path = `/${url.slice('ucolis://'.length)}`;
  const tracking = /^\/tracking\/([a-f\d]{24})$/i.exec(path);
  if (tracking) return `/parcel/${tracking[1]}/tracking` as Href;
  return path as Href;
}

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'UCOLIS',
      // Faux positif d'import/namespace sur la build SDK 58 d'expo-notifications (l'enum est bien exporté).
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: colors.primary,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? existing.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await api.post('/me/push-tokens', {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceId: await getDeviceId(),
    appVersion: Constants.expoConfig?.version,
  });
  return token;
}

/** Toucher une notification ouvre l'écran correspondant par lien profond. */
export function listenToNotificationTaps() {
  const open = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    const href = typeof url === 'string' ? linkToHref(url) : null;
    if (href) router.push(href);
  };
  void Notifications.getLastNotificationResponseAsync().then(open);
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
