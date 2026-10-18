import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { bearer, makeTestApp, otpFromMail, registration, useDatabase } from './helpers';

useDatabase();

async function signedUp(ctx: ReturnType<typeof makeTestApp>, patch = {}) {
  const body = registration(patch);
  const res = await ctx.http().post('/api/v1/auth/register').send(body);
  return { body, token: res.body.accessToken as string, user: res.body.user, refresh: res.body.refreshToken };
}

describe('profil', () => {
  it('modifie le profil et vérifie l’unicité du téléphone', async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const b = await signedUp(ctx);
    const res = await ctx
      .http()
      .patch('/api/v1/me')
      .set(bearer(a.token))
      .send({ bio: 'Je fais Sétif – Alger', place: { wilayaCode: '19', commune: '19001' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ bio: 'Je fais Sétif – Alger', wilayaCode: '19' });
    const taken = await ctx.http().patch('/api/v1/me').set(bearer(a.token)).send({ phone: b.body.phone });
    expect(taken.body.error.code).toBe('PHONE_TAKEN');
  });

  it('ignore toute tentative d’écrire accountType ou pro.status', async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const res = await ctx
      .http()
      .patch('/api/v1/me')
      .set(bearer(a.token))
      .send({ accountType: 'professional', pro: { status: 'approved' }, bio: 'x' });
    expect(res.body.accountType).toBe('individual');
    expect(res.body.pro.status).toBe('none');
  });

  it("n'accepte qu'un avatar du dossier de l'utilisateur", async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const own = { url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', publicId: `ucolis/avatar/${a.user.id}/a`, kind: 'image' };
    expect((await ctx.http().put('/api/v1/me/avatar').set(bearer(a.token)).send({ avatar: own })).status).toBe(200);
    const foreign = { ...own, publicId: 'ucolis/avatar/someone-else/a' };
    expect((await ctx.http().put('/api/v1/me/avatar').set(bearer(a.token)).send({ avatar: foreign })).status).toBe(400);
  });

  it('change le mot de passe en révoquant les autres sessions', async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const other = await ctx.http().post('/api/v1/auth/login').send({ email: a.body.email, password: 'secret123', deviceId: 'second-device', platform: 'ios' });
    const wrong = await ctx
      .http()
      .put('/api/v1/me/password')
      .set(bearer(a.token))
      .send({ currentPassword: 'nope', password: 'nouveau456', passwordConfirm: 'nouveau456' });
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const ok = await ctx
      .http()
      .put('/api/v1/me/password')
      .set({ ...bearer(a.token), 'x-device-id': a.body.deviceId })
      .send({ currentPassword: 'secret123', password: 'nouveau456', passwordConfirm: 'nouveau456' });
    expect(ok.status).toBe(204);
    const otherRefresh = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: other.body.refreshToken, deviceId: 'second-device' });
    expect(otherRefresh.status).toBe(401);
    const mine = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: a.refresh, deviceId: a.body.deviceId });
    expect(mine.status).toBe(200);
  });

  it("change l'email après confirmation du code envoyé à la nouvelle adresse", async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const b = await signedUp(ctx);
    expect((await ctx.http().post('/api/v1/me/email-change').set(bearer(a.token)).send({ email: b.body.email })).body.error.code).toBe('EMAIL_TAKEN');
    await ctx.http().post('/api/v1/me/email-change').set(bearer(a.token)).send({ email: 'nouvelle@test.dz' });
    expect((await ctx.http().get('/api/v1/me').set(bearer(a.token))).body.email).toBe(a.body.email);
    const code = otpFromMail(ctx.mailer.last('nouvelle@test.dz')!.text);
    const res = await ctx.http().post('/api/v1/me/email-change/confirm').set(bearer(a.token)).send({ code });
    expect(res.body).toMatchObject({ email: 'nouvelle@test.dz', emailVerified: true });
  });

  it('enregistre les préférences sans désactiver la catégorie Compte', async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const res = await ctx
      .http()
      .patch('/api/v1/me/preferences')
      .set(bearer(a.token))
      .send({ language: 'ar', notifications: { offers: false, account: false } });
    expect(res.body.preferences).toEqual({ language: 'ar', notifications: { offers: false, account: true } });
  });

  it('accepte une nouvelle version des CGU', async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const res = await ctx.http().post('/api/v1/me/terms/accept').set(bearer(a.token)).send({ version: '2027-01-01' });
    expect(res.body.terms.version).toBe('2027-01-01');
  });
});

describe('appareils connectés', () => {
  it('liste les sessions et déconnecte un appareil', async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const other = await ctx.http().post('/api/v1/auth/login').send({ email: a.body.email, password: 'secret123', deviceId: 'tablet-device', deviceName: 'Tablette', platform: 'ios' });
    const list = await ctx.http().get('/api/v1/me/sessions').set({ ...bearer(a.token), 'x-device-id': a.body.deviceId });
    expect(list.body.items).toHaveLength(2);
    const tablet = list.body.items.find((s: { deviceName: string }) => s.deviceName === 'Tablette');
    expect(list.body.items.find((s: { current: boolean }) => s.current)).toBeTruthy();
    expect((await ctx.http().delete(`/api/v1/me/sessions/${tablet.id}`).set(bearer(a.token))).status).toBe(204);
    const refresh = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: other.body.refreshToken, deviceId: 'tablet-device' });
    expect(refresh.status).toBe(401);
  });
});

describe('blocage', () => {
  it('bloque et débloque un utilisateur', async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const b = await signedUp(ctx, { firstName: 'Karim' });
    expect((await ctx.http().post(`/api/v1/me/blocked/${a.user.id}`).set(bearer(a.token))).status).toBe(400);
    await ctx.http().post(`/api/v1/me/blocked/${b.user.id}`).set(bearer(a.token));
    const list = await ctx.http().get('/api/v1/me/blocked').set(bearer(a.token));
    expect(list.body.items).toEqual([expect.objectContaining({ id: b.user.id, displayName: 'Karim B.' })]);
    await ctx.http().delete(`/api/v1/me/blocked/${b.user.id}`).set(bearer(a.token));
    expect((await ctx.http().get('/api/v1/me/blocked').set(bearer(a.token))).body.items).toEqual([]);
  });
});

describe('uploads signés', () => {
  it("signe un upload limité au dossier de l'utilisateur et au type d'accès", async () => {
    const ctx = makeTestApp();
    const a = await signedUp(ctx);
    const res = await ctx.http().post('/api/v1/uploads/signature').set(bearer(a.token)).send({ purpose: 'identity_doc' });
    expect(res.status).toBe(200);
    expect(res.body.params).toMatchObject({ folder: `ucolis/identity_doc/${a.user.id}`, type: 'authenticated' });
    expect(res.body.params.allowed_formats).toContain('pdf');
    const base = Object.keys(res.body.params)
      .sort()
      .map((k) => `${k}=${res.body.params[k]}`)
      .join('&');
    expect(res.body.signature).toBe(createHash('sha1').update(`${base}secret`).digest('hex'));

    const photo = await ctx.http().post('/api/v1/uploads/signature').set(bearer(a.token)).send({ purpose: 'parcel_photo' });
    expect(photo.body.params.type).toBe('upload');
    expect((await ctx.http().post('/api/v1/uploads/signature').send({ purpose: 'avatar' })).status).toBe(401);
  });
});
