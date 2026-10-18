import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { autoConfirmDeliveries, publishReviews, reviewReminders } from '../src/jobs/sweeps';
import { deriveKey, encrypt } from '../src/lib/crypto';
import { newTotpSecret, totpAt } from '../src/lib/totp';
import { StaffModel } from '../src/modules/admin/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { DisputeModel, ReportModel } from '../src/modules/trust/model';
import { UserModel } from '../src/modules/users/model';
import { createParcel, relogin, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { bearer, makeTestApp, useDatabase } from './helpers';

useDatabase();

const DAY = 86_400_000;
const pickup = () => new Date(Date.now() + 2 * DAY).toISOString();

async function deal(ctx: TestApp) {
  const amina = await verifiedUser(ctx);
  const karim = await verifiedCarrier(ctx);
  const p = await createParcel(ctx, amina);
  const o = (await ctx.http().post(`/api/v1/parcels/${p.id}/offers`).set(karim.auth).send({ price: 3250, vehicleId: karim.vehicleId, proposedPickupDate: pickup() })).body;
  await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
  await ctx.http().post(`/api/v1/parcels/${p.id}/start`).set(karim.auth);
  return { amina, karim, parcel: p };
}

async function delivered(ctx: TestApp) {
  const d = await deal(ctx);
  const { code } = (await ctx.http().get(`/api/v1/parcels/${d.parcel.id}/delivery-code`).set(d.amina.auth)).body;
  await ctx.http().post(`/api/v1/parcels/${d.parcel.id}/delivery-code`).set(d.karim.auth).send({ code });
  return d;
}

async function staff(ctx: TestApp, permissions: string[]) {
  const secret = newTotpSecret();
  const email = `s${Math.random().toString(36).slice(2, 8)}@ucolis.dz`;
  await StaffModel.create({
    email, firstName: 'Modo', lastName: 'Staff', role: 'moderator', permissions, status: 'active',
    passwordHash: await bcrypt.hash('Password123', 4),
    totpSecret: encrypt(deriveKey(ctx.deps.config.deliveryCodeKey, 'staff-totp'), secret),
  });
  const res = await ctx.http().post('/api/v1/admin/auth/login').send({ email, password: 'Password123', totp: totpAt(secret, ctx.clock.now().getTime()) });
  return bearer(res.body.accessToken);
}

describe('avis en double aveugle', () => {
  it("ne publie qu'une fois les deux parties ayant noté, puis recalcule les notes", async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await delivered(ctx);
    const status = await ctx.http().get(`/api/v1/parcels/${parcel.id}/review-status`).set(amina.auth);
    expect(status.body).toMatchObject({ canReview: true, direction: 'sender_to_carrier', target: { id: karim.id } });

    const first = await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(amina.auth).send({ rating: 5, criteria: { punctuality: 5, accuracy: 1 }, comment: 'Parfait' });
    expect(first.body.published).toBe(false);
    expect((await ctx.http().get(`/api/v1/users/${karim.id}/reviews`)).body.total).toBe(0);
    expect((await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(amina.auth).send({ rating: 4 })).status).toBe(409);

    const second = await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(karim.auth).send({ rating: 4 });
    expect(second.body.published).toBe(true);
    const pub = await ctx.http().get(`/api/v1/users/${karim.id}/reviews`);
    expect(pub.body.items[0]).toMatchObject({ rating: 5, comment: 'Parfait', criteria: { punctuality: 5 } });
    expect(pub.body.items[0].criteria).not.toHaveProperty('accuracy');
    expect((await UserModel.findById(karim.id).lean())!.rating).toMatchObject({ average: 5, count: 1, distribution: [0, 0, 0, 0, 1] });
    expect(await NotificationModel.countDocuments({ type: 'review_published' })).toBe(2);

    const reviewId = pub.body.items[0].id;
    expect((await ctx.http().post(`/api/v1/reviews/${reviewId}/reply`).set(amina.auth).send({ text: 'Merci' })).status).toBe(404);
    expect((await ctx.http().post(`/api/v1/reviews/${reviewId}/reply`).set(karim.auth).send({ text: 'Merci Amina' })).status).toBe(204);
    expect((await ctx.http().post(`/api/v1/reviews/${reviewId}/reply`).set(karim.auth).send({ text: 'Encore' })).status).toBe(409);
    const detail = await ctx.http().get(`/api/v1/parcels/${parcel.id}`).set(amina.auth);
    expect(detail.body.viewer.hasReviewed).toBe(true);
  });

  it('relance à +3 jours, publie à la fin des 14 jours et ferme la fenêtre', async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await delivered(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(amina.auth).send({ rating: 2 });
    ctx.clock.advance(3 * DAY + 1000);
    expect(await reviewReminders(ctx.deps, ctx.services)).toBe(1);
    expect(await reviewReminders(ctx.deps, ctx.services)).toBe(0);
    expect(await NotificationModel.countDocuments({ type: 'review_reminder', recipient: karim.id })).toBe(1);
    ctx.clock.advance(11 * DAY);
    expect(await publishReviews(ctx.deps, ctx.services)).toBe(1);
    expect((await UserModel.findById(karim.id).lean())!.rating!.average).toBe(2);
    await relogin(ctx, karim);
    const late = await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(karim.auth).send({ rating: 5 });
    expect(late.status).toBe(409);
  });

  it("refuse un avis d'un tiers ou avant la livraison", async () => {
    const ctx = makeTestApp();
    const { amina, parcel } = await deal(ctx);
    const intrus = await verifiedUser(ctx);
    expect((await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(intrus.auth).send({ rating: 1 })).status).toBe(403);
    expect((await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(amina.auth).send({ rating: 5 })).status).toBe(409);
  });
});

describe('signalements', () => {
  it("refuse l'auto-signalement et les doublons, puis masque une annonce signalée par 3 utilisateurs", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const p = await createParcel(ctx, amina);
    const report = (u: { auth: Record<string, string> }) =>
      ctx.http().post('/api/v1/reports').set(u.auth).send({ targetType: 'parcel', targetId: p.id, reason: 'fake_listing' });
    expect((await report(amina)).status).toBe(422);
    const users = [await verifiedUser(ctx), await verifiedUser(ctx), await verifiedUser(ctx)];
    expect((await report(users[0]!)).status).toBe(201);
    expect((await report(users[0]!)).body.error.code).toBe('ALREADY_REPORTED');
    await report(users[1]!);
    expect((await ParcelModel.findById(p.id).lean())!.hidden!.isHidden).toBe(false);
    await report(users[2]!);
    expect((await ParcelModel.findById(p.id).lean())!.hidden).toMatchObject({ isHidden: true, reason: 'auto_reports' });
    expect((await ctx.http().get('/api/v1/parcels')).body.total).toBe(0);
  });

  it('traite un signalement et prévient son auteur sans détail', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedUser(ctx);
    const rep = await ctx.http().post('/api/v1/reports').set(karim.auth).send({ targetType: 'user', targetId: amina.id, reason: 'scam', description: 'Arnaque' });
    const modo = await staff(ctx, ['reports.handle']);
    const list = await ctx.http().get('/api/v1/admin/reports').set(modo);
    expect(list.body.items[0]).toMatchObject({ id: rep.body.id, reason: 'scam', targetType: 'user' });
    const detail = await ctx.http().get(`/api/v1/admin/reports/${rep.body.id}`).set(modo);
    expect(detail.body.target.id).toBe(amina.id);
    expect((await ctx.http().post(`/api/v1/admin/reports/${rep.body.id}/resolve`).set(modo).send({ note: 'Averti' })).status).toBe(204);
    const notif = await NotificationModel.findOne({ recipient: karim.id, type: 'report_resolved' }).lean();
    expect(notif).toBeTruthy();
    expect(JSON.stringify(notif!.params ?? {})).not.toContain('Averti');
  });
});

describe('litiges', () => {
  it('gèle la validation automatique et se tranche depuis le back-office avec notification aux deux parties', async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await deal(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/declare-delivered`).set(karim.auth).send({});
    const open = await ctx.http().post(`/api/v1/parcels/${parcel.id}/disputes`).set(amina.auth).send({ reason: 'not_delivered', description: 'Je n’ai rien reçu à cette adresse.' });
    expect(open.status).toBe(201);
    expect((await ParcelModel.findById(parcel.id).lean())).toMatchObject({ status: 'disputed', autoConfirmAt: null });
    const again = await ctx.http().post(`/api/v1/parcels/${parcel.id}/disputes`).set(karim.auth).send({ reason: 'other', description: 'Je conteste ce litige ouvert.' });
    expect(again.body.error.code).toBe('DISPUTE_ALREADY_OPEN');
    expect(await NotificationModel.countDocuments({ recipient: karim.id, type: 'dispute_opened' })).toBe(1);

    ctx.clock.advance(100 * 3600_000);
    expect(await autoConfirmDeliveries(ctx.deps, ctx.services)).toBe(0);
    await relogin(ctx, karim);
    await relogin(ctx, amina);
    const late = await ctx.http().post(`/api/v1/disputes/${open.body.id}/response`).set(karim.auth).send({ text: 'Livré au gardien' });
    expect(late.status).toBe(409);

    const support = await staff(ctx, ['disputes.handle', 'conversations.view_reported']);
    void amina;
    const dossier = await ctx.http().get(`/api/v1/admin/disputes/${open.body.id}`).set(support);
    expect(dossier.body).toMatchObject({ dispute: { reason: 'not_delivered' }, parcel: { status: 'disputed' } });
    expect(dossier.body.messages.map((m: { systemKey: string }) => m.systemKey)).toContain('dispute_opened');
    const conv = await ctx.http().get(`/api/v1/admin/conversations/${dossier.body.conversationId}/messages`).query({ disputeId: open.body.id }).set(support);
    expect(conv.status).toBe(200);
    expect(Object.keys(conv.body.people)).toHaveLength(2);
    expect(conv.body.parcelId).toBe(dossier.body.parcel.id);
    expect((await ctx.http().get(`/api/v1/admin/conversations/${dossier.body.conversationId}/messages`).set(support)).status).toBe(403);

    expect((await ctx.http().post(`/api/v1/admin/disputes/${open.body.id}/claim`).set(support)).status).toBe(200);
    const decision = await ctx.http().post(`/api/v1/admin/disputes/${open.body.id}/decision`).set(support).send({ outcome: 'cancelled', note: 'Aucune preuve de remise fournie.' });
    expect(decision.status).toBe(204);
    expect((await ParcelModel.findById(parcel.id).lean())!.status).toBe('cancelled');
    expect((await UserModel.findById(karim.id).lean())!.stats!.disputesLost).toBe(1);
    expect(await NotificationModel.countDocuments({ type: 'dispute_resolved' })).toBe(2);
    const view = await ctx.http().get(`/api/v1/disputes/${open.body.id}`).set(amina.auth);
    expect(view.body).toMatchObject({ status: 'resolved', outcome: 'cancelled', decisionNote: 'Aucune preuve de remise fournie.' });
  });

  it("laisse 48 h à l'autre partie et peut trancher en livré", async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await deal(ctx);
    const open = await ctx.http().post(`/api/v1/parcels/${parcel.id}/disputes`).set(karim.auth).send({ reason: 'price_disagreement', description: 'Le prix convenu n’a pas été respecté.' });
    expect((await ctx.http().post(`/api/v1/disputes/${open.body.id}/response`).set(karim.auth).send({ text: 'Moi-même' })).status).toBe(403);
    const resp = await ctx.http().post(`/api/v1/disputes/${open.body.id}/response`).set(amina.auth).send({ text: 'Le prix a été payé en entier.' });
    expect(resp.body.response.text).toBe('Le prix a été payé en entier.');
    const support = await staff(ctx, ['disputes.handle']);
    await ctx.http().post(`/api/v1/admin/disputes/${open.body.id}/decision`).set(support).send({ outcome: 'delivered', note: 'Remise confirmée par les deux parties.' });
    const p = await ParcelModel.findById(parcel.id).lean();
    expect(p!.status).toBe('delivered');
    expect((await UserModel.findById(karim.id).lean())!.stats!.parcelsCarried).toBe(1);
    expect(await DisputeModel.countDocuments({ status: 'resolved' })).toBe(1);
  });

  it('crée un signalement automatique après 3 désistements en 30 jours', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    for (let i = 0; i < 3; i++) {
      const p = await createParcel(ctx, amina);
      const o = (await ctx.http().post(`/api/v1/parcels/${p.id}/offers`).set(karim.auth).send({ price: 3000, vehicleId: karim.vehicleId, proposedPickupDate: pickup() })).body;
      await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
      await ctx.http().post(`/api/v1/parcels/${p.id}/withdraw`).set(karim.auth);
    }
    expect(await ReportModel.countDocuments({ reporter: null, targetType: 'user', targetId: karim.id })).toBe(1);
  });
});

describe('avis côté staff', () => {
  it('masque un avis et recalcule la note', async () => {
    const ctx = makeTestApp();
    const { amina, karim, parcel } = await delivered(ctx);
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(amina.auth).send({ rating: 1, comment: 'Insulte' });
    await ctx.http().post(`/api/v1/parcels/${parcel.id}/reviews`).set(karim.auth).send({ rating: 5 });
    const modo = await staff(ctx, ['reviews.moderate']);
    const list = await ctx.http().get('/api/v1/admin/reviews').query({ maxRating: 2 }).set(modo);
    expect(list.body.total).toBe(1);
    await ctx.http().post(`/api/v1/admin/reviews/${list.body.items[0].id}/hide`).set(modo).send({ hidden: true, reason: 'Propos injurieux' });
    expect((await UserModel.findById(karim.id).lean())!.rating).toMatchObject({ count: 0, average: 0 });
  });
});
