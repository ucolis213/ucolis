import { describe, expect, it } from 'vitest';
import { ParcelModel } from '../src/modules/parcels/model';
import { UserModel } from '../src/modules/users/model';
import { createParcel, parcelInput, verifiedUser } from './fixtures';
import { makeTestApp, registration, useDatabase } from './helpers';

useDatabase();

describe('publication', () => {
  it('exige un email vérifié', async () => {
    const ctx = makeTestApp();
    const reg = await ctx.http().post('/api/v1/auth/register').send(registration());
    const res = await ctx
      .http()
      .post('/api/v1/parcels')
      .set({ Authorization: `Bearer ${reg.body.accessToken}` })
      .send(parcelInput(reg.body.user.id));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('calcule distance, volume et prix suggéré en ignorant les valeurs du client', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const res = await ctx
      .http()
      .post('/api/v1/parcels')
      .set(amina.auth)
      .send(parcelInput(amina.id, { suggestedPrice: 1, distanceKm: 1, volumeM3: 99 }));
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^UC-\d{4}-\d{4}$/);
    expect(res.body.status).toBe('open');
    expect(res.body.volumeM3).toBe(0.036);
    expect(res.body.distanceKm).toBeGreaterThan(340);
    expect(res.body.suggestedPrice).toBeGreaterThanOrEqual(3150);
    expect(res.body.suggestedPrice % 50).toBe(0);
    expect(res.body.viewer.role).toBe('sender');
    const user = await UserModel.findById(amina.id).lean();
    expect(user?.stats?.parcelsPublished).toBe(1);
  });

  it("refuse une photo hors du dossier de l'utilisateur", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const photos = [{ url: 'https://x/y.jpg', publicId: 'ucolis/parcel_photo/autre/p', kind: 'image' }];
    const res = await ctx.http().post('/api/v1/parcels').set(amina.auth).send(parcelInput(amina.id, { photos }));
    expect(res.status).toBe(400);
  });

  it('publie en mode rapide : détails non précisés, tout véhicule, prix suggéré sur la seule distance', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const { pickup, dropoff } = parcelInput(amina.id);
    const quick = { mode: 'quick', pickup, dropoff, title: 'Carton de livres', requestedPrice: 2000, prohibitedItemsDeclared: true };
    const res = await ctx.http().post('/api/v1/parcels').set(amina.auth).send({ ...quick, weightKg: 999 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      weightKg: null,
      dimensionsCm: null,
      volumeM3: null,
      desiredDate: null,
      category: 'other',
      paymentArrangement: 'other',
      photos: [],
      coverPhoto: null,
    });
    expect(res.body.vehicleTypes).toHaveLength(8);
    const full = await createParcel(ctx, amina);
    expect(res.body.suggestedPrice).toBeLessThan(full.suggestedPrice);
    // Sans date : expiration à la fin de la fenêtre de publication (60 jours).
    const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(60);

    // Toujours visible avec un filtre de dates, écartée par un filtre de poids.
    const from = new Date(Date.now() + 86_400_000).toISOString();
    const dated = await ctx.http().get('/api/v1/parcels').query({ dateFrom: from });
    expect(dated.body.items.map((p: { id: string }) => p.id)).toContain(res.body.id);
    const heavy = await ctx.http().get('/api/v1/parcels').query({ maxWeight: 50 });
    expect(heavy.body.items.map((p: { id: string }) => p.id)).not.toContain(res.body.id);

    // Le mode rapide garde les règles communes.
    const bad = await ctx.http().post('/api/v1/parcels').set(amina.auth).send({ ...quick, prohibitedItemsDeclared: false });
    expect(bad.status).toBe(400);
  });

  it('modifie une annonce rapide, puis la complète sans photo', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const { pickup, dropoff } = parcelInput(amina.id);
    const quick = await ctx
      .http()
      .post('/api/v1/parcels')
      .set(amina.auth)
      .send({ mode: 'quick', pickup, dropoff, title: 'Carton de livres', requestedPrice: 2000, prohibitedItemsDeclared: true });
    const patch = (id: string, body: object) => ctx.http().patch(`/api/v1/parcels/${id}`).set(amina.auth).send(body);

    expect((await patch(quick.body.id, { title: 'Deux cartons de livres', photos: [] })).status).toBe(200);
    const completed = await patch(quick.body.id, parcelInput(amina.id, { photos: [] }));
    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({ weightKg: 5, volumeM3: 0.036, category: 'clothing', photos: [] });
    expect(completed.body.desiredDate).not.toBeNull();

    // Heure précise : le créneau en découle ; effacée, le créneau choisi reste.
    const timed = await patch(quick.body.id, { desiredTime: '18:30', timeSlot: 'morning' });
    expect(timed.body).toMatchObject({ desiredTime: '18:30', timeSlot: 'evening' });
    const later = new Date(Date.now() + 300 * 86_400_000).toISOString();
    const cleared = await patch(quick.body.id, { desiredTime: null, timeSlot: 'afternoon', desiredDate: later });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ desiredTime: null, timeSlot: 'afternoon', desiredDate: later });
  });

  it('renvoie 422 ACTIVE_PARCEL_LIMIT à la sixième publication active d’un particulier', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    for (let i = 0; i < 5; i++) await createParcel(ctx, amina);
    const sixth = await ctx.http().post('/api/v1/parcels').set(amina.auth).send(parcelInput(amina.id));
    expect(sixth.status).toBe(422);
    expect(sixth.body.error.code).toBe('ACTIVE_PARCEL_LIMIT');
    // Un colis annulé ne compte plus.
    const [first] = await ParcelModel.find({ sender: amina.id }).lean();
    await ctx.http().post(`/api/v1/parcels/${first!._id}/cancel`).set(amina.auth).send({});
    const again = await ctx.http().post('/api/v1/parcels').set(amina.auth).send(parcelInput(amina.id));
    expect(again.status).toBe(201);
  });

  it('accorde plus de 5 colis actifs à un compte pro validé et affiche sa raison sociale', async () => {
    const ctx = makeTestApp();
    const shop = await verifiedUser(ctx, {}, { 'pro.status': 'approved', 'pro.companyName': 'Boutique Blida' });
    for (let i = 0; i < 6; i++) await createParcel(ctx, shop);
    const list = await ctx.http().get('/api/v1/parcels');
    expect(list.body.items[0].sender).toMatchObject({
      displayName: 'Boutique Blida',
      accountType: 'professional',
      badges: { pro: true },
    });
  });
});

describe('liste publique', () => {
  it('montre open et negotiating, sans masqués ni bloqués, avec filtres et recherche sans accents', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedUser(ctx, { firstName: 'Karim' });
    const setif = { address: 'Centre', wilayaCode: '19', commune: '19001', location: { lat: 36.19, lng: 5.41 } };
    const a = await createParcel(ctx, amina, { title: 'Pièces auto pour Sétif', dropoff: setif, requestedPrice: 9000 });
    await createParcel(ctx, amina, { title: 'Documents urgents', urgent: true, requestedPrice: 1200 });
    const hidden = await createParcel(ctx, amina, { title: 'Annonce masquée' });
    await ParcelModel.updateOne({ _id: hidden.id }, { 'hidden.isHidden': true });
    const assigned = await createParcel(ctx, amina, { title: 'Déjà attribué' });
    await ParcelModel.updateOne({ _id: assigned.id }, { status: 'assigned' });

    const all = await ctx.http().get('/api/v1/parcels');
    expect(all.body.total).toBe(2);
    expect(all.body).toMatchObject({ page: 1, limit: 20, hasMore: false });

    const search = await ctx.http().get('/api/v1/parcels').query({ q: 'setif' });
    expect(search.body.items.map((p: { id: string }) => p.id)).toEqual([a.id]);
    expect((await ctx.http().get('/api/v1/parcels').query({ toWilaya: '19' })).body.total).toBe(1);
    expect((await ctx.http().get('/api/v1/parcels').query({ urgent: 'true' })).body.total).toBe(1);
    expect((await ctx.http().get('/api/v1/parcels').query({ priceMax: 2000 })).body.total).toBe(1);
    const sorted = await ctx.http().get('/api/v1/parcels').query({ sort: 'price_desc' });
    expect(sorted.body.items[0].requestedPrice).toBe(9000);

    const near = await ctx
      .http()
      .get('/api/v1/parcels')
      .query({ lat: 36.75, lng: 3.05, radiusKm: 25, sort: 'nearest' });
    expect(near.body.total).toBe(2);
    expect(near.body.items).toHaveLength(2);
    const far = await ctx.http().get('/api/v1/parcels').query({ lat: 35.7, lng: -0.63, radiusKm: 10 });
    expect(far.body.total).toBe(0);

    await ctx.http().post(`/api/v1/me/blocked/${amina.id}`).set(karim.auth);
    expect((await ctx.http().get('/api/v1/parcels').set(karim.auth)).body.total).toBe(0);
  });

  it('pagine (50 au maximum) et filtre les comptes pro', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    for (let i = 0; i < 3; i++) await createParcel(ctx, amina);
    const page = await ctx.http().get('/api/v1/parcels').query({ limit: 2 });
    expect(page.body).toMatchObject({ total: 3, hasMore: true });
    expect(page.body.items).toHaveLength(2);
    expect((await ctx.http().get('/api/v1/parcels').query({ limit: 51 })).status).toBe(400);
    expect((await ctx.http().get('/api/v1/parcels').query({ proOnly: 'true' })).body.total).toBe(0);
  });
});

describe('détail', () => {
  it('reste visible des invités en open, puis indisponible pour les autres après annulation', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina, { recipient: { name: 'Yacine', phone: '0661234567' } });
    const guest = await ctx.http().get(`/api/v1/parcels/${p.id}`);
    expect(guest.body.viewer.role).toBe('guest');
    expect(guest.body.recipient).toBeNull();
    const carrier = await ctx.http().get(`/api/v1/parcels/${p.id}`).set(karim.auth);
    expect(carrier.body.viewer.role).toBe('carrier_no_offer');
    expect(carrier.body.recipient).toBeNull();
    const owner = await ctx.http().get(`/api/v1/parcels/${p.id}`).set(amina.auth);
    expect(owner.body.recipient).toEqual({ name: 'Yacine', phone: '+213661234567' });

    await ctx.http().post(`/api/v1/parcels/${p.id}/cancel`).set(amina.auth).send({});
    const gone = await ctx.http().get(`/api/v1/parcels/${p.id}`).set(karim.auth);
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('PARCEL_UNAVAILABLE');
    expect((await ctx.http().get(`/api/v1/parcels/${p.id}`).set(amina.auth)).body.status).toBe('cancelled');
  });
});

describe('modification et annulation', () => {
  it('réservées au propriétaire, recalcul du prix suggéré, impossibles après attribution', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    const intrus = await ctx.http().patch(`/api/v1/parcels/${p.id}`).set(karim.auth).send({ title: 'Piratage !' });
    expect(intrus.status).toBe(403);

    const heavier = await ctx.http().patch(`/api/v1/parcels/${p.id}`).set(amina.auth).send({ weightKg: 50 });
    expect(heavier.status).toBe(200);
    expect(heavier.body.suggestedPrice).toBeGreaterThan(p.suggestedPrice);

    await ParcelModel.updateOne({ _id: p.id }, { status: 'assigned' });
    const locked = await ctx.http().patch(`/api/v1/parcels/${p.id}`).set(amina.auth).send({ title: 'Nouveau titre' });
    expect(locked.status).toBe(409);
    const noReason = await ctx.http().post(`/api/v1/parcels/${p.id}/cancel`).set(amina.auth).send({});
    expect(noReason.status).toBe(400);
    const withReason = await ctx
      .http()
      .post(`/api/v1/parcels/${p.id}/cancel`)
      .set(amina.auth)
      .send({ reason: 'Plus besoin' });
    expect(withReason.body.status).toBe('cancelled');
    expect(withReason.body.cancellation.reason).toBe('Plus besoin');
    const again = await ctx.http().post(`/api/v1/parcels/${p.id}/cancel`).set(amina.auth).send({});
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
  });

  it("refuse l'annulation une fois la livraison démarrée", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    await ParcelModel.updateOne({ _id: p.id }, { status: 'in_transit' });
    const res = await ctx.http().post(`/api/v1/parcels/${p.id}/cancel`).set(amina.auth).send({ reason: 'x' });
    expect(res.status).toBe(409);
  });

  it('duplique seulement pour un compte pro', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    expect((await ctx.http().post(`/api/v1/parcels/${p.id}/duplicate`).set(amina.auth)).status).toBe(403);
    await UserModel.updateOne({ _id: amina.id }, { 'pro.status': 'approved' });
    const dup = await ctx.http().post(`/api/v1/parcels/${p.id}/duplicate`).set(amina.auth);
    expect(dup.body).toMatchObject({ title: 'Cadeaux pour la famille', desiredDate: null });
  });

  it('liste mes colis par statut', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    await createParcel(ctx, amina);
    await ctx.http().post(`/api/v1/parcels/${p.id}/cancel`).set(amina.auth).send({});
    const res = await ctx.http().get('/api/v1/me/parcels').query({ status: 'open,negotiating' }).set(amina.auth);
    expect(res.body.total).toBe(1);
  });
});

describe('géo et profil public', () => {
  it("déduit wilaya et commune d'un point et cherche une commune", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const rev = await ctx.http().get('/api/v1/geo/reverse').query({ lat: 36.19, lng: 5.41 }).set(amina.auth);
    expect(rev.body.wilayaCode).toBe('19');
    const search = await ctx.http().get('/api/v1/geo/search').query({ q: 'oran' }).set(amina.auth);
    expect(search.body.items[0].wilayaCode).toBe('31');
    expect((await ctx.http().get('/api/v1/geo/reverse').query({ lat: 1, lng: 1 })).status).toBe(401);
  });

  it("n'expose ni email ni téléphone dans le profil public", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const res = await ctx.http().get(`/api/v1/users/${amina.id}`);
    expect(res.body.displayName).toBe('Amina B.');
    expect(JSON.stringify(res.body)).not.toContain(amina.email);
    expect(res.body).not.toHaveProperty('phone');
    expect((await ctx.http().get('/api/v1/users/123')).status).toBe(404);
  });
});
