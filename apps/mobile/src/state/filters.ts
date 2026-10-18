// Filtres des annonces et des trajets, mémorisés entre deux sessions.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ParcelSort, VehicleType } from '@ucolis/shared';

export interface ParcelFilters {
  q?: string;
  fromWilaya?: string;
  toWilaya?: string;
  maxWeight?: number;
  vehicleType?: VehicleType;
  urgent?: boolean;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  radiusKm?: number;
  lat?: number;
  lng?: number;
  proOnly?: boolean;
  verifiedOnly?: boolean;
  sort: ParcelSort;
}

export interface TripFilters {
  fromWilaya?: string;
  toWilaya?: string;
  date?: string;
  vehicleType?: VehicleType;
}

interface FiltersState {
  scope: 'parcels' | 'trips';
  view: 'list' | 'map';
  parcels: ParcelFilters;
  trips: TripFilters;
  setScope: (s: 'parcels' | 'trips') => void;
  setView: (v: 'list' | 'map') => void;
  setParcels: (patch: Partial<ParcelFilters>) => void;
  setTrips: (patch: Partial<TripFilters>) => void;
  removeParcelFilter: (key: keyof ParcelFilters) => void;
  resetParcels: () => void;
  resetTrips: () => void;
}

export const useFilters = create<FiltersState>()(
  persist(
    (set) => ({
      scope: 'parcels',
      view: 'list',
      parcels: { sort: 'recent' },
      trips: {},
      setScope: (scope) => set({ scope }),
      setView: (view) => set({ view }),
      setParcels: (patch) => set((s) => ({ parcels: { ...s.parcels, ...patch } })),
      setTrips: (patch) => set((s) => ({ trips: { ...s.trips, ...patch } })),
      removeParcelFilter: (key) =>
        set((s) => {
          const next = { ...s.parcels };
          delete next[key];
          if (key === 'radiusKm') {
            delete next.lat;
            delete next.lng;
          }
          return { parcels: { ...next, sort: next.sort ?? 'recent' } };
        }),
      resetParcels: () => set({ parcels: { sort: 'recent' } }),
      resetTrips: () => set({ trips: {} }),
    }),
    { name: 'ucolis.filters', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Filtres actifs affichés en puces supprimables (le tri n'en fait pas partie). */
export const activeFilterKeys = (f: ParcelFilters) =>
  (Object.keys(f) as (keyof ParcelFilters)[]).filter(
    (k) => k !== 'sort' && k !== 'lat' && k !== 'lng' && f[k] !== undefined && f[k] !== false && f[k] !== '',
  );
