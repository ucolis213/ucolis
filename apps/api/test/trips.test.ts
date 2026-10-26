import { describe, expect, it } from 'vitest';
import { completeTrips, flushAlerts } from '../src/jobs/sweeps';
import { NotificationModel } from '../src/modules/notifications/model';
import { TripModel, TripRequestModel } from '../src/modules/trips/model';
import { createParcel, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

const DAY = 86_400_000;
const HOUR = 3600_000;
const W = {
  alger: { wilayaCode: '16', commune: '16001', location: { lat: 36.77, lng: 3.06 } },
  setif: { wilayaCode: '19', commune: '19001', location: { lat: 36.19, lng: 5.41 } },
  constantine: { wilayaCode: '25', commune: '25001', location: { lat: 36.36, lng: 6.64 } },
};
const address = (w: (typeof W)[keyof typeof W]) => ({ address: 'Centre-ville', ...w });

async function publishTrip(ctx: TestApp, carrier: { auth: Record<string, string>; vehicleId: string }, patch: Record<string, unknown> = {}) {
  return ctx
    .http()
    .post('/api/v1/trips')
    .set(carrier.auth)
    .send({
      from: W.constantine,
      to: W.alger,
      stops: ['19', '10'],
      departureAt: new Date(Date.now() + 3 * DAY).toISOString(),
      vehicleId: carrier.vehicleId,
      capacityKg: 800,
      capacityM3: 8,
      priceHint: { mode: 'per_kg', amount: 50 },
      ...patch,
    });
}

describe('trajets', () => {
  it('propose un colis Sétif → Alger au trajet Constantine → Sétif → Bouira → Alger, mais pas à Alger → Sétif', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const sarl = await verifiedCarrier(ctx);
    const good = await publishTrip(ctx, karim);
    expect(good.status).toBe(201);
    const reverse = await publishTrip(ctx, sarl, { from: W.alger, to: W.setif, stops: [] });
    const parcel = await createParcel(ctx, amina, { pickup: address(W.setif), dropoff: address(W.alger), weightKg: 20 });

    const goodTrip = good.body.items[0].id;
    const reverseTrip = reverse.body.items[0].id;
    expect((await ctx.http().get(`/api/v1/trips/${goodTrip}/matching-parcels`).set(karim.auth)).body.items.map((p: { id: string }) => p.id)).toEqual([parcel.id]);
    expect((await ctx.http().get(`/api/v1/trips/${reverseTrip}/matching-parcels`).set(sarl.auth)).body.items).toEqual([]);

    // Correspondance automatique à la publication du colis : seul le bon transporteur est prévenu.
    expect(await NotificationModel.countDocuments({ type: 'trip_parcel_match', recipient: karim.id })).toBe(1);
    expect(await NotificationModel.countDocuments({ type: 'trip_parcel_match', recipient: sarl.id })).toBe(0);
    // Au plus une notification par trajet et par heure.
    await createParcel(ctx, amina, { pickup: address(W.setif), dropoff: address(W.alger) });
    expect(await NotificationModel.countDocuments({ type: 'trip_parcel_match', recipient: karim.id })).toBe(1);

    const req = await ctx.http().post(`/api/v1/trips/${goodTrip}/requests`).set(amina.auth).send({ parcelId: parcel.id });
    expect(req.status).toBe(201);
    expect((await ctx.http().post(`/api/v1/trips/${goodTrip}/requests`).set(amina.auth).send({ parcelId: parcel.id })).status).toBe(409);
    expect((await ctx.http().post(`/api/v1/trips/${reverseTrip}/requests`).set(amina.auth).send({ parcelId: parcel.id })).status).toBe(422);
    expect(await NotificationModel.countDocuments({ type: 'trip_request_received', recipient: karim.id })).toBe(1);

    await ctx.http().post(`/api/v1/parcels/${parcel.id}/offers`).set(karim.auth).send({ price: 1500, vehicleId: karim.vehicleId, proposedPickupDate: new Date(Date.now() + 3 * DAY).toISOString() });
    expect((await TripRequestModel.findById(req.body.id).lean())!.status).toBe('offered');
  });

  it("exige une identité vérifiée (réglage activé), limite les trajets actifs et compte une série récurrente pour un seul", async () => {
    const ctx = makeTestApp({ settings: { requireCarrierVerification: true } });
    const amina = await verifiedUser(ctx);
    expect((await publishTrip(ctx, { auth: amina.auth, vehicleId: '0'.repeat(24) })).body.error.code).toBe('CARRIER_NOT_VERIFIED');
    const karim = await verifiedCarrier(ctx);
    const weekly = await publishTrip(ctx, karim, {
      recurrence: { weekdays: [0, 3], until: new Date(Date.now() + 4 * 7 * DAY).toISOString() },
    });
    expect(weekly.body.items.length).toBeGreaterThan(4);
    expect(new Set(weekly.body.items.map((t: { seriesId: string }) => t.seriesId)).size).toBe(1);
    await publishTrip(ctx, karim);
    await publishTrip(ctx, karim);
    const fourth = await publishTrip(ctx, karim);
    expect(fourth.body.error.code).toBe('ACTIVE_TRIP_LIMIT');
    const tooLong = await publishTrip(ctx, karim, { recurrence: { weekdays: [1], until: new Date(Date.now() + 10 * 7 * DAY).toISOString() } });
    expect(tooLong.status).toBe(400);
  });

  it('passe un trajet en completed 24 h après le départ sans action humaine, et liste les trajets publics', async () => {
    const ctx = makeTestApp();
    const karim = await verifiedCarrier(ctx);
    const trip = (await publishTrip(ctx, karim)).body.items[0];
    const list = await ctx.http().get('/api/v1/trips').query({ fromWilaya: '25', toWilaya: '19' });
    expect(list.body.items.map((t: { id: string }) => t.id)).toEqual([trip.id]);
    expect((await ctx.http().get(`/api/v1/users/${karim.id}/trips`)).body.items).toHaveLength(1);
    ctx.clock.advance(3 * DAY + 2 * HOUR);
    expect(await completeTrips(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(DAY);
    expect(await completeTrips(ctx.deps, ctx.services)).toBe(1);
    expect((await TripModel.findById(trip.id).lean())!.status).toBe('completed');
  });
});

describe('alertes et favoris', () => {
  it("regroupe les correspondances : jamais plus d'un push par heure et par alerte", async () => {
    const ctx = makeTestApp();
    const karim = await verifiedCarrier(ctx);
    const amina = await verifiedUser(ctx);
    const alert = await ctx.http().post('/api/v1/me/saved-searches').set(karim.auth).send({ name: 'Sétif → Alger', scope: 'parcels', filters: { fromWilaya: '19', toWilaya: '16' } });
    expect(alert.status).toBe(201);
    for (let i = 0; i < 3; i++) await createParcel(ctx, amina, { pickup: address(W.setif), dropoff: address(W.alger) });
    await createParcel(ctx, amina);
    let notifs = await NotificationModel.find({ recipient: karim.id, type: 'new_listing_match' }).lean();
    expect(notifs).toHaveLength(1);
    expect(notifs[0]!.params).toMatchObject({ count: 1 });
    expect(await flushAlerts(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(HOUR + 1000);
    expect(await flushAlerts(ctx.deps, ctx.services)).toBe(1);
    notifs = await NotificationModel.find({ recipient: karim.id, type: 'new_listing_match' }).sort({ createdAt: 1 }).lean();
    expect(notifs.at(-1)!.params).toMatchObject({ count: 2, route: 'Sétif → Alger' });
  });

  it('limite à 10 alertes et gère les favoris avec notification de favori indisponible', async () => {
    const ctx = makeTestApp();
    const karim = await verifiedCarrier(ctx);
    for (let i = 0; i < 10; i++) await ctx.http().post('/api/v1/me/saved-searches').set(karim.auth).send({ name: `A${i}`, scope: 'trips', filters: {} });
    expect((await ctx.http().post('/api/v1/me/saved-searches').set(karim.auth).send({ name: 'X', scope: 'trips', filters: {} })).status).toBe(422);

    const amina = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    await ctx.http().put(`/api/v1/me/favorites/${p.id}`).set(karim.auth);
    expect((await ctx.http().get('/api/v1/parcels').set(karim.auth)).body.items[0].isFavorite).toBe(true);
    expect((await ctx.http().get('/api/v1/me/favorites').set(karim.auth)).body.items).toHaveLength(1);
    await ctx.http().post(`/api/v1/parcels/${p.id}/cancel`).set(amina.auth).send({});
    expect(await NotificationModel.countDocuments({ recipient: karim.id, type: 'favorite_unavailable' })).toBe(1);
  });
});
