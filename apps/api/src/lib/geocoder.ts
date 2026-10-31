// Géocodage appelé uniquement par l'API, résultats en cache. Google si une clé est fournie (jamais embarquée),
// sinon Photon (OpenStreetMap, gratuit, sans clé). Repli sur le référentiel local : commune la plus proche,
// recherche par nom (seule source pour les recherches en arabe, que Photon n'indexe pas).

import {
  WILAYAS,
  getCommune,
  getWilaya,
  nearestCommune,
  placeName,
  type LatLng,
  type Locale,
} from '@ucolis/shared';
import type { Cache } from './cache';

export interface GeoResult {
  /** Libellé court (lieu, rue) pour la première ligne d'une suggestion ; absent pour une commune seule. */
  name?: string;
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
  return [c && placeName(c, locale), w && placeName(w, locale)].filter(Boolean).join(', ');
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

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    countrycode?: string;
    name?: string;
    housenumber?: string;
    street?: string;
  };
}

interface NominatimPlace {
  name?: string;
  address?: { road?: string; house_number?: string; suburb?: string; neighbourhood?: string; country_code?: string };
}

const OSM_TTL_S = 7 * 24 * 3600;
// Cadre de l'Algérie (ouest, sud, est, nord) : oriente Photon ; le pays est vérifié ensuite.
const ALGERIA_BBOX = '-8.7,18.9,12.0,37.2';
const ARABIC = /[\u0600-\u06FF]/;
const USER_AGENT = 'UCOLIS (contact@ucolis.com)';
// Politique d'usage de Nominatim : une requête par seconde au plus.
const NOMINATIM_INTERVAL_MS = 1000;

/** Libellés sans doublon (comparaison insensible à la casse et aux accents). */
function uniqueParts(parts: (string | undefined)[]) {
  const seen = new Set<string>();
  return parts.filter((p): p is string => {
    if (!p?.trim()) return false;
    const k = norm(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * OpenStreetMap, gratuit et sans clé : Photon pour la recherche de lieux et de rues, Nominatim pour l'adresse
 * d'un point (rapide, en français et en arabe). Commune et wilaya viennent toujours du référentiel.
 */
export function createOsmGeocoder(
  urls: { photon: string; nominatim: string },
  cache: Cache,
  opts: { timeoutMs?: number; nominatimIntervalMs?: number } = {},
): Geocoder {
  const local = createLocalGeocoder();
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const interval = opts.nominatimIntervalMs ?? NOMINATIM_INTERVAL_MS;
  let nextNominatimAt = 0;

  async function get<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`OSM ${res.status}`);
    return (await res.json()) as T;
  }

  /** Réserve un créneau d'une requête par seconde (par processus). */
  async function nominatimSlot() {
    const now = Date.now();
    const wait = Math.max(0, nextNominatimAt - now);
    nextNominatimAt = Math.max(now, nextNominatimAt) + interval;
    if (wait) await new Promise((r) => setTimeout(r, wait));
  }

  function result(location: LatLng, name: string | undefined, street: string | undefined, quarter: string | undefined, locale: Locale): GeoResult {
    const near = nearestCommune(location);
    return {
      name: name || street || undefined,
      address: uniqueParts([name, street, quarter, placeName(getCommune(near.communeCode) ?? { fr: '', ar: '' }, locale), placeName(getWilaya(near.wilayaCode) ?? { fr: '', ar: '' }, locale)]).join(', '),
      location,
      wilayaCode: near.wilayaCode,
      commune: near.communeCode,
    };
  }

  return {
    async reverse(point, locale) {
      const key = `geo:osm:rev:${locale}:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
      const hit = await cache.get<GeoResult>(key);
      if (hit) return hit;
      try {
        await nominatimSlot();
        const params = new URLSearchParams({
          lat: String(point.lat),
          lon: String(point.lng),
          format: 'jsonv2',
          zoom: '18',
          'accept-language': locale,
        });
        const place = await get<NominatimPlace>(`${urls.nominatim}/reverse?${params}`);
        const a = place.address;
        const found =
          a?.country_code === 'dz'
            ? result(point, place.name, a.road && [a.house_number, a.road].filter(Boolean).join(' '), a.suburb ?? a.neighbourhood, locale)
            : await local.reverse(point, locale);
        await cache.set(key, found, OSM_TTL_S);
        return found;
      } catch {
        // Service indisponible : réponse locale, non mise en cache.
        return local.reverse(point, locale);
      }
    },
    async search(q, locale) {
      // Photon n'indexe pas les noms arabes : le référentiel les connaît.
      if (ARABIC.test(q)) return local.search(q, locale);
      const key = `geo:osm:search:${locale}:${norm(q)}`;
      const hit = await cache.get<GeoResult[]>(key);
      if (hit) return hit;
      try {
        const params = new URLSearchParams({ q, lang: locale === 'fr' ? 'fr' : 'default', limit: '10', bbox: ALGERIA_BBOX });
        const { features = [] } = await get<{ features?: PhotonFeature[] }>(`${urls.photon}/api?${params}`);
        const seen = new Set<string>();
        const results = features
          .filter((f) => f.properties.countrycode === 'DZ')
          .map((f) => {
            const p = f.properties;
            const [lng, lat] = f.geometry.coordinates;
            return result({ lat, lng }, p.name, p.street && [p.housenumber, p.street].filter(Boolean).join(' '), undefined, locale);
          })
          .filter((r) => !seen.has(r.address) && seen.add(r.address))
          .slice(0, 8);
        const final = results.length ? results : await local.search(q, locale);
        await cache.set(key, final, OSM_TTL_S);
        return final;
      } catch {
        return local.search(q, locale);
      }
    },
  };
}
