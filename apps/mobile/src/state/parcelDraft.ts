// Brouillon de l'assistant de publication, persisté : proposé à la reprise si l'application a été fermée.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FileRef, ParcelCategory, PaymentArrangement, TimeSlot, VehicleType } from '@ucolis/shared';
import type { PickedPlace } from '../components/MapPicker';

export interface DraftPlace extends PickedPlace {
  details?: string;
}

export interface ParcelDraft {
  pickup: DraftPlace | null;
  dropoff: DraftPlace | null;
  title: string;
  category: ParcelCategory | null;
  description: string;
  weightKg: number | null;
  weightUnit: 'g' | 'kg';
  dimensionsCm: { length: number | null; width: number | null; height: number | null };
  dimensionUnit: 'cm' | 'm';
  fragile: boolean;
  prohibitedItemsDeclared: boolean;
  vehicleTypes: VehicleType[];
  desiredDate: string | null;
  timeSlot: TimeSlot;
  flexibleDates: boolean;
  urgent: boolean;
  recipientName: string;
  recipientPhone: string;
  paymentArrangement: PaymentArrangement | null;
  requestedPrice: number | null;
  photos: FileRef[];
}

export const EMPTY_DRAFT: ParcelDraft = {
  pickup: null,
  dropoff: null,
  title: '',
  category: null,
  description: '',
  weightKg: null,
  weightUnit: 'kg',
  dimensionsCm: { length: null, width: null, height: null },
  dimensionUnit: 'cm',
  fragile: false,
  prohibitedItemsDeclared: false,
  vehicleTypes: [],
  desiredDate: null,
  timeSlot: 'any',
  flexibleDates: false,
  urgent: false,
  recipientName: '',
  recipientPhone: '',
  paymentArrangement: null,
  requestedPrice: null,
  photos: [],
};

interface DraftState {
  draft: ParcelDraft;
  /** Modification d'une annonce existante : pas de brouillon persisté à reprendre. */
  editingId: string | null;
  touched: boolean;
  update: (patch: Partial<ParcelDraft>) => void;
  start: (draft?: Partial<ParcelDraft>, editingId?: string | null) => void;
  clear: () => void;
}

export const useParcelDraft = create<DraftState>()(
  persist(
    (set) => ({
      draft: EMPTY_DRAFT,
      editingId: null,
      touched: false,
      update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch }, touched: true })),
      start: (draft = {}, editingId = null) => set({ draft: { ...EMPTY_DRAFT, ...draft }, editingId, touched: false }),
      clear: () => set({ draft: EMPTY_DRAFT, editingId: null, touched: false }),
    }),
    { name: 'ucolis.parcel-draft', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
