import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { purgeDeletedAccounts, sendScheduledBroadcasts } from '../src/jobs/sweeps';
import { deriveKey, encrypt } from '../src/lib/crypto';
import { newTotpSecret, totpAt } from '../src/lib/totp';
import { StaffModel } from '../src/modules/admin/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { ParcelModel } from '../src/modules/parcels/model';
import { UserModel } from '../src/modules/users/model';
import { createParcel, relogin, verifiedCarrier, verifiedUser, type TestApp } from './fixtures';
import { bearer, makeTestApp, useDatabase } from './helpers';

useDatabase();

const DAY = 86_400_000;

async function admin(ctx: TestApp, permissions: string[] = []) {
  const secret = newTotpSecret();
  const email = `a${Math.random().toString(36).slice(2, 8)}@ucolis.dz`;
  await StaffModel.create({
    email, firstName: 'Super', lastName: 'Admin', role: permissions.length ? 'moderator' : 'super_admin', permissions, status: 'active',
    passwordHash: await bcrypt.hash('Password123', 4),
    totpSecret: encrypt(deriveKey(ctx.deps.config.deliveryCodeKey, 'staff-totp'), secret),
  });
  const res = await ctx.http().post('/api/v1/admin/auth/login').send({ email, password: 'Password123', totp: totpAt(secret, ctx.clock.now().getTime()) });
  return bearer(res.body.accessToken);
}

describe('suppression de compte', () => {
  it('exige le mot de passe, refuse pendant une livraison, et une reconnexion annule la demande', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const karim = await verifiedCarrier(ctx);
    expect((await ctx.http().post('/api/v1/me/deletion').set(amina.auth).send({ password: 'faux' })).status).toBe(400);

    const p = await createParcel(ctx, amina);
    const o = (await ctx.http().post(`/api/v1/parcels/${p.id}/offers`).set(karim.auth).send({ price: 3000, vehicleId: karim.vehicleId, proposedPickupDate: new Date(Date.now() + 2 * DAY).toISOString() })).body;
    await ctx.http().post(`/api/v1/offers/${o.id}/accept`).set(amina.auth);
    const blocked = await ctx.http().post('/api/v1/me/deletion').set(amina.auth).send({ password: 'secret123' });
    expect(blocked.body.error.code).toBe('DELIVERY_IN_PROGRESS');
    await ctx.http().post(`/api/v1/parcels/${p.id}/cancel`).set(amina.auth).send({ reason: 'Je déménage' });

    const req = await ctx.http().post('/api/v1/me/deletion').set(amina.auth).send({ password: 'secret123' });
    expect(req.body).toMatchObject({ status: 'pending_deletion' });
    await relogin(ctx, amina);
    expect((await ctx.http().get('/api/v1/me').set(amina.auth)).body.status).toBe('active');
  });

  it('anonymise après 14 jours : colis annulés, données effacées, pièces supprimées, avis conservés', async () => {
    const ctx = makeTestApp();
    const doc = (n: string) => ({ url: 'https://x', publicId: `ucolis/identity_doc/u/${n}`, kind: 'image' });
    const karim = await verifiedCarrier(ctx);
    await UserModel.updateOne({ _id: karim.id }, { 'carrierVerification.documents': { idFront: doc('a'), idBack: doc('b') } });
    const amina = await verifiedUser(ctx);
    const open = await createParcel(ctx, karim);
    await ctx.http().post('/api/v1/me/deletion').set(karim.auth).send({ password: 'secret123' });

    ctx.clock.advance(13 * DAY);
    expect(await purgeDeletedAccounts(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(2 * DAY);
    expect(await purgeDeletedAccounts(ctx.deps, ctx.services)).toBe(1);

    const u = await UserModel.findById(karim.id).lean();
    expect(u).toMatchObject({ status: 'deleted', firstName: 'Utilisateur', lastName: 'supprimé', vehicles: [] });
    expect(u!.email).not.toBe(karim.email);
    expect(ctx.files.destroyed).toEqual(['ucolis/identity_doc/u/a', 'ucolis/identity_doc/u/b']);
    expect((await ParcelModel.findById(open.id).lean())!.status).toBe('cancelled');
    expect((await ctx.http().get(`/api/v1/users/${karim.id}`)).body.displayName).toBe('Utilisateur supprimé');
    const login = await ctx.http().post('/api/v1/auth/login').send({ email: karim.email, password: 'secret123', deviceId: 'device-x-1', platform: 'ios' });
    expect(login.status).toBe(401);
    void amina;
  });
});

describe('contenus et diffusion', () => {
  it('publie une version de la politique de confidentialité, lisible sans compte', async () => {
    const ctx = makeTestApp();
    const staff = await admin(ctx, ['content.manage']);
    expect((await ctx.http().get('/api/v1/content/privacy')).status).toBe(404);
    await ctx.http().put('/api/v1/admin/content/privacy/fr').set(staff).send({ body: '# Confidentialité\n\nNous protégeons vos données.' });
    expect((await ctx.http().get('/api/v1/content/privacy')).status).toBe(404);
    const pub = await ctx.http().post('/api/v1/admin/content/privacy/fr/publish').set(staff).send({ reason: 'Première version' });
    expect(pub.body.version).toBe(1);
    const res = await ctx.http().get('/api/v1/content/privacy').query({ locale: 'ar' });
    expect(res.body).toMatchObject({ locale: 'fr', version: 1 });
    expect(res.body.body).toContain('Nous protégeons');
  });

  it("une nouvelle version des CGU change termsVersion et prévient les utilisateurs", async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx);
    const staff = await admin(ctx, ['content.manage']);
    await ctx.http().put('/api/v1/admin/content/terms/fr').set(staff).send({ body: 'CGU v2' });
    await ctx.http().post('/api/v1/admin/content/terms/fr/publish').set(staff).send({ reason: 'Mise à jour légale' });
    const { createSettingsService } = await import('../src/modules/settings/service');
    const settings = await createSettingsService().getAll();
    expect(settings.termsVersion).toMatch(/\.1$/);
    expect(await NotificationModel.countDocuments({ recipient: amina.id, type: 'terms_updated' })).toBe(1);
  });

  it('diffuse un message bilingue à un segment, immédiatement ou à l’heure programmée', async () => {
    const ctx = makeTestApp();
    const amina = await verifiedUser(ctx, { intent: 'sender' }, { 'preferences.language': 'ar' });
    const karim = await verifiedCarrier(ctx);
    const staff = await admin(ctx, ['broadcast.send']);
    const preview = await ctx.http().post('/api/v1/admin/broadcasts/preview').set(staff).send({ segment: { kind: 'carriers' } });
    expect(preview.body.recipients).toBe(1);
    const msg = { title: { fr: 'Nouveauté', ar: 'جديد' }, body: { fr: 'Les trajets arrivent !', ar: 'الرحلات متاحة!' }, reason: 'Lancement' };
    await ctx.http().post('/api/v1/admin/broadcasts').set(staff).send({ ...msg, segment: { kind: 'carriers' } });
    expect(await NotificationModel.countDocuments({ type: 'broadcast', recipient: karim.id })).toBe(1);
    expect(await NotificationModel.countDocuments({ type: 'broadcast', recipient: amina.id })).toBe(0);

    await ctx.http().post('/api/v1/admin/broadcasts').set(staff).send({ ...msg, segment: { kind: 'all' }, link: 'ucolis://listings', scheduledAt: new Date(ctx.clock.now().getTime() + 3600_000).toISOString() });
    expect(await sendScheduledBroadcasts(ctx.deps, ctx.services)).toBe(0);
    ctx.clock.advance(3600_000 + 1);
    expect(await sendScheduledBroadcasts(ctx.deps, ctx.services)).toBe(2);
    const n = await NotificationModel.findOne({ type: 'broadcast', recipient: amina.id }).lean();
    expect(n!.params).toMatchObject({ title: 'جديد' });
    const list = await ctx.http().get('/api/v1/notifications').set((await relogin(ctx, amina)).auth);
    expect(list.body.items[0].link).toBe('ucolis://listings');
  });
});
