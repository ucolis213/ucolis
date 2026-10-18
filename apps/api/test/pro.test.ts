import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { deriveKey, encrypt } from '../src/lib/crypto';
import { newTotpSecret, totpAt } from '../src/lib/totp';
import { StaffModel } from '../src/modules/admin/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { createParcel, verifiedUser, type TestApp, type TestUser } from './fixtures';
import { bearer, makeTestApp, useDatabase } from './helpers';

useDatabase();

async function verifier(ctx: TestApp) {
  const secret = newTotpSecret();
  await StaffModel.create({
    email: 'pro-verif@ucolis.dz', firstName: 'Nadia', lastName: 'K', role: 'moderator', status: 'active',
    permissions: ['verifications.pro', 'users.view'],
    passwordHash: await bcrypt.hash('Password123', 4),
    totpSecret: encrypt(deriveKey(ctx.deps.config.deliveryCodeKey, 'staff-totp'), secret),
  });
  const res = await ctx.http().post('/api/v1/admin/auth/login').send({ email: 'pro-verif@ucolis.dz', password: 'Password123', totp: totpAt(secret, ctx.clock.now().getTime()) });
  return bearer(res.body.accessToken);
}

const application = (u: TestUser, patch = {}) => ({
  companyName: 'Boutique Blida SARL',
  legalForm: 'sarl',
  rcNumber: '09/00-1234567B21',
  rcDocument: { url: 'https://x/rc.pdf', publicId: `ucolis/pro_doc/${u.id}/rc`, kind: 'pdf' },
  nif: '000916012345678',
  nifDocument: { url: 'https://x/nif.pdf', publicId: `ucolis/pro_doc/${u.id}/nif`, kind: 'pdf' },
  address: '12 rue des Martyrs',
  place: { wilayaCode: '09', commune: '09001' },
  ...patch,
});

describe('statut professionnel', () => {
  it('reste particulier tant que le dossier n’est pas validé, puis affiche le badge partout', async () => {
    const ctx = makeTestApp();
    const shop = await verifiedUser(ctx);
    expect((await ctx.http().post('/api/v1/me/pro').set(shop.auth).send(application(shop, { nif: '123' }))).status).toBe(400);
    const sent = await ctx.http().post('/api/v1/me/pro').set(shop.auth).send(application(shop));
    expect(sent.body).toMatchObject({ accountType: 'individual', pro: { status: 'pending' } });
    expect((await ctx.http().post('/api/v1/me/pro').set(shop.auth).send(application(shop))).status).toBe(409);
    await createParcel(ctx, shop);
    expect((await ctx.http().get('/api/v1/parcels')).body.items[0].sender.badges.pro).toBe(false);

    const modo = await verifier(ctx);
    const queue = await ctx.http().get('/api/v1/admin/verifications/pro').set(modo);
    expect(queue.body.items[0]).toMatchObject({ userId: shop.id, companyName: 'Boutique Blida SARL', change: false });
    const detail = await ctx.http().get(`/api/v1/admin/verifications/pro/${shop.id}`).set(modo);
    expect(detail.body.application.documents[0].file.url).toContain('expires_at=');
    const noReason = await ctx.http().post(`/api/v1/admin/verifications/pro/${shop.id}/decision`).set(modo).send({ decision: 'reject' });
    expect(noReason.status).toBe(400);
    await ctx.http().post(`/api/v1/admin/verifications/pro/${shop.id}/decision`).set(modo).send({ decision: 'approve' });

    const me = await ctx.http().get('/api/v1/me').set(shop.auth);
    expect(me.body).toMatchObject({ accountType: 'professional', badges: { pro: true } });
    const card = (await ctx.http().get('/api/v1/parcels')).body.items[0];
    expect(card.sender).toMatchObject({ displayName: 'Boutique Blida SARL', badges: { pro: true } });
    expect(await NotificationModel.countDocuments({ recipient: shop.id, type: 'pro_approved' })).toBe(1);
    const csv = await ctx.http().get('/api/v1/me/parcels/export').set(shop.auth);
    expect(csv.text).toContain('reference;createdAt');
  });

  it('refuse avec motif et permet un nouveau dépôt', async () => {
    const ctx = makeTestApp();
    const shop = await verifiedUser(ctx);
    await ctx.http().post('/api/v1/me/pro').set(shop.auth).send(application(shop));
    const modo = await verifier(ctx);
    await ctx.http().post(`/api/v1/admin/verifications/pro/${shop.id}/decision`).set(modo).send({ decision: 'reject', reason: 'Scan du RC illisible' });
    const status = await ctx.http().get('/api/v1/me/pro').set(shop.auth);
    expect(status.body).toMatchObject({ status: 'rejected', decisionReason: 'Scan du RC illisible' });
    expect((await ctx.http().post('/api/v1/me/pro').set(shop.auth).send(application(shop))).body.pro.status).toBe('pending');
    expect((await ctx.http().get('/api/v1/parcels/export').set(shop.auth)).status).toBe(404);
    expect((await ctx.http().get('/api/v1/me/parcels/export').set(shop.auth)).status).toBe(403);
  });

  it('garde approved pendant l’examen d’un changement de raison sociale, et la révocation retire le badge', async () => {
    const ctx = makeTestApp();
    const shop = await verifiedUser(ctx);
    await ctx.http().post('/api/v1/me/pro').set(shop.auth).send(application(shop));
    const modo = await verifier(ctx);
    await ctx.http().post(`/api/v1/admin/verifications/pro/${shop.id}/decision`).set(modo).send({ decision: 'approve' });
    const change = await ctx.http().post('/api/v1/me/pro').set(shop.auth).send(application(shop, { companyName: 'Nouveau Nom SARL' }));
    expect(change.body).toMatchObject({ accountType: 'professional', pro: { status: 'approved', companyName: 'Boutique Blida SARL' } });
    expect((await ctx.http().get('/api/v1/me/pro').set(shop.auth)).body.underReview).toBe(true);
    await ctx.http().post(`/api/v1/admin/verifications/pro/${shop.id}/decision`).set(modo).send({ decision: 'approve' });
    expect((await ctx.http().get('/api/v1/me').set(shop.auth)).body.pro.companyName).toBe('Nouveau Nom SARL');

    const revoke = await ctx.http().post(`/api/v1/admin/verifications/pro/${shop.id}/revoke`).set(modo).send({ reason: 'RC radié' });
    expect(revoke.status).toBe(204);
    const me = await ctx.http().get('/api/v1/me').set(shop.auth);
    expect(me.body).toMatchObject({ accountType: 'individual', badges: { pro: false }, pro: { status: 'revoked' } });
    expect((await ctx.http().get(`/api/v1/users/${shop.id}`)).body).toMatchObject({ accountType: 'individual', company: null });
    expect(await NotificationModel.countDocuments({ recipient: shop.id, type: 'pro_revoked' })).toBe(1);
  });
});
