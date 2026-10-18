// Socket.IO : connexion avec auth: { token }, room user:<id> automatique, messagerie et suivi.
// L'adaptateur Redis permet plusieurs instances de l'API.

import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { Server, type Socket } from 'socket.io';
import { sendMessageSchema } from '@ucolis/shared';
import type { Deps } from '../deps';
import { verifyAccessToken } from '../lib/auth';
import { AppError } from '../lib/errors';
import type { Realtime } from '../lib/realtime';
import { conversationRoom } from '../modules/conversations/service';
import { UserModel } from '../modules/users/model';
import type { Services } from '../services';
import { registerTrackingHandlers } from './tracking';

export type Ack = (res: { ok: true; data?: unknown } | { ok: false; error: { code: string; message: string } }) => void;

const userRoom = (id: string) => `user:${id}`;

/** Proxy de Realtime : les services sont créés avant le serveur Socket.IO. */
export function createDeferredRealtime(): Realtime & { attach(impl: Realtime): void } {
  let impl: Realtime | null = null;
  return {
    attach: (r) => {
      impl = r;
    },
    toUser: (...args) => impl?.toUser(...args),
    toRoom: (...args) => impl?.toRoom(...args),
    usersInRoom: async (room) => (impl ? impl.usersInRoom(room) : new Set()),
    disconnectUser: (...args) => impl?.disconnectUser(...args),
  };
}

export function socketRealtime(io: Server): Realtime {
  return {
    toUser: (userId, event, payload) => void io.to(userRoom(userId)).emit(event, payload),
    toRoom: (room, event, payload) => void io.to(room).emit(event, payload),
    async usersInRoom(room) {
      const sockets = await io.in(room).fetchSockets();
      return new Set(sockets.map((s) => s.data.userId as string).filter(Boolean));
    },
    disconnectUser(userId, reason) {
      io.to(userRoom(userId)).emit('session:revoked', { reason });
      io.in(userRoom(userId)).disconnectSockets(true);
    },
  };
}

export async function handle(ack: Ack | undefined, fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    ack?.({ ok: true, data });
  } catch (err) {
    const e = err instanceof AppError ? err : new AppError(500, 'INTERNAL_ERROR', 'Erreur interne');
    ack?.({ ok: false, error: { code: e.code, message: e.message } });
  }
}

export function attachSocketServer(
  httpServer: HttpServer,
  deps: Deps,
  services: Services,
  opts: { redis?: { pub: Redis; sub: Redis } } = {},
): Server {
  const io = new Server(httpServer, {
    cors: { origin: deps.config.corsOrigins },
    pingInterval: 20_000,
    pingTimeout: 15_000,
  });
  if (opts.redis) io.adapter(createAdapter(opts.redis.pub, opts.redis.sub));

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: string })?.token;
    const userId = token ? verifyAccessToken(token, deps.config.accessSecret, deps.now()) : null;
    if (!userId) return next(new Error('UNAUTHENTICATED'));
    const user = await UserModel.findById(userId, { status: 1 }).lean();
    if (!user || user.status === 'deleted') return next(new Error('UNAUTHENTICATED'));
    if (user.status === 'suspended') return next(new Error('ACCOUNT_SUSPENDED'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    // Les écouteurs sont enregistrés avant tout await : un événement émis dès la connexion n'est pas perdu.
    void socket.join(userRoom(userId));

    socket.on('conversation:join', (p: { conversationId: string }, ack?: Ack) =>
      handle(ack, async () => {
        await services.conversations.assertParticipant(userId, String(p?.conversationId));
        await socket.join(conversationRoom(p.conversationId));
      }),
    );
    socket.on('conversation:leave', (p: { conversationId: string }, ack?: Ack) =>
      handle(ack, async () => {
        await socket.leave(conversationRoom(String(p?.conversationId)));
      }),
    );
    socket.on('message:send', (p: { conversationId: string } & Record<string, unknown>, ack?: Ack) =>
      handle(ack, async () => {
        const parsed = sendMessageSchema.safeParse(p);
        if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Message invalide');
        const user = await UserModel.findById(userId, { emailVerifiedAt: 1 }).lean();
        if (!user?.emailVerifiedAt) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Email non vérifié');
        return services.conversations.send(userId, String(p.conversationId), parsed.data);
      }),
    );
    socket.on('typing', (p: { conversationId: string; isTyping: boolean }) => {
      const room = conversationRoom(String(p?.conversationId));
      if (socket.rooms.has(room)) socket.to(room).emit('typing', { conversationId: p.conversationId, userId, isTyping: !!p.isTyping });
    });
    socket.on('conversation:read', (p: { conversationId: string }, ack?: Ack) =>
      handle(ack, () => services.conversations.read(userId, String(p?.conversationId))),
    );

    registerTrackingHandlers(socket, deps, services);

    // Re-synchronisation des compteurs à chaque (re)connexion.
    services.notifications
      .counters(userId)
      .then((c) => socket.emit('counters', c))
      .catch((err) => deps.logger.warn({ err }, 'compteurs indisponibles'));
  });

  return io;
}
