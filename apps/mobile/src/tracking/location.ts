// Suivi GPS côté transporteur (F12). Tâche de localisation en arrière-plan (expo-task-manager),
// précision équilibrée, toutes les 10 s ou tous les 25 m, service de premier plan sur Android.
// Hors connexion, seule la dernière position est gardée puis envoyée au retour du réseau.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import i18n from '../i18n';
import { getSocket } from '../realtime/socket';
import { colors } from '../theme';

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

const positionOf = (parcelId: string, loc: Location.LocationObject): Position => ({
  parcelId,
  lat: loc.coords.latitude,
  lng: loc.coords.longitude,
  accuracy: loc.coords.accuracy ?? null,
  heading: loc.coords.heading ?? null,
  speed: loc.coords.speed ?? null,
  at: new Date(loc.timestamp).toISOString(),
});

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACKING_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const parcelId = await AsyncStorage.getItem(ACTIVE_KEY);
  if (!parcelId) return;
  await send(positionOf(parcelId, data.locations[data.locations.length - 1]!));
});

/**
 * Demande premier plan puis arrière-plan. Jamais d'exception : dans Expo Go sur iPhone, l'arrière-plan n'est pas
 * configuré et sa demande échoue ; on retombe alors sur le suivi application ouverte.
 */
export async function requestTrackingPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (!fg?.granted) return { foreground: false, background: false };
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
  return { foreground: true, background: !!bg?.granted };
}

/** Suivi de repli, application ouverte seulement (position « pendant l'utilisation »). */
let foregroundWatch: { parcelId: string; subscription: Location.LocationSubscription } | null = null;

async function startForegroundWatch(parcelId: string) {
  foregroundWatch?.subscription.remove();
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 25 },
    (loc) => void send(positionOf(parcelId, loc)),
  );
  foregroundWatch = { parcelId, subscription };
}

/**
 * Lance le partage de position du colis, de façon idempotente : en arrière-plan si c'est autorisé et possible,
 * sinon application ouverte. Renvoie le mode obtenu, ou null sans aucune autorisation de localisation.
 */
export async function startTracking(parcelId: string): Promise<'background' | 'foreground' | null> {
  await AsyncStorage.setItem(ACTIVE_KEY, parcelId);
  const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (background?.granted) {
    try {
      if (!(await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK).catch(() => false))) {
        await Location.startLocationUpdatesAsync(TRACKING_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,
          distanceInterval: 25,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'UCOLIS',
            notificationBody: i18n.t('parcel:tracking.title'),
            notificationColor: colors.primary,
          },
        });
      }
      return 'background';
    } catch {
      // Arrière-plan non configuré (Expo Go) : repli sur le suivi application ouverte.
    }
  }
  const foreground = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (!foreground?.granted) return null;
  if (foregroundWatch?.parcelId !== parcelId) await startForegroundWatch(parcelId).catch(() => null);
  return foregroundWatch ? 'foreground' : null;
}

export async function stopTracking(parcelId?: string) {
  const active = await AsyncStorage.getItem(ACTIVE_KEY);
  if (parcelId && active && active !== parcelId) return;
  await AsyncStorage.multiRemove([ACTIVE_KEY, PENDING_KEY]);
  foregroundWatch?.subscription.remove();
  foregroundWatch = null;
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  }
}

export const activeTrackingParcel = () => AsyncStorage.getItem(ACTIVE_KEY);
