// Position du transporteur pour les colis proches de lui : envoyée à l'ouverture de l'application, au retour au
// premier plan, puis toutes les 15 min tant qu'elle reste ouverte. Autorisation « pendant l'utilisation »
// seulement, demandée une fois : un refus n'est jamais redemandé. Hors livraison, rien n'est suivi app fermée.

import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api } from '../api/client';

export const POSITION_INTERVAL_MS = 15 * 60_000;
/** Tolérance : un minuteur de 15 min ne doit pas être bloqué par un envoi fait 14 min 59 s plus tôt. */
const TOLERANCE_MS = 60_000;

let lastSentAt = 0;

export async function reportPosition(now = Date.now()) {
  if (now - lastSentAt < POSITION_INTERVAL_MS - TOLERANCE_MS) return false;
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status === 'undetermined') perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return false;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await api.put('/me/position', { lat: pos.coords.latitude, lng: pos.coords.longitude });
  lastSentAt = now;
  return true;
}

/** Réinitialisation (déconnexion, tests). */
export function resetReportedPosition() {
  lastSentAt = 0;
}

export function useNearbyPosition(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      reportPosition().catch(() => undefined);
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    const timer = setInterval(run, POSITION_INTERVAL_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [enabled]);
}
