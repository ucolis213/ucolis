// Suivi GPS côté transporteur (F12). Tâche de localisation en arrière-plan (expo-task-manager),
// précision équilibrée, toutes les 10 s ou tous les 25 m, service de premier plan sur Android.
// Hors connexion, seule la dernière position est gardée puis envoyée au retour du réseau.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import i18n from '../i18n';
import { getSocket } from '../realtime/socket';

export const TRACKING_TASK = 'ucolis-delivery-tracking';
const ACTIVE_KEY = 'ucolis.tracking.parcelId';
const PENDING_KEY = 'ucolis.tracking.pending';

interface Position {
  parcelId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  at: string;
}

async function send(position: Position) {
  const socket = getSocket();
  if (socket?.connected) {
    socket.emit('tracking:position', position);
    await AsyncStorage.removeItem(PENDING_KEY);
  } else {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(position));
  }
}

/** Au retour du réseau : envoie la dernière position gardée. */
export async function flushPendingPosition() {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (raw) await send(JSON.parse(raw) as Position);
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACKING_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const parcelId = await AsyncStorage.getItem(ACTIVE_KEY);
  if (!parcelId) return;
  const loc = data.locations[data.locations.length - 1]!;
  await send({
    parcelId,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    heading: loc.coords.heading ?? null,
    speed: loc.coords.speed ?? null,
    at: new Date(loc.timestamp).toISOString(),
  });
});

/** Demande premier plan puis arrière-plan. Renvoie false si le suivi en arrière-plan est refusé. */
export async function requestTrackingPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { foreground: false, background: false };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg.granted };
}

export async function startTracking(parcelId: string) {
  await AsyncStorage.setItem(ACTIVE_KEY, parcelId);
  const { granted } = await Location.getBackgroundPermissionsAsync();
  if (!granted) return false;
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK).catch(() => false)) return true;
  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10_000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'UCOLIS',
      notificationBody: i18n.t('parcel:tracking.title'),
      notificationColor: '#FF6B35',
    },
  });
  return true;
}

export async function stopTracking(parcelId?: string) {
  const active = await AsyncStorage.getItem(ACTIVE_KEY);
  if (parcelId && active && active !== parcelId) return;
  await AsyncStorage.multiRemove([ACTIVE_KEY, PENDING_KEY]);
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  }
}

export const activeTrackingParcel = () => AsyncStorage.getItem(ACTIVE_KEY);
