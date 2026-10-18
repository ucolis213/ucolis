import { describe, expect, it } from 'vitest';
import { readDeliveryCode } from '../src/lib/deliveryCode';
import { OfferModel } from '../src/modules/offers/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { createParcel, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

const pickup = () => new Date(Date.now() + 2 * 86_400_000).toISOString();

async function offer(ctx: TestApp, carrier: { auth: Record<string, string>; vehicleId: string }, parcelId: string, body = {}) {
  return ctx
    .http()
    .post(`/api/v1/parcels/${parcelId}/offers`)
    .set(carrier.auth)
    .send({ price: 3000, vehicleId: carrier.vehicleId, proposedPickupDate: pickup(), ...body });
}

describe('faire une offre', () => {
  it('exige une identité vérifiée, sauf si le réglage est désactivé', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    const karim = await verifiedCarrier(ctx);
    await import('../src/modules/users/model').then(({ UserModel }) =>
      UserModel.updateOne({ _id: karim.id }, { 'carrierVerification.status': 'pending' }),
    );
    const res = await offer(ctx, karim, p.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CARRIER_NOT_VERIFIED');

    const relaxed = makeTestApp({ settings: { requireCarrierVerification: false } });
    const ok = await offer(relaxed, karim, p.id);
    expect(ok.status).toBe(201);
  });

  it('fait passer le colis en negotiating à la première offre', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const res = await offer(ctx, karim, p.id, { message: 'Je pars demain' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'pending', price: 3000, rounds: [{ by: 'carrier', price: 3000 }] });
    expect(res.body.vehicle.plate).toBe('•••619');
    const parcel = await ParcelModel.findById(p.id).lean();
    expect(parcel).toMatchObject({ status: 'negotiating', offersCount: 1 });
    const detail = await ctx.http().get(`/api/v1/parcels/${p.id}`).set(karim.auth);
    expect(detail.body.viewer.role).toBe('carrier_with_offer');
    expect(detail.body.viewer.myOffer.id).toBe(res.body.id);
  });

  it('accepte le prix demandé en un geste', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina, { requestedPrice: 4200 });
    const events: unknown[] = [];
    ctx.deps.bus.on('offer.created', (e) => void events.push(e));
    const res = await ctx
      .http()
      .post(`/api/v1/parcels/${p.id}/offers`)
      .set(karim.auth)
      .send({ atAskingPrice: true, vehicleId: karim.vehicleId, proposedPickupDate: pickup() });
    expect(res.body).toMatchObject({ price: 4200, atAskingPrice: true });
    expect(events).toEqual([expect.objectContaining({ atAskingPrice: true, price: 4200 })]);
  });

  it('refuse son propre colis, un véhicule non accepté, une seconde offre active et un utilisateur bloqué', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedCarrier(ctx, { firstName: 'Amina' });
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    expect((await offer(ctx, amina, p.id)).body.error.code).toBe('OWN_PARCEL');

    const motoOnly = await createParcel(ctx, amina, { vehicleTypes: ['moto'] });
    expect((await offer(ctx, karim, motoOnly.id)).body.error.code).toBe('VEHICLE_NOT_ACCEPTED');

    await offer(ctx, karim, p.id);
    const twice = await offer(ctx, karim, p.id);
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('OFFER_ALREADY_ACTIVE');

    const other = await createParcel(ctx, amina);
    await ctx.http().post(`/api/v1/me/blocked/${karim.id}`).set(amina.auth);
    expect((await offer(ctx, karim, other.id)).body.error.code).toBe('BLOCKED');
    expect((await offer(ctx, karim, other.id, { price: 50 })).status).toBe(400);
  });
});

describe('négociation', () => {
  it('limite à 3 contre-offres, puis seules acceptation et refus restent possibles', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const o = (await offer(ctx, karim, p.id, { price: 4000 })).body;
    const events: string[] = [];
    ctx.deps.bus.on('offer.countered', () => void events.push('countered'));
    ctx.deps.bus.on('offer.counter_rejected', () => void events.push('counter_rejected'));

    for (let i = 0; i < 3; i++) {
      const c = await ctx.http().post(`/api/v1/offers/${o.id}/counter`).set(amina.auth).send({ price: 3000 + i * 100 });
      expect(c.body.status).toBe('countered');
      expect(c.body.counterPrice).toBe(3000 + i * 100);
      const back = i % 2 === 0
        ? await ctx.http().post(`/api/v1/offers/${o.id}/reject-counter`).set(karim.auth)
        : await ctx.http().post(`/api/v1/offers/${o.id}/reoffer`).set(karim.auth).send({ price: 3800 });
      expect(back.body.status).toBe('pending');
    }
    const fourth = await ctx.http().post(`/api/v1/offers/${o.id}/counter`).set(amina.auth).send({ price: 2500 });
    expect(fourth.status).toBe(422);
    expect(fourth.body.error.code).toBe('COUNTER_LIMIT_REACHED');
    expect(events).toEqual(['countered', 'counter_rejected', 'countered', 'countered', 'counter_rejected']);

    const final = await ctx.http().get(`/api/v1/offers/${o.id}`).set(karim.auth);
    expect(final.body.rounds.map((r: { by: string; price: number }) => `${r.by}:${r.price}`)).toEqual([
      'carrier:4000', 'sender:3000', 'carrier:4000', 'sender:3100', 'carrier:3800', 'sender:3200', 'carrier:3800',
    ]);
    expect((await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth)).body.status).toBe('accepted');
  });

  it("n'autorise chaque geste qu'à la bonne partie et dans le bon état", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const intrus = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const o = (await offer(ctx, karim, p.id)).body;
    expect((await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(karim.auth)).status).toBe(403);
    expect((await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(intrus.auth)).status).toBe(403);
    expect((await ctx.http().post(`/api/v1/offers/${o.id}/withdraw`).set(intrus.auth)).status).toBe(403);
    expect((await ctx.http().get(`/api/v1/offers/${o.id}`).set(intrus.auth)).status).toBe(403);
    expect((await ctx.http().get(`/api/v1/parcels/${p.id}/offers`).set(karim.auth)).status).toBe(403);
    const acc = await ctx.http().post(`/api/v1/offers/${o.id}/accept-counter`).set(karim.auth);
    expect(acc.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('accepte une contre-offre côté transporteur au prix de la contre-offre', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const o = (await offer(ctx, karim, p.id, { price: 4000 })).body;
    await ctx.http().post(`/api/v1/offers/${o.id}/counter`).set(amina.auth).send({ price: 3300, message: 'Mon budget' });
    const res = await ctx.http().post(`/api/v1/offers/${o.id}/accept-counter`).set(karim.auth);
    expect(res.body).toMatchObject({ status: 'accepted', finalPrice: 3300 });
    const parcel = await ParcelModel.findById(p.id).lean();
    expect(parcel).toMatchObject({ status: 'assigned', finalPrice: 3300 });
    expect(parcel!.assignedCarrier!.toString()).toBe(karim.id);
  });

  it('retire une offre tant qu’elle n’est pas acceptée', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const o = (await offer(ctx, karim, p.id)).body;
    expect((await ctx.http().post(`/api/v1/offers/${o.id}/withdraw`).set(karim.auth)).body.status).toBe('withdrawn');
    // Une nouvelle offre redevient possible.
    expect((await offer(ctx, karim, p.id)).status).toBe(201);
  });
});

describe('acceptation', () => {
  it('attribue le colis, refuse les autres offres et génère un code de remise chiffré', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const sarl = await verifiedCarrier(ctx, { firstName: 'Sarl' });
    const p = await createParcel(ctx, amina);
    const a = (await offer(ctx, karim, p.id, { price: 3000 })).body;
    const b = (await offer(ctx, sarl, p.id, { price: 2800 })).body;
    const accepted: { notSelected: string[] }[] = [];
    ctx.deps.bus.on('offer.accepted', (e) => void accepted.push(e));

    const res = await ctx.http().post(`/api/v1/offers/${a.id}/accept`).set(amina.auth);
    expect(res.body).toMatchObject({ status: 'accepted', finalPrice: 3000 });
    expect(res.body.vehicle.plate).toBe('12345-116-19');
    const other = await OfferModel.findById(b.id).lean();
    expect(other).toMatchObject({ status: 'rejected', rejectedBecauseAccepted: true });
    expect(accepted[0]!.notSelected).toEqual([sarl.id]);

    const parcel = await ParcelModel.findById(p.id).lean();
    expect(parcel!.status).toBe('assigned');
    expect(readDeliveryCode(ctx.deps.config.deliveryCodeKey, parcel!.deliveryCode!.cipher!)).toMatch(/^\d{4}$/);
    const list = await ctx.http().get(`/api/v1/parcels/${p.id}/offers`).query({ sort: 'price' }).set(amina.auth);
    expect(list.body.items[0].id).toBe(a.id);
    expect((await offer(ctx, sarl, p.id)).status).toBe(409);
  });

  it('produit exactement une attribution pour deux acceptations concurrentes', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const sarl = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const a = (await offer(ctx, karim, p.id)).body;
    const b = (await offer(ctx, sarl, p.id)).body;
    const [ra, rb] = await Promise.all([
      ctx.http().post(`/api/v1/offers/${a.id}/accept`).set(amina.auth),
      ctx.http().post(`/api/v1/offers/${b.id}/accept`).set(amina.auth),
    ]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect([ra, rb].find((r) => r.status === 409)!.body.error.code).toBe('PARCEL_ALREADY_ASSIGNED');
    expect(await OfferModel.countDocuments({ parcel: p.id, status: 'accepted' })).toBe(1);
    const parcel = await ParcelModel.findById(p.id).lean();
    expect(parcel!.statusHistory!.filter((h) => h.to === 'assigned')).toHaveLength(1);
  });

  it('liste mes offres par onglet', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p1 = await createParcel(ctx, amina);
    const p2 = await createParcel(ctx, amina);
    const o1 = (await offer(ctx, karim, p1.id)).body;
    await offer(ctx, karim, p2.id);
    await ctx.http().post(`/api/v1/offers/${o1.id}/accept`).set(amina.auth);
    const active = await ctx.http().get('/api/v1/me/offers').query({ tab: 'active' }).set(karim.auth);
    const acc = await ctx.http().get('/api/v1/me/offers').query({ tab: 'accepted' }).set(karim.auth);
    expect(active.body.total).toBe(1);
    expect(acc.body.items[0]).toMatchObject({ id: o1.id, parcel: { title: 'Cadeaux pour la famille' } });
  });
});

describe('vérification et véhicules', () => {
  it('soumet le dossier avec des pièces du dossier sécurisé de l’utilisateur', async () => {
    const ctx = makeTestApp();
    const karim = await verifiedUser(ctx);
    const doc = (n: string) => ({ url: 'https://x/y', publicId: `ucolis/identity_doc/${karim.id}/${n}`, kind: 'image' });
    const future = new Date(Date.now() + 365 * 86_400_000).toISOString();
    const body = {
      documents: { idFront: doc('a'), idBack: doc('b'), driverLicense: doc('c'), vehicleRegistration: doc('d'), insurance: doc('e') },
      licenseExpiresAt: future,
      insuranceExpiresAt: future,
    };
    const res = await ctx.http().post('/api/v1/me/carrier-verification').set(karim.auth).send(body);
    expect(res.body.carrierVerification.status).toBe('pending');
    expect((await ctx.http().post('/api/v1/me/carrier-verification').set(karim.auth).send(body)).status).toBe(409);
    const get = await ctx.http().get('/api/v1/me/carrier-verification').set(karim.auth);
    expect(get.body.documents.idFront.url).toContain('expires_at=');
    const past = { ...body, insuranceExpiresAt: new Date(Date.now() - 86_400_000).toISOString() };
    expect((await ctx.http().post('/api/v1/me/carrier-verification').set(karim.auth).send(past)).status).toBe(400);
  });

  it('gère 1 à 5 véhicules avec un seul par défaut', async () => {
    const ctx = makeTestApp();
    const karim = await verifiedUser(ctx);
    const v = { type: 'van', brand: 'Renault', model: 'Master', plate: '00123-116-16', capacityKg: 1000, volumeM3: 9 };
    let res = await ctx.http().post('/api/v1/me/vehicles').set(karim.auth).send(v);
    expect(res.body.items[0].isDefault).toBe(true);
    res = await ctx.http().post('/api/v1/me/vehicles').set(karim.auth).send({ ...v, type: 'car', isDefault: true });
    expect(res.body.items.filter((x: { isDefault: boolean }) => x.isDefault)).toHaveLength(1);
    for (let i = 0; i < 3; i++) await ctx.http().post('/api/v1/me/vehicles').set(karim.auth).send(v);
    expect((await ctx.http().post('/api/v1/me/vehicles').set(karim.auth).send(v)).status).toBe(422);
    const def = res.body.items.find((x: { isDefault: boolean }) => x.isDefault);
    res = await ctx.http().delete(`/api/v1/me/vehicles/${def.id}`).set(karim.auth);
    expect(res.body.items).toHaveLength(4);
    expect(res.body.items.filter((x: { isDefault: boolean }) => x.isDefault)).toHaveLength(1);
  });
});
