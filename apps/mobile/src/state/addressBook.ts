// Sélecteur d'adresse : suggestions locales instantanées (communes du référentiel, en français et en arabe)
// et adresses récentes de l'appareil.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { WILAYAS } from '@ucolis/shared';
import type { PickedPlace } from '../components/MapPicker';
import { normalizeSearch } from '../components/Select';
import { placeLabel } from '../format';
import { RECENT_ADDRESSES_KEY } from '../storageKeys';

/** Suggestion affichée : `name` est le libellé court (lieu, rue) renvoyé par l'API. */
export type AddressSuggestion = PickedPlace & { name?: string };

export const MAX_RECENTS = 6;

/** Communes dont le nom français ou arabe contient la recherche ; celles qui commencent par elle d'abord. */
export function localSuggestions(query: string, limit = 6): AddressSuggestion[] {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];
  const starts: AddressSuggestion[] = [];
  const contains: AddressSuggestion[] = [];
  for (const w of WILAYAS) {
    for (const c of w.communes) {
      const names = [normalizeSearch(c.fr), normalizeSearch(c.ar)];
      const bucket = names.some((n) => n.startsWith(q))
        ? starts
        : names.some((n) => n.includes(q))
          ? contains
          : null;
      bucket?.push({
        address: placeLabel({ commune: c.code, wilayaCode: w.code }),
        location: c.center,
        wilayaCode: w.code,
        commune: c.code,
      });
    }
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Résultats de l'API qui n'apparaissent pas déjà parmi les suggestions locales. */
export function withoutDuplicates(
  remote: AddressSuggestion[],
  local: AddressSuggestion[],
): AddressSuggestion[] {
  const seen = new Set(local.map((s) => s.address));
  return remote.filter((r) => !seen.has(r.address));
}

/** Retire le libellé court : le brouillon et l'API n'attendent que les champs d'un lieu. */
export const toPlace = ({
  address,
  location,
  wilayaCode,
  commune,
}: AddressSuggestion): PickedPlace => ({
  address,
  location,
  wilayaCode,
  commune,
});

export async function loadRecents(): Promise<PickedPlace[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_ADDRESSES_KEY);
    return raw ? (JSON.parse(raw) as PickedPlace[]) : [];
  } catch {
    return [];
  }
}

/** Ajoute en tête (sans doublon) et garde les MAX_RECENTS dernières. */
export async function addRecent(place: PickedPlace): Promise<PickedPlace[]> {
  const next = [place, ...(await loadRecents()).filter((p) => p.address !== place.address)].slice(
    0,
    MAX_RECENTS,
  );
  await AsyncStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(next));
  return next;
}

export const clearRecents = () => AsyncStorage.removeItem(RECENT_ADDRESSES_KEY);
