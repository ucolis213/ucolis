// Session du staff côté React : restauration au chargement, déconnexion après 30 min sans activité.

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PERMISSIONS, hasPermission, type Permission } from '@ucolis/shared';
import { api, refreshSession } from '../api/client';
import { sessionStore, type StaffSession } from './store';

export type { StaffDto, StaffSession } from './store';

export const IDLE_MS = 30 * 60_000;

interface SessionContextValue {
  session: StaffSession | null;
  restoring: boolean;
  setSession: (s: StaffSession | null) => void;
  logout: () => Promise<void>;
  can: (p: Permission) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setState] = useState<StaffSession | null>(sessionStore.get());
  const [restoring, setRestoring] = useState(() => !sessionStore.get() && !!sessionStore.storedRefreshToken());
  const queryClient = useQueryClient();

  useEffect(() => sessionStore.subscribe(setState), []);

  useEffect(() => {
    if (!restoring) return;
    void refreshSession().finally(() => setRestoring(false));
  }, [restoring]);

  const logout = useCallback(async () => {
    const refreshToken = sessionStore.get()?.refreshToken;
    sessionStore.set(null);
    queryClient.clear();
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
  }, [queryClient]);

  // Inactivité : 30 min sans clic ni frappe ferment la session (l'API applique la même règle).
  useEffect(() => {
    if (!session) return;
    let timer = window.setTimeout(() => void logout(), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void logout(), IDLE_MS);
    };
    const events = ['pointerdown', 'keydown'] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [session, logout]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      restoring,
      setSession: (s) => sessionStore.set(s),
      logout,
      can: (p) => (session ? hasPermission(session.staff, p) : false),
    }),
    [session, restoring, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession hors de SessionProvider');
  return ctx;
}

/** Session d'aperçu de l'interface, uniquement en développement et sans API. */
export const DEV_PREVIEW_SESSION: StaffSession = {
  accessToken: 'dev-preview',
  refreshToken: '',
  staff: {
    id: 'dev',
    firstName: 'Aperçu',
    lastName: 'Dev',
    email: 'dev@ucolis.local',
    role: 'super_admin',
    permissions: [...PERMISSIONS],
    status: 'active',
    lastLoginAt: null,
    createdAt: new Date(0).toISOString(),
  },
};
