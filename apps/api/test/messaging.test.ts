import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { Types } from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import { ConversationModel, MessageModel } from '../src/modules/conversations/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { OfferModel } from '../src/modules/offers/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { UserModel } from '../src/modules/users/model';
import { createApp } from '../src/app';
import { attachSocketServer, createDeferredRealtime, socketRealtime } from '../src/realtime/socket';
import { createServices } from '../src/services';
import { createParcel, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { makeDeps, makeTestApp, useDatabase } from './helpers';

useDatabase();

const pickup = () => new Date(Date.now() + 2 * 86_400_000).toISOString();

async function acceptedDeal(ctx: TestApp) {
  const amina = await verifiedUser(ctx);
  const karim = await verifiedCarrier(ctx);
  const p = await createParcel(ctx, amina);
  const o = (
    await ctx
      .http()
      .post(`/api/v1/parcels/${p.id}/offers`)
      .set(karim.auth)
      .send({ price: 3250, vehicleId: karim.vehicleId, proposedPickupDate: pickup() })
  ).body;
  await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
  return { amina, karim, parcel: p, offer: o };
}

/** Livraison acceptée inscrite directement en base (sans passer par les offres) : ouvre la messagerie. */
async function fakeDeal(senderId: string, carrierId: string) {
  const parcel = await ParcelModel.collection.insertOne({
    sender: new Types.ObjectId(senderId),
    reference: `UC-TEST-${new Types.ObjectId().toString()}`,
  });
  await OfferModel.collection.insertOne({
    parcel: parcel.insertedId,
    carrier: new Types.ObjectId(carrierId),
    status: 'accepted',
  });
}

describe('notifications des offres', () => {
  it("notifie l'expéditeur d'une offre, en push dans sa langue, et respecte ses préférences", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx, {}, { 'preferences.language': 'ar' });
    const karim = await verifiedCarrier(ctx);
    await ctx
      .http()
      .post('/api/v1/me/push-tokens')
      .set(amina.auth)
      .send({
        token: 'ExponentPushToken[amina-device]',
        platform: 'android',
        deviceId: amina.deviceId,
      });
    const p = await createParcel(ctx, amina);
    await ctx
      .http()
      .post(`/api/v1/parcels/${p.id}/offers`)
      .set(karim.auth)
      .send({ price: 3250, vehicleId: karim.vehicleId, proposedPickupDate: pickup() });

    const list = await ctx.http().get('/api/v1/notifications').set(amina.auth);
    expect(list.body.items[0]).toMatchObject({
      type: 'offer_received',
      params: { carrierName: 'Karim B.', price: 3250, parcelTitle: 'Cadeaux pour la famille' },
      link: `ucolis://parcel/${p.id}/offers`,
      readAt: null,
    });
    expect(ctx.push.sent).toHaveLength(1);
    expect(ctx.push.sent[0]!.body).toContain('3 250 دج');
    expect(ctx.realtime.eventsFor(`user:${amina.id}`, 'counters').at(-1)).toEqual({
      unreadMessages: 0,
      unreadNotifications: 1,
    });

    await ctx
      .http()
      .patch('/api/v1/me/preferences')
      .set(amina.auth)
      .send({ notifications: { offers: false } });
    const p2 = await createParcel(ctx, amina);
    await ctx
      .http()
      .post(`/api/v1/parcels/${p2.id}/offers`)
      .set(karim.auth)
      .send({ atAskingPrice: true, vehicleId: karim.vehicleId, proposedPickupDate: pickup() });
    expect(ctx.push.sent).toHaveLength(1);
    expect(await NotificationModel.countDocuments({ recipient: amina.id })).toBe(2);
  });

  it("crée la conversation du colis à l'acceptation et notifie le transporteur", async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await acceptedDeal(ctx);
    const convs = await ctx.http().get('/api/v1/conversations').set(karim.auth);
    expect(convs.body.items).toHaveLength(1);
    expect(convs.body.items[0]).toMatchObject({
      parcel: { id: parcel.id },
      other: { id: amina.id },
      unread: 1,
      lastMessage: { type: 'system', text: 'offer_accepted', params: { price: 3250 } },
    });
    // Conversation enregistrée avant le stockage des paramètres : relus sur le message système.
    await ConversationModel.updateOne({ _id: convs.body.items[0].id }, { $set: { 'lastMessage.params': null } });
    const legacy = await ctx.http().get('/api/v1/conversations').set(karim.auth);
    expect(legacy.body.items[0].lastMessage.params).toEqual({ price: 3250 });
    const msgs = await ctx
      .http()
      .get(`/api/v1/conversations/${convs.body.items[0].id}/messages`)
      .set(karim.auth);
    expect(msgs.body.items[0]).toMatchObject({
      type: 'system',
      systemKey: 'offer_accepted',
      systemParams: { price: 3250 },
    });
    const notifs = await ctx.http().get('/api/v1/notifications').set(karim.auth);
    expect(notifs.body.items.map((n: { type: string }) => n.type)).toContain('offer_accepted');
    const detail = await ctx.http().get(`/api/v1/parcels/${parcel.id}`).set(karim.auth);
    expect(detail.body.viewer.counterpartPhone).toMatch(/^\+2135/);
  });

  it('marque lu, tout lu, et supprime', async () => {
    const ctx = makeTestApp();
    const { amina } = await acceptedDeal(ctx);
    const list = await ctx.http().get('/api/v1/notifications').set(amina.auth);
    const id = list.body.items[0].id;
    await ctx.http().post(`/api/v1/notifications/${id}/read`).set(amina.auth);
    let count = await ctx.http().get('/api/v1/notifications/unread-count').set(amina.auth);
    expect(count.body.unreadNotifications).toBe(list.body.total - 1);
    await ctx.http().post('/api/v1/notifications/read-all').set(amina.auth);
    count = await ctx.http().get('/api/v1/notifications/unread-count').set(amina.auth);
    expect(count.body.unreadNotifications).toBe(0);
    await ctx.http().delete('/api/v1/notifications').set(amina.auth);
    expect((await ctx.http().get('/api/v1/notifications').set(amina.auth)).body.total).toBe(0);
  });
});

describe('messagerie', () => {
  it("refuse tout échange avant l'acceptation d'une offre, puis ouvre une conversation unique par paire et par colis", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const open = (who: { auth: Record<string, string> }, body: Record<string, string>) =>
      ctx.http().post('/api/v1/conversations').set(who.auth).send(body);

    // Annonce ouverte, puis offre en cours : ni « Poser une question », ni « Contacter ».
    expect((await open(karim, { userId: amina.id, parcelId: p.id })).body.error.code).toBe('MESSAGING_LOCKED');
    const o = (
      await ctx
        .http()
        .post(`/api/v1/parcels/${p.id}/offers`)
        .set(karim.auth)
        .send({ price: 3250, vehicleId: karim.vehicleId, proposedPickupDate: pickup() })
    ).body;
    const locked = await open(amina, { userId: karim.id, parcelId: p.id });
    expect(locked.status).toBe(403);
    expect(locked.body.error.code).toBe('MESSAGING_LOCKED');
    expect((await open(karim, { userId: amina.id })).body.error.code).toBe('MESSAGING_LOCKED');

    // Conversation ouverte avant la règle : lisible, mais verrouillée.
    const legacy = await ConversationModel.create({
      participants: [amina.id, karim.id].sort(),
      parcel: p.id,
      pairKey: [amina.id, karim.id].sort().join(':'),
    });
    const view = await ctx.http().get(`/api/v1/conversations/${legacy.id}`).set(karim.auth);
    expect(view.body).toMatchObject({ locked: true, canSend: false });
    const early = await ctx
      .http()
      .post(`/api/v1/conversations/${legacy.id}/messages`)
      .set(karim.auth)
      .send({ type: 'text', clientId: 'client-early', text: 'Mon numéro : 0555' });
    expect(early.body.error.code).toBe('MESSAGING_LOCKED');

    await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
    const a = await open(karim, { userId: amina.id, parcelId: p.id });
    const b = await open(amina, { userId: karim.id, parcelId: p.id });
    expect(a.body.id).toBe(legacy.id);
    expect(b.body.id).toBe(a.body.id);
    expect(a.body).toMatchObject({ locked: false, canSend: true });
    const general = await open(karim, { userId: amina.id });
    expect(general.body.id).not.toBe(a.body.id);
    expect(general.body.parcel).toBeNull();
    // Une livraison acceptée ne vaut que pour cette paire et ce colis.
    const other = await createParcel(ctx, amina);
    expect((await open(karim, { userId: amina.id, parcelId: other.id })).body.error.code).toBe('MESSAGING_LOCKED');
    const stranger = await verifiedUser(ctx);
    expect((await open(karim, { userId: stranger.id })).body.error.code).toBe('MESSAGING_LOCKED');
    const self = await open(karim, { userId: karim.id });
    expect(self.status).toBe(400);
  });

  it('envoie, dédoublonne par clientId, compte les non-lus et marque comme lu', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    await fakeDeal(amina.id, karim.id);
    const conv = (
      await ctx.http().post('/api/v1/conversations').set(karim.auth).send({ userId: amina.id })
    ).body;
    const send = (clientId: string, text: string) =>
      ctx
        .http()
        .post(`/api/v1/conversations/${conv.id}/messages`)
        .set(karim.auth)
        .send({ type: 'text', clientId, text });
    const first = await send('client-0001', 'Bonjour, je passe à Oran demain');
    const dup = await send('client-0001', 'Bonjour, je passe à Oran demain');
    expect(dup.body.id).toBe(first.body.id);
    await send('client-0002', 'Toujours dispo ?');
    expect(await MessageModel.countDocuments({ conversation: conv.id })).toBe(2);

    const list = await ctx.http().get('/api/v1/conversations').set(amina.auth);
    expect(list.body.items[0]).toMatchObject({
      unread: 2,
      lastMessage: { text: 'Toujours dispo ?' },
    });
    // Une seule notification non lue par conversation.
    expect(
      await NotificationModel.countDocuments({ recipient: amina.id, type: 'new_message' }),
    ).toBe(1);
    expect(ctx.realtime.eventsFor(`user:${amina.id}`, 'message:new')).toHaveLength(2);

    await ctx.http().post(`/api/v1/conversations/${conv.id}/read`).set(amina.auth);
    const after = await ctx.http().get('/api/v1/conversations').set(amina.auth);
    expect(after.body.items[0].unread).toBe(0);
    const msgs = await ctx.http().get(`/api/v1/conversations/${conv.id}/messages`).set(karim.auth);
    expect(msgs.body.items[0].readBy).toEqual([amina.id]);
    expect(ctx.realtime.eventsFor(`conversation:${conv.id}`, 'messages:read')).toHaveLength(1);
    expect(
      (await ctx.http().get('/api/v1/notifications/unread-count').set(amina.auth)).body,
    ).toEqual({
      unreadMessages: 0,
      unreadNotifications: 0,
    });
  });

  it('supprime une conversation pour moi seul, sans accusé « Vu », et la fait revenir au message suivant', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    await fakeDeal(amina.id, karim.id);
    const conv = (
      await ctx.http().post('/api/v1/conversations').set(karim.auth).send({ userId: amina.id })
    ).body;
    const send = (clientId: string) =>
      ctx
        .http()
        .post(`/api/v1/conversations/${conv.id}/messages`)
        .set(karim.auth)
        .send({ type: 'text', clientId, text: 'Bonjour' });
    await send('client-0001');

    const del = await ctx.http().delete(`/api/v1/conversations/${conv.id}`).set(amina.auth);
    expect(del.status).toBe(204);
    expect((await ctx.http().get('/api/v1/conversations').set(amina.auth)).body.items).toHaveLength(0);
    expect((await ctx.http().get('/api/v1/conversations').set(karim.auth)).body.items).toHaveLength(1);
    expect(
      (await ctx.http().get('/api/v1/notifications/unread-count').set(amina.auth)).body.unreadMessages,
    ).toBe(0);
    const msgs = await ctx.http().get(`/api/v1/conversations/${conv.id}/messages`).set(karim.auth);
    expect(msgs.body.items[0].readBy).toEqual([]);

    // Rouverte volontairement, puis revenue avec un nouveau message.
    await ctx.http().post('/api/v1/conversations').set(amina.auth).send({ userId: karim.id });
    expect((await ctx.http().get('/api/v1/conversations').set(amina.auth)).body.items).toHaveLength(1);
    await ctx.http().delete(`/api/v1/conversations/${conv.id}`).set(amina.auth);
    await send('client-0002');
    const back = await ctx.http().get('/api/v1/conversations').set(amina.auth);
    expect(back.body.items[0]).toMatchObject({ id: conv.id, unread: 1 });

    const stranger = await verifiedUser(ctx);
    const forbidden = await ctx.http().delete(`/api/v1/conversations/${conv.id}`).set(stranger.auth);
    expect(forbidden.status).toBe(404);
  });

  it("n'envoie pas de push pour une conversation en sourdine ou ouverte à l'écran", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    await ctx
      .http()
      .post('/api/v1/me/push-tokens')
      .set(amina.auth)
      .send({ token: 'ExponentPushToken[a]', platform: 'ios', deviceId: amina.deviceId });
    await fakeDeal(amina.id, karim.id);
    const conv = (
      await ctx.http().post('/api/v1/conversations').set(karim.auth).send({ userId: amina.id })
    ).body;
    const send = (n: number) =>
      ctx
        .http()
        .post(`/api/v1/conversations/${conv.id}/messages`)
        .set(karim.auth)
        .send({ type: 'text', clientId: `client-${n}xxxx`, text: `m${n}` });
    await send(1);
    expect(ctx.push.sent).toHaveLength(1);
    expect(ctx.push.sent[0]!.group).toBe(conv.id);
    ctx.realtime.join(`conversation:${conv.id}`, amina.id);
    await send(2);
    expect(ctx.push.sent).toHaveLength(1);
    ctx.realtime.leave(`conversation:${conv.id}`, amina.id);
    await ctx
      .http()
      .post(`/api/v1/conversations/${conv.id}/mute`)
      .set(amina.auth)
      .send({ muted: true });
    await send(3);
    expect(ctx.push.sent).toHaveLength(1);
  });

  it('refuse les non-participants et les utilisateurs bloqués, et pagine par curseur', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const intrus = await verifiedUser(ctx);
    await fakeDeal(amina.id, karim.id);
    const conv = (
      await ctx.http().post('/api/v1/conversations').set(karim.auth).send({ userId: amina.id })
    ).body;
    expect(
      (await ctx.http().get(`/api/v1/conversations/${conv.id}/messages`).set(intrus.auth)).status,
    ).toBe(404);
    for (let i = 0; i < 35; i++) {
      await MessageModel.create({
        conversation: conv.id,
        author: karim.id,
        type: 'text',
        text: `m${i}`,
        createdAt: new Date(Date.now() + i * 1000),
      });
    }
    const page1 = await ctx.http().get(`/api/v1/conversations/${conv.id}/messages`).set(amina.auth);
    expect(page1.body.items).toHaveLength(30);
    expect(page1.body.hasMore).toBe(true);
    const page2 = await ctx
      .http()
      .get(`/api/v1/conversations/${conv.id}/messages`)
      .query({ before: page1.body.items.at(-1).id })
      .set(amina.auth);
    expect(page2.body.items).toHaveLength(5);
    expect(page2.body.hasMore).toBe(false);

    const before = (await ctx.http().get(`/api/v1/conversations/${conv.id}`).set(amina.auth)).body;
    expect(before).toMatchObject({ blockedByMe: false, canSend: true });

    await ctx.http().post(`/api/v1/me/blocked/${karim.id}`).set(amina.auth);
    const blocked = await ctx
      .http()
      .post(`/api/v1/conversations/${conv.id}/messages`)
      .set(karim.auth)
      .send({ type: 'text', clientId: 'client-blocked', text: 'Hello' });
    expect(blocked.body.error.code).toBe('BLOCKED');

    // Celle qui bloque peut débloquer ; le bloqué ne peut plus écrire, sans savoir qui a bloqué.
    const mine = (await ctx.http().get(`/api/v1/conversations/${conv.id}`).set(amina.auth)).body;
    expect(mine).toMatchObject({ blockedByMe: true, canSend: false });
    const theirs = (await ctx.http().get(`/api/v1/conversations/${conv.id}`).set(karim.auth)).body;
    expect(theirs).toMatchObject({ blockedByMe: false, canSend: false });

    await ctx.http().delete(`/api/v1/me/blocked/${karim.id}`).set(amina.auth);
    const after = (await ctx.http().get(`/api/v1/conversations/${conv.id}`).set(karim.auth)).body;
    expect(after).toMatchObject({ blockedByMe: false, canSend: true });
  });

  it('limite à 10 nouvelles conversations générales par jour', async () => {
    const ctx = makeTestApp();
    const karim = await verifiedCarrier(ctx);
    for (let i = 0; i < 10; i++) {
      const other = await verifiedUser(ctx);
      await fakeDeal(other.id, karim.id);
      expect(
        (await ctx.http().post('/api/v1/conversations').set(karim.auth).send({ userId: other.id }))
          .status,
      ).toBe(200);
    }
    const last = await verifiedUser(ctx);
    await fakeDeal(last.id, karim.id);
    const res = await ctx
      .http()
      .post('/api/v1/conversations')
      .set(karim.auth)
      .send({ userId: last.id });
    expect(res.status).toBe(429);
    expect(await ConversationModel.countDocuments({ createdBy: karim.id })).toBe(10);
  });
});

describe('Socket.IO', () => {
  let http: HttpServer | null = null;
  const sockets: Socket[] = [];

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.close());
    await new Promise<void>((resolve) => (http ? http.close(() => resolve()) : resolve()));
    http = null;
  });

  async function start() {
    const realtime = createDeferredRealtime();
    const ctx = makeDeps({ realtime });
    const services = createServices(ctx.deps);
    http = createServer(createApp(ctx.deps, services));
    const io = attachSocketServer(http, ctx.deps, services);
    realtime.attach(socketRealtime(io));
    await new Promise<void>((resolve) => http!.listen(0, resolve));
    const port = (http.address() as AddressInfo).port;
    const app = { ...ctx, services, http: () => null as never };
    const client = (token?: string) => {
      const s = connect(`http://localhost:${port}`, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(s);
      return s;
    };
    return { ctx, port, app, client, request: (await import('supertest')).default(http) };
  }

  const once = <T>(s: Socket, event: string) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`attente de « ${event} » expirée`)), 8000);
      s.once(event, (v: T) => {
        clearTimeout(timer);
        resolve(v);
      });
    });
  const connected = (s: Socket) => (s.connected ? Promise.resolve() : once(s, 'connect'));
  const emitAck = <T>(s: Socket, event: string, payload: unknown) =>
    s.timeout(8000).emitWithAck(event, payload) as Promise<T>;

  it('refuse une connexion sans jeton valide', async () => {
    const { client } = await start();
    const s = client('invalid');
    const err = await once<Error>(s, 'connect_error');
    expect(err.message).toBe('UNAUTHENTICATED');
  });

  it("délivre les messages en temps réel, l'indicateur d'écriture et les compteurs", async () => {
    const { client, request } = await start();
    const reg = async (n: string) => {
      const r = await request
        .post('/api/v1/auth/register')
        .send((await import('./helpers')).registration({ firstName: n }));
      await UserModel.updateOne({ _id: r.body.user.id }, { emailVerifiedAt: new Date() });
      return { id: r.body.user.id as string, token: r.body.accessToken as string };
    };
    const amina = await reg('Amina');
    const karim = await reg('Karim');
    await fakeDeal(amina.id, karim.id);
    const conv = (
      await request
        .post('/api/v1/conversations')
        .set({ Authorization: `Bearer ${karim.token}` })
        .send({ userId: amina.id })
    ).body;

    const a = client(amina.token);
    const k = client(karim.token);
    const counters = await once<{ unreadMessages: number }>(a, 'counters');
    expect(counters.unreadMessages).toBe(0);
    await connected(k);
    expect(await emitAck(a, 'conversation:join', { conversationId: conv.id })).toEqual({
      ok: true,
    });
    expect(await emitAck(k, 'conversation:join', { conversationId: conv.id })).toEqual({
      ok: true,
    });

    const typing = once<{ isTyping: boolean; userId: string }>(a, 'typing');
    k.emit('typing', { conversationId: conv.id, isTyping: true });
    expect(await typing).toMatchObject({ isTyping: true, userId: karim.id });

    const received = once<{ text: string }>(a, 'message:new');
    const ack = await emitAck<{ ok: boolean; data: { clientId: string } }>(k, 'message:send', {
      conversationId: conv.id,
      clientId: 'socket-client-1',
      type: 'text',
      text: 'Salam !',
    });
    expect(ack.ok).toBe(true);
    expect(ack.data.clientId).toBe('socket-client-1');
    expect((await received).text).toBe('Salam !');

    const intruder = await reg('Intrus');
    const i = client(intruder.token);
    await connected(i);
    const denied = await emitAck<{ ok: boolean; error: { code: string } }>(i, 'conversation:join', {
      conversationId: conv.id,
    });
    expect(denied).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('profil public', () => {
  it("ne propose « Contacter » qu'après une livraison acceptée entre les deux", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const profile = (who?: { auth: Record<string, string> }) => {
      const req = ctx.http().get(`/api/v1/users/${karim.id}`);
      return who ? req.set(who.auth) : req;
    };
    expect((await profile()).body.canContact).toBe(false);
    expect((await profile(amina)).body.canContact).toBe(false);
    expect((await profile(karim)).body.canContact).toBe(false);
    await fakeDeal(amina.id, karim.id);
    expect((await profile(amina)).body.canContact).toBe(true);
    expect((await profile()).body.canContact).toBe(false);
  });
});
