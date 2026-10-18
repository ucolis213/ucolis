// Émission temps réel vers les utilisateurs et les rooms. Implémentée par Socket.IO en production,
// par un enregistreur en mémoire dans les tests.

export interface Realtime {
  toUser(userId: string, event: string, payload: unknown): void;
  toRoom(room: string, event: string, payload: unknown): void;
  /** Utilisateurs présents dans une room (ex. conversation ouverte à l'écran). */
  usersInRoom(room: string): Promise<Set<string>>;
  /** Coupe les sockets d'un utilisateur (suspension, déconnexion à distance). */
  disconnectUser(userId: string, reason: string): void;
}

export interface RecordedEmit {
  target: string;
  event: string;
  payload: unknown;
}

export function createMemoryRealtime() {
  const emitted: RecordedEmit[] = [];
  const presence = new Map<string, Set<string>>();
  const disconnected: { userId: string; reason: string }[] = [];
  const realtime: Realtime & {
    emitted: RecordedEmit[];
    disconnected: typeof disconnected;
    join(room: string, userId: string): void;
    leave(room: string, userId: string): void;
    eventsFor(target: string, event?: string): unknown[];
  } = {
    emitted,
    disconnected,
    toUser(userId, event, payload) {
      emitted.push({ target: `user:${userId}`, event, payload });
    },
    toRoom(room, event, payload) {
      emitted.push({ target: room, event, payload });
    },
    async usersInRoom(room) {
      return new Set(presence.get(room) ?? []);
    },
    disconnectUser(userId, reason) {
      disconnected.push({ userId, reason });
    },
    join(room, userId) {
      presence.set(room, new Set([...(presence.get(room) ?? []), userId]));
    },
    leave(room, userId) {
      presence.get(room)?.delete(userId);
    },
    eventsFor(target, event) {
      return emitted.filter((e) => e.target === target && (!event || e.event === event)).map((e) => e.payload);
    },
  };
  return realtime;
}
