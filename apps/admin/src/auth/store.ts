// Session du staff hors React, pour que le client HTTP puisse rafraîchir le jeton.
// Le jeton d'accès reste en mémoire ; le jeton de rafraîchissement va en sessionStorage (onglet seulement),
// et l'API l'invalide de toute façon après 30 min d'inactivité.

import type { Permission, StaffRole } from '@ucolis/shared';

export interface StaffDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  permissions: Permission[];
  status: 'invited' | 'active' | 'disabled';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface StaffSession {
  accessToken: string;
  refreshToken: string;
  staff: StaffDto;
}

const REFRESH_KEY = 'ucolis.staff.refresh';
type Listener = (s: StaffSession | null) => void;

let current: StaffSession | null = null;
const listeners = new Set<Listener>();

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const sessionStore = {
  get: () => current,
  set(next: StaffSession | null) {
    current = next;
    try {
      if (next) storage()?.setItem(REFRESH_KEY, next.refreshToken);
      else storage()?.removeItem(REFRESH_KEY);
    } catch {
      // Stockage indisponible : la session reste valable jusqu'au rechargement.
    }
    for (const l of listeners) l(next);
  },
  storedRefreshToken(): string | null {
    try {
      return storage()?.getItem(REFRESH_KEY) ?? null;
    } catch {
      return null;
    }
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
