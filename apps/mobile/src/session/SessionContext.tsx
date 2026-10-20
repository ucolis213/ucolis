// Session utilisateur : invité ou connecté. Au démarrage, le jeton de rafraîchissement stocké est échangé
// contre une session, puis le profil est chargé. Une session perdue (rejeu, suspension) repasse en invité.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, Intent, Me } from '@ucolis/shared';
import { api, refreshSession, setSessionLostListener } from '../api/client';
import { tokens } from '../api/tokens';
import { getDeviceId } from '../device';
import { clearRecents } from '../state/addressBook';

type Status = 'loading' | 'guest' | 'authenticated';

interface SessionValue {
  status: Status;
  user: Me | null;
  isGuest: boolean;
  signIn: (res: AuthResponse) => Promise<void>;
  signOut: (opts?: { remote?: boolean }) => Promise<void>;
  setUser: (u: Me) => void;
  refreshMe: () => Promise<Me | null>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<Me | null>(null);
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    setUserState(null);
    setStatus('guest');
    queryClient.clear();
  }, [queryClient]);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get<Me>('/me');
      setUserState(me);
      setStatus('authenticated');
      return me;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setSessionLostListener(() => {
      reset();
      router.replace('/home');
    });
    (async () => {
      const refresh = await tokens.getRefresh();
      if (refresh && (await refreshSession()) && (await refreshMe())) return;
      // Hors connexion avec un jeton stocké : on reste invité pour l'instant.
      setStatus('guest');
    })();
    return () => setSessionLostListener(null);
  }, [refreshMe, reset]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      isGuest: status !== 'authenticated',
      async signIn(res) {
        tokens.setAccess(res.accessToken);
        await tokens.setRefresh(res.refreshToken);
        setUserState(res.user);
        setStatus('authenticated');
      },
      async signOut(opts) {
        if (!opts?.remote) {
          await api.post('/auth/logout', { deviceId: await getDeviceId() }).catch(() => undefined);
        }
        await tokens.clear();
        await clearRecents();
        reset();
      },
      setUser: (u) => setUserState(u),
      refreshMe,
    }),
    [status, user, refreshMe, reset],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession hors de SessionProvider');
  return ctx;
}

/** Le transporteur est mis en avant si l'intent l'inclut. */
export const isCarrierIntent = (intent: Intent | undefined) =>
  intent === 'carrier' || intent === 'both';
