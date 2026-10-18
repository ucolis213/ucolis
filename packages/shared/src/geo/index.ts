import data from './wilayas.json';
import type { Locale } from '../enums';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Commune {
  code: string;
  fr: string;
  ar: string;
  center: LatLng;
}

export interface Wilaya {
  code: string;
  fr: string;
  ar: string;
  center: LatLng;
  communes: Commune[];
}

interface GeoFile {
  version: string;
  wilayas: Wilaya[];
}

const geo = data as GeoFile;

export const GEO_VERSION = geo.version;
export const WILAYAS: readonly Wilaya[] = geo.wilayas;

const wilayaByCode = new Map(WILAYAS.map((w) => [w.code, w]));
const communeByCode = new Map(
  WILAYAS.flatMap((w) => w.communes.map((c) => [c.code, { ...c, wilayaCode: w.code }] as const)),
);

export function getWilaya(code: string): Wilaya | undefined {
  return wilayaByCode.get(code);
}

export function getCommune(code: string): (Commune & { wilayaCode: string }) | undefined {
  return communeByCode.get(code);
}

export function isValidWilaya(code: string): boolean {
  return wilayaByCode.has(code);
}

export function isCommuneInWilaya(communeCode: string, wilayaCode: string): boolean {
  return communeByCode.get(communeCode)?.wilayaCode === wilayaCode;
}

export function placeName(place: { fr: string; ar: string }, locale: Locale): string {
  return locale === 'ar' ? place.ar : place.fr;
}

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance à vol d'oiseau (Haversine), arrondie à 0,1 km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Commune dont le centre est le plus proche du point (F6, étape Trajet). */
export function nearestCommune(point: LatLng): { wilayaCode: string; communeCode: string } {
  let best = { wilayaCode: '', communeCode: '', d: Infinity };
  for (const w of WILAYAS) {
    for (const c of w.communes) {
      const d = haversineKm(point, c.center);
      if (d < best.d) best = { wilayaCode: w.code, communeCode: c.code, d };
    }
  }
  return { wilayaCode: best.wilayaCode, communeCode: best.communeCode };
}
