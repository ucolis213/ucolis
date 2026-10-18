// Géocodage par Google, appelé uniquement par l'API (clé jamais embarquée), résultats en cache 30 jours.
// Sans clé (développement), repli sur le référentiel local : commune la plus proche, recherche par nom.

import {
  WILAYAS,
  getCommune,
  getWilaya,
  nearestCommune,
  type LatLng,
  type Locale,
} from '@ucolis/shared';
import type { Cache } from './cache';

export interface GeoResult {
  address: string;
  location: LatLng;
  wilayaCode: string;
  commune: string;
}

export interface Geocoder {
  reverse(point: LatLng, locale: Locale): Promise<GeoResult>;
  search(q: string, locale: Locale): Promise<GeoResult[]>;
}

const CACHE_TTL_S = 30 * 24 * 3600;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function localLabel(wilayaCode: string, communeCode: string, locale: Locale) {
  const c = getCommune(communeCode);
  const w = getWilaya(wilayaCode);
  return [c?.[locale], w?.[locale]].filter(Boolean).join(', ');
}

export function createLocalGeocoder(): Geocoder {
  return {
    async reverse(point, locale) {
      const near = nearestCommune(point);
      return {
        address: localLabel(near.wilayaCode, near.communeCode, locale),
        location: point,
        wilayaCode: near.wilayaCode,
        commune: near.communeCode,
      };
    },
    async search(q, locale) {
      const needle = norm(q);
      if (needle.length < 2) return [];
      const results: GeoResult[] = [];
      for (const w of WILAYAS) {
        for (const c of w.communes) {
          if (norm(c.fr).includes(needle) || c.ar.includes(q.trim())) {
            results.push({
              address: localLabel(w.code, c.code, locale),
              location: c.center,
              wilayaCode: w.code,
              commune: c.code,
            });
          }
          if (results.length >= 10) return results;
        }
      }
      return results;
    },
  };
}

interface GoogleResponse {
  status: string;
  results: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
}

export function createGoogleGeocoder(apiKey: string, cache: Cache): Geocoder {
  async function call(params: Record<string, string>): Promise<GoogleResponse['results']> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({ ...params, key: apiKey })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google geocoding ${res.status}`);
    const body = (await res.json()) as GoogleResponse;
    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') throw new Error(`Google geocoding ${body.status}`);
    return body.results;
  }
  const toResult = (r: GoogleResponse['results'][number]): GeoResult => {
    const location = r.geometry.location;
    const near = nearestCommune(location);
    return { address: r.formatted_address, location, wilayaCode: near.wilayaCode, commune: near.communeCode };
  };

  return {
    async reverse(point, locale) {
      // Arrondi à ~10 m pour mutualiser le cache.
      const key = `geo:rev:${locale}:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
      const hit = await cache.get<GeoResult>(key);
      if (hit) return hit;
      const [first] = await call({ latlng: `${point.lat},${point.lng}`, language: locale });
      const result = first ? { ...toResult(first), location: point } : await createLocalGeocoder().reverse(point, locale);
      await cache.set(key, result, CACHE_TTL_S);
      return result;
    },
    async search(q, locale) {
      const key = `geo:search:${locale}:${norm(q)}`;
      const hit = await cache.get<GeoResult[]>(key);
      if (hit) return hit;
      const results = (await call({ address: q, components: 'country:DZ', language: locale }))
        .slice(0, 8)
        .map(toResult);
      await cache.set(key, results, CACHE_TTL_S);
      return results;
    },
  };
}
