// Socket.IO côté application : connexion avec le jeton d'accès courant, reconnexion automatique,
// re-synchronisation des compteurs, invalidation du cache sur les événements du serveur.

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Counters, MessageDto, NotificationDto } from '@ucolis/shared';
import { API_URL, refreshSession } from '../api/client';
import { tokens } from '../api/tokens';
import { useSession } from '../session/SessionContext';

const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, '');

let current: Socket | null = null;
/** Accès au socket hors React (tâche de localisation en arrière-plan). */
export const getSocket = () => current;

interface SocketValue {
  socket: Socket | null;
  connected: boolean;
  counters: Counters;
}

const SocketContext = createContext<SocketValue>({
  socket: null,
  connected: false,
  counters: { unreadMessages: 0, unreadNotifications: 0 },
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { status, signOut, refreshMe } = useSession();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [counters, setCounters] = useState<Counters>({ unreadMessages: 0, unreadNotifications: 0 });
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  useEffect(() => {
    if (status !== 'authenticated') return;
    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      // Fonction : le jeton d'accès est relu à chaque (re)connexion.
      auth: (cb) => cb({ token: tokens.getAccess() }),
      reconnectionDelayMax: 10_000,
    });
    current = s;
    setSocket(s);

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', async (err) => {
      if (err.message === 'UNAUTHENTICATED' && (await refreshSession())) s.connect();
    });
    s.on('counters', (c: Counters) => setCounters(c));
    s.on('notification:new', (n: NotificationDto) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Vérification, statut pro, suspension : le profil en mémoire décide de ce que l'interface autorise.
      if (n.category === 'account') void refreshMe();
    });
    s.on('message:new', (m: MessageDto) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData<{ pages: { items: MessageDto[] }[] }>(['messages', m.conversationId], (old) => {
        if (!old?.pages[0]) return old;
        if (old.pages.some((p) => p.items.some((x) => x.id === m.id || (m.clientId && x.clientId === m.clientId)))) {
          return {
            ...old,
            pages: old.pages.map((p) => ({ ...p, items: p.items.map((x) => (m.clientId && x.clientId === m.clientId ? m : x)) })),
          };
        }
        return { ...old, pages: [{ ...old.pages[0], items: [m, ...old.pages[0].items] }, ...old.pages.slice(1)] };
      });
    });
    s.on('parcel:updated', (p: { parcelId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['parcel', p.parcelId] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'parcels'] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'deliveries'] });
    });
    s.on('offer:updated', (o: { offerId: string; parcelId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['offer', o.offerId] });
      void queryClient.invalidateQueries({ queryKey: ['parcel', o.parcelId] });
      void queryClient.invalidateQueries({ queryKey: ['me', 'offers'] });
    });
    s.on('session:revoked', () => {
      void signOutRef.current({ remote: true });
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      current = null;
      setSocket(null);
      setConnected(false);
      // Déconnexion : les badges du compte précédent ne doivent pas rester affichés.
      setCounters({ unreadMessages: 0, unreadNotifications: 0 });
    };
  }, [status, queryClient, refreshMe]);

  const value = useMemo(() => ({ socket, connected, counters }), [socket, connected, counters]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Abonnement à un événement tant que le composant est monté. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (p: T) => ref.current(p);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}

type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export async function emitWithAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  const res = (await socket.timeout(10_000).emitWithAck(event, payload)) as Ack<T>;
  if (!res.ok) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data;
}
