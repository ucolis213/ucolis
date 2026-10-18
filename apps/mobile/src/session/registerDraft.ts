// Données de l'écran 1 de l'inscription, gardées en mémoire seulement (mot de passe : jamais persisté).

import { create } from 'zustand';
import type { RegisterAccountInput } from '@ucolis/shared';

interface RegisterDraftState {
  account: RegisterAccountInput | null;
  setAccount: (a: RegisterAccountInput) => void;
  clear: () => void;
}

export const useRegisterDraft = create<RegisterDraftState>((set) => ({
  account: null,
  setAccount: (account) => set({ account }),
  clear: () => set({ account: null }),
}));
