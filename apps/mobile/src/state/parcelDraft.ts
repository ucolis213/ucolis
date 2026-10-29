// Brouillon de l'assistant de publication, persisté : proposé à la reprise si l'application a été fermée.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  FileRef,
  ParcelCategory,
  ParcelPublishMode,
  PaymentArrangement,
  TimeSlot,
  VehicleType,
} from '@ucolis/shared';
import type { PickedPlace } from '../components/MapPicker';

export interface DraftPlace extends PickedPlace {
  details?: string;
}

export interface ParcelDraft {
  /** Publication rapide (par défaut) ou assistant complet en 4 étapes. */
  mode: ParcelPublishMode;
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
  /** « HH:mm » facultatif. */
  desiredTime: string | null;
  flexibleDates: boolean;
  urgent: boolean;
  recipientName: string;
  recipientPhone: string;
  paymentArrangement: PaymentArrangement | null;
  requestedPrice: number | null;
  /** Prix pré-rempli par la suggestion et jamais retouché : il suit la suggestion quand elle change. */
  priceIsSuggested: boolean;
  photos: FileRef[];
}

export const EMPTY_DRAFT: ParcelDraft = {
  mode: 'quick',
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
  desiredTime: null,
  flexibleDates: false,
  urgent: false,
  recipientName: '',
  recipientPhone: '',
  paymentArrangement: null,
  requestedPrice: null,
  priceIsSuggested: false,
  photos: [],
};

interface DraftState {
  draft: ParcelDraft;
  /** Modification d'une annonce existante : pas de brouillon persisté à reprendre. */
  editingId: string | null;
  /** L'annonce modifiée vient d'une publication rapide : elle peut le rester. */
  editingQuick: boolean;
  touched: boolean;
  update: (patch: Partial<ParcelDraft>) => void;
  start: (draft?: Partial<ParcelDraft>, editingId?: string | null) => void;
  clear: () => void;
}

/**
 * Écran d'une nouvelle annonce. Une modification en cours (ouverte puis quittée sans enregistrer) est abandonnée :
 * sinon l'annonce déjà publiée s'ouvrirait à la place d'une nouvelle.
 */
export function newParcelRoute() {
  const s = useParcelDraft.getState();
  if (s.editingId) s.clear();
  return '/parcel/new/quick' as const;
}

/** Premier écran de l'assistant selon le mode du brouillon. */
export const draftEntryRoute = (mode: ParcelPublishMode) =>
  mode === 'quick' ? ('/parcel/new/quick' as const) : ('/parcel/new/route' as const);

export const useParcelDraft = create<DraftState>()(
  persist(
    (set) => ({
      draft: EMPTY_DRAFT,
      editingId: null,
      editingQuick: false,
      touched: false,
      update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch }, touched: true })),
      start: (draft = {}, editingId = null) =>
        set({
          draft: { ...EMPTY_DRAFT, ...draft },
          editingId,
          editingQuick: !!editingId && draft.mode === 'quick',
          touched: false,
        }),
      clear: () => set({ draft: EMPTY_DRAFT, editingId: null, editingQuick: false, touched: false }),
    }),
    {
      name: 'ucolis.parcel-draft',
      storage: createJSONStorage(() => AsyncStorage),
      // Une modification abandonnée sans enregistrer ne survit pas à la fermeture de l'application.
      merge: (persisted, current) => {
        const p = persisted as Partial<DraftState> | undefined;
        return p?.editingId ? current : { ...current, ...p };
      },
      // Version 1 : ajout du mode ; un brouillon antérieur vient de l'assistant complet.
      version: 1,
      migrate: (state, version) => {
        const s = state as DraftState;
        if (version < 1) s.draft = { ...EMPTY_DRAFT, ...s.draft, mode: 'full' };
        return s;
      },
    },
  ),
);
