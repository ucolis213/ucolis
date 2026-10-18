import { describe, expect, it } from 'vitest';
import { autoConfirmDeliveries, carrierDocuments, confirmReminders, expireParcels, lateDeliveries } from '../src/jobs/sweeps';
import { MessageModel } from '../src/modules/conversations/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { OfferModel } from '../src/modules/offers/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { TrackPointModel } from '../src/modules/tracking/model';
import { UserModel } from '../src/modules/users/model';
import { createParcel, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { makeTestApp, useDatabase } from './helpers';

useDatabase();

const HOUR = 3600_000;
const pickup = () => new Date(Date.now() + 2 * 86_400_000).toISOString();

async function deal(ctx: TestApp, opts: { others?: number } = {}) {
  const amina = await verifiedUser(ctx);
  const karim = await verifiedCarrier(ctx);
  const p = await createParcel(ctx, amina);
  const offer = async (c: { auth: Record<string, string>; vehicleId: string }) =>
    (await ctx.http().post(`/api/v1/parcels/${p.id}/offers`).set(c.auth).send({ price: 3250, vehicleId: c.vehicleId, proposedPickupDate: pickup() })).body;
  const o = await offer(karim);
  const others = [];
  for (let i = 0; i < (opts.others ?? 0); i++) {
    const c = await verifiedCarrier(ctx);
    others.push({ carrier: c, offer: await offer(c) });
  }
  await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
  return { amina, karim, parcel: p, offer: o, others };
}

describe('livraison avec code', () => {
  it('démarre, refuse un mauvais code, puis livre avec le bon code sans validation de l’expéditeur', async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await deal(ctx);
    expect((await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(amina.auth)).status).toBe(403);
    const started = await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth);
    expect(started.body).toMatchObject({ status: 'in_transit' });
    expect(started.body.startedAt).toBeTruthy();
    expect((await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth)).body.error.code).toBe('INVALID_TRANSITION');

    const { code } = (await ctx.http().get(`/api/v1/parcels/${parcel.id}/delivery-code`).set(amina.auth)).body;
    expect(code).toMatch(/^\d{4}$/);
    expect((await ctx.http().get(`/api/v1/parcels/${parcel.id}/delivery-code`).set(karim.auth)).status).toBe(403);

    const wrong = code === '0000' ? '1111' : '0000';
    const bad = await ctx.http().post(`/api/v1/parcels/${parcel.id}/delivery-code`).set(karim.auth).send({ code: wrong });
    expect(bad.body.error).toMatchObject({ code: 'INVALID_CODE', details: { attemptsLeft: 4 } });
    const ok = await ctx.http().post(`/api/v1/parcels/${parcel.id}/delivery-code`).set(karim.auth).send({ code });
    expect(ok.body).toMatchObject({ status: 'delivered' });

    const [sender, carrier] = await Promise.all([UserModel.findById(amina.id).lean(), UserModel.findById(karim.id).lean()]);
    expect(sender!.stats!.parcelsSent).toBe(1);
    expect(carrier!.stats!.parcelsCarried).toBe(1);
    const systemKeys = (await MessageModel.find({ type: 'system' }).sort({ createdAt: 1 }).lean()).map((m) => m.systemKey);
    expect(systemKeys).toEqual(['offer_accepted', 'delivery_started', 'delivery_completed']);
    expect(await NotificationModel.countDocuments({ type: 'delivery_completed' })).toBe(2);
    expect(ctx.realtime.eventsFor(`tracking:${parcel.id}`, 'tracking:stopped')).toHaveLength(1);
  });

  it('bloque la saisie après 5 erreurs : il faut déclarer la livraison', async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth);
    const { code } = (await ctx.http().get(`/api/v1/parcels/${parcel.id}/delivery-code`).set(amina.auth)).body;
    const wrong = code === '0000' ? '1111' : '0000';
    for (let i = 0; i < 4; i++) await ctx.http().post(`/api/v1/parcels/${parcel.id}/delivery-code`).set(karim.auth).send({ code: wrong });
    const fifth = await ctx.http().post(`/api/v1/parcels/${parcel.id}/delivery-code`).set(karim.auth).send({ code: wrong });
    expect(fifth.body.error.code).toBe('DELIVERY_CODE_LOCKED');
    const locked = await ctx.http().post(`/api/v1/parcels/${parcel.id}/delivery-code`).set(karim.auth).send({ code });
    expect(locked.body.error.code).toBe('DELIVERY_CODE_LOCKED');
    expect((await ctx.http().get(`/api/v1/parcels/${parcel.id}`).set(karim.auth)).body.deliveryCodeLocked).toBe(true);
  });
});

describe('livraison déclarée', () => {
  it("programme la validation automatique à 72 h, relance à +24 h et +60 h, et seul l'expéditeur confirme", async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth);
    const declared = await ctx
      .http()
      .post(`/api/v1/parcels/${parcel.id}/declare-delivered`)
      .set(karim.auth)
      .send({ note: 'Remis au gardien' });
    expect(declared.body).toMatchObject({ status: 'delivered_pending', deliveryProof: { note: 'Remis au gardien' } });
    expect(new Date(declared.body.autoConfirmAt).getTime() - ctx.clock.now().getTime()).toBe(72 * HOUR);
    expect((await ctx.http().post(`/api/v1/parcels/${parcel.id}/confirm-delivery`).set(karim.auth)).status).toBe(403);

    ctx.clock.advance(25 * HOUR);
    expect(await confirmReminders(ctx.deps, ctx.services)).toBe(1);
    expect(await confirmReminders(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(36 * HOUR);
    expect(await confirmReminders(ctx.deps, ctx.services)).toBe(1);
    expect(await NotificationModel.countDocuments({ recipient: amina.id, type: 'delivery_confirm_reminder' })).toBe(2);

    expect(await autoConfirmDeliveries(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(12 * HOUR);
    expect(await autoConfirmDeliveries(ctx.deps, ctx.services)).toBe(1);
    expect((await ParcelModel.findById(parcel.id).lean())!.status).toBe('delivered');
    expect(await autoConfirmDeliveries(ctx.deps, ctx.services)).toBe(0);
  });

  it('ne valide jamais automatiquement un colis en litige', async () => {
    const ctx = makeTestApp();
    const { karim, parcel } = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/declare-delivered`).set(karim.auth).send({});
    await ParcelModel.updateOne({ _id: parcel.id }, { status: 'disputed' });
    ctx.clock.advance(100 * HOUR);
    expect(await autoConfirmDeliveries(ctx.deps, ctx.services)).toBe(0);
    expect((await ParcelModel.findById(parcel.id).lean())!.status).toBe('disputed');
  });

  it("confirme côté expéditeur", async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/declare-delivered`).set(karim.auth).send({});
    const res = await ctx.http().post(`/api/v1/parcels/${parcel.id}/confirm-delivery`).set(amina.auth);
    expect(res.body.status).toBe('delivered');
  });
});

describe('désistement', () => {
  it('réactive les offres refusées à cause de l’acceptation et repasse en negotiating', async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel, others } = await deal(ctx, { others: 2 });
    // L'un des deux n'est plus éligible : son identité a expiré.
    await UserModel.updateOne({ _id: others[1]!.carrier.id }, { 'carrierVerification.status': 'expired' });
    expect((await ctx.http().post(`/api/v1/parcels/${parcel.id}/withdraw`).set(amina.auth)).status).toBe(403);
    const res = await ctx.http().post(`/api/v1/parcels/${parcel.id}/withdraw`).set(karim.auth);
    expect(res.status).toBe(200);
    const p = await ParcelModel.findById(parcel.id).lean();
    expect(p).toMatchObject({ status: 'negotiating', assignedCarrier: null, finalPrice: null });
    expect(p!.deliveryCode!.cipher).toBeNull();
    expect((await OfferModel.findById(others[0]!.offer.id).lean())!.status).toBe('pending');
    expect((await OfferModel.findById(others[1]!.offer.id).lean())!.status).toBe('rejected');
    expect((await UserModel.findById(karim.id).lean())!.stats!.withdrawals).toBe(1);
    const types = (await NotificationModel.find({}).lean()).map((n) => `${n.type}:${n.recipient}`);
    expect(types).toContain(`carrier_withdrew:${amina.id}`);
    expect(types).toContain(`offer_reactivated:${others[0]!.carrier.id}`);
  });

  it('repasse en open sans offre réactivable, refuse après le départ, et signale 3 désistements en 30 jours', async () => {
    const ctx = makeTestApp();
    const alerts: unknown[] = [];
    ctx.deps.bus.on('carrier.withdrawals_threshold', (e) => void alerts.push(e));
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    for (let i = 0; i < 3; i++) {
      const p = await createParcel(ctx, amina);
      const o = (await ctx.http().post(`/api/v1/parcels/${p.id}/offers`).set(karim.auth).send({ price: 3000, vehicleId: karim.vehicleId, proposedPickupDate: pickup() })).body;
      await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
      if (i === 0) {
        await ctx.http().post(`/api/v1/parcels/${p.id}/start`).set(karim.auth);
        expect((await ctx.http().post(`/api/v1/parcels/${p.id}/withdraw`).set(karim.auth)).status).toBe(409);
        await ParcelModel.updateOne({ _id: p.id }, { status: 'assigned' });
      }
      await ctx.http().post(`/api/v1/parcels/${p.id}/withdraw`).set(karim.auth);
      expect((await ParcelModel.findById(p.id).lean())!.status).toBe('open');
    }
    expect(alerts).toEqual([{ carrierId: karim.id, count: 3 }]);
  });
});

describe('suivi GPS', () => {
  const position = (parcelId: string, at: Date, lat = 36.5) => ({ parcelId, lat, lng: 2.5, accuracy: 10, heading: 90, speed: 20, at });

  it("n'accepte de position qu'en in_transit, au plus toutes les 5 s, et historise une fois par minute", async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await deal(ctx);
    const intrus = await verifiedUser(ctx);
    await expect(ctx.services.tracking.record(karim.id, position(parcel.id, ctx.clock.now()))).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth);
    await expect(ctx.services.tracking.record(amina.id, position(parcel.id, ctx.clock.now()))).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(await ctx.services.tracking.record(karim.id, position(parcel.id, ctx.clock.now()))).toBeTruthy();
    ctx.clock.advance(2000);
    expect(await ctx.services.tracking.record(karim.id, position(parcel.id, ctx.clock.now()))).toBeNull();
    ctx.clock.advance(10_000);
    await ctx.services.tracking.record(karim.id, position(parcel.id, ctx.clock.now(), 36.6));
    expect(await TrackPointModel.countDocuments({ parcel: parcel.id })).toBe(1);
    ctx.clock.advance(60_000);
    await ctx.services.tracking.record(karim.id, position(parcel.id, ctx.clock.now(), 36.7));
    expect(await TrackPointModel.countDocuments({ parcel: parcel.id })).toBe(2);
    expect(ctx.realtime.eventsFor(`tracking:${parcel.id}`, 'tracking:update')).toHaveLength(3);

    const last = await ctx.http().get(`/api/v1/parcels/${parcel.id}/tracking`).set(amina.auth);
    expect(last.body).toMatchObject({ status: 'in_transit', last: { lat: 36.7, heading: 90 } });
    expect((await ctx.http().get(`/api/v1/parcels/${parcel.id}/tracking`).set(intrus.auth)).status).toBe(403);
  });
});

describe('balayages', () => {
  it('expire les annonces sans transporteur et annule leurs offres', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    const p = await createParcel(ctx, amina);
    const o = (await ctx.http().post(`/api/v1/parcels/${p.id}/offers`).set(karim.auth).send({ price: 3000, vehicleId: karim.vehicleId, proposedPickupDate: pickup() })).body;
    expect(await expireParcels(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(11 * 24 * HOUR);
    expect(await expireParcels(ctx.deps, ctx.services)).toBe(1);
    expect((await ParcelModel.findById(p.id).lean())!.status).toBe('expired');
    expect((await OfferModel.findById(o.id).lean())!.status).toBe('cancelled');
    expect(await NotificationModel.countDocuments({ recipient: amina.id, type: 'parcel_expired' })).toBe(1);
    expect(await expireParcels(ctx.deps, ctx.services)).toBe(0);
  });

  it('relance les deux parties d’un colis en retard, une seule fois', async () => {
    const ctx = makeTestApp();
    const { karim, parcel } = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/start`).set(karim.auth);
    ctx.clock.advance(7 * 24 * HOUR);
    expect(await lateDeliveries(ctx.deps, ctx.services)).toBe(1);
    expect(await lateDeliveries(ctx.deps, ctx.services)).toBe(0);
    expect(await NotificationModel.countDocuments({ type: 'delivery_late' })).toBe(2);
  });

  it('rappelle les pièces à J-30 et J-7 et expire le dossier le jour même', async () => {
    const ctx = makeTestApp();
    const karim = await verifiedCarrier(ctx);
    const now = ctx.clock.now().getTime();
    await UserModel.updateOne(
      { _id: karim.id },
      {
        'carrierVerification.licenseExpiresAt': new Date(now + 400 * 24 * HOUR),
        'carrierVerification.insuranceExpiresAt': new Date(now + 20 * 24 * HOUR),
      },
    );
    expect(await carrierDocuments(ctx.deps, ctx.services)).toBe(1);
    expect(await carrierDocuments(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(14 * 24 * HOUR);
    expect(await carrierDocuments(ctx.deps, ctx.services)).toBe(1);
    ctx.clock.advance(6 * 24 * HOUR + 1);
    expect(await carrierDocuments(ctx.deps, ctx.services)).toBe(1);
    expect((await UserModel.findById(karim.id).lean())!.carrierVerification!.status).toBe('expired');
    const types = (await NotificationModel.find({ recipient: karim.id }).sort({ createdAt: 1 }).lean()).map((n) => n.type);
    expect(types).toEqual(['identity_expiring', 'identity_expiring', 'identity_expired']);
  });
});
