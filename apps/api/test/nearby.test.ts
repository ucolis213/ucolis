import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { NotificationModel } from '../src/modules/notifications/model';
import { PushTokenModel } from '../src/modules/push/model';
import { UserModel } from '../src/modules/users/model';
import { createParcel, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

const HOUR = 3600_000;
const ALGER = { lat: 36.7712, lng: 3.0612 };
const ORAN = { lat: 35.6987, lng: -0.6349 };
const ORAN_PLACE = { place: { wilayaCode: '31', commune: '31001' } };
const fromOran = {
  pickup: { address: 'Boulevard de la Soummam', wilayaCode: '31', commune: '31001', location: ORAN },
  dropoff: { address: 'Rue Didouche Mourad', wilayaCode: '16', commune: '16001', location: ALGER },
};

const nearby = (userId: string) => NotificationModel.find({ type: 'nearby_parcel', recipient: userId }).lean();
const sendPosition = (ctx: TestApp, user: { auth: Record<string, string> }, point: typeof ALGER) =>
  ctx.http().put('/api/v1/me/position').set(user.auth).send(point);

describe('transporteurs proches d’un nouveau colis', () => {
  it('suit la position récente du transporteur, sinon la commune de son profil', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx, { intent: 'sender' });
    // Karim habite Alger mais se trouve à Oran ; Yacine habite Alger sans position connue.
    const karim = await verifiedCarrier(ctx);
    const yacine = await verifiedCarrier(ctx);
    // Nadia habite Oran ; sa dernière position (Alger) date de 2 jours : la commune du profil fait foi.
    const nadia = await verifiedCarrier(ctx, ORAN_PLACE);
    const leila = await verifiedUser(ctx, { intent: 'sender' });
    expect((await sendPosition(ctx, karim, ORAN)).status).toBe(204);
    expect((await sendPosition(ctx, nadia, ALGER)).status).toBe(204);
    await UserModel.updateOne({ _id: nadia.id }, { 'lastPosition.at': new Date(Date.now() - 48 * HOUR) });
    // Un compte expéditeur seul ne garde pas de position.
    await sendPosition(ctx, leila, ALGER);
    expect((await UserModel.findById(leila.id).lean())?.lastPosition).toBeNull();

    const algiers = await createParcel(ctx, amina);
    expect(await nearby(yacine.id)).toHaveLength(1);
    expect((await nearby(yacine.id))[0]).toMatchObject({ params: { parcelTitle: 'Cadeaux pour la famille', km: 1 }, data: { parcelId: algiers.id } });
    expect(await nearby(karim.id)).toHaveLength(0);
    expect(await nearby(nadia.id)).toHaveLength(0);
    expect(await nearby(leila.id)).toHaveLength(0);
    expect(await nearby(amina.id)).toHaveLength(0);

    await createParcel(ctx, amina, fromOran);
    expect(await nearby(karim.id)).toHaveLength(1);
    expect(await nearby(nadia.id)).toHaveLength(1);
    expect(await nearby(yacine.id)).toHaveLength(1);
  });

  it("ignore l'expéditeur bloqué et respecte le rayon réglé", async () => {
    const ctx = makeTestApp({ settings: { nearbyParcels: { radiusKm: 5, dailyPushLimit: 5 } } });
    const amina = await verifiedUser(ctx, { intent: 'sender' });
    const blocked = await verifiedCarrier(ctx);
    const far = await verifiedCarrier(ctx);
    const near = await verifiedCarrier(ctx);
    await UserModel.updateOne({ _id: amina.id }, { blockedUsers: [blocked.id] });
    // Rouïba, à une vingtaine de km d'Alger-Centre : hors d'un rayon de 5 km.
    await sendPosition(ctx, far, { lat: 36.7381, lng: 3.2826 });
    await sendPosition(ctx, near, { lat: 36.76, lng: 3.05 });

    await createParcel(ctx, amina);
    expect(await nearby(blocked.id)).toHaveLength(0);
    expect(await nearby(far.id)).toHaveLength(0);
    expect(await nearby(near.id)).toHaveLength(1);
  });

  it('limite les push sur 24 h, la notification restant dans l’application', async () => {
    const ctx = makeTestApp({ settings: { nearbyParcels: { radiusKm: 30, dailyPushLimit: 2 } } });
    const amina = await verifiedUser(ctx, { intent: 'sender' });
    const karim = await verifiedCarrier(ctx);
    await PushTokenModel.create({ user: karim.id, token: 'ExponentPushToken[karim-1234]', platform: 'ios', deviceId: 'device-karim' });

    for (let i = 0; i < 3; i++) await createParcel(ctx, amina);
    expect(await nearby(karim.id)).toHaveLength(3);
    const pushes = () => ctx.push.sent.filter((m) => m.data?.type === 'nearby_parcel');
    expect(pushes()).toHaveLength(2);
    expect(pushes()[0]?.title).toBe('Nouveau colis près de vous');

    // Notifications vieilles de plus de 24 h : le compteur repart.
    // (collection brute : Mongoose interdit de réécrire createdAt)
    await NotificationModel.collection.updateMany(
      { recipient: new Types.ObjectId(karim.id) },
      { $set: { createdAt: new Date(Date.now() - 25 * HOUR) } },
    );
    await createParcel(ctx, amina);
    expect(pushes()).toHaveLength(3);
  });
});
