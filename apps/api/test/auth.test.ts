import { describe, expect, it } from 'vitest';
import { UserModel } from '../src/modules/users/model';
import { bearer, makeTestApp, otpFromMail, registration, useDatabase } from './helpers';

useDatabase();

async function registerUser(ctx: ReturnType<typeof makeTestApp>, patch = {}) {
  const body = registration(patch);
  const res = await ctx.http().post('/api/v1/auth/register').send(body);
  expect(res.status).toBe(201);
  return { body, res };
}

describe('inscription', () => {
  it('crée un compte particulier, ouvre une session et envoie un code', async () => {
    const ctx = makeTestApp();
    const { body, res } = await registerUser(ctx);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user).toMatchObject({
      email: body.email,
      phone: '+213' + body.phone.slice(1),
      accountType: 'individual',
      emailVerified: false,
      pro: { status: 'none' },
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(otpFromMail(ctx.mailer.last(body.email)!.text)).toMatch(/^\d{6}$/);
  });

  it('ignore une tentative de se déclarer professionnel', async () => {
    const ctx = makeTestApp();
    const { res } = await registerUser(ctx, { accountType: 'professional', pro: { status: 'approved' } });
    expect(res.body.user.accountType).toBe('individual');
    expect(res.body.user.pro.status).toBe('none');
  });

  it('refuse un email ou un téléphone déjà utilisé', async () => {
    const ctx = makeTestApp();
    const { body } = await registerUser(ctx);
    const sameEmail = await ctx.http().post('/api/v1/auth/register').send(registration({ email: body.email }));
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.code).toBe('EMAIL_TAKEN');
    const samePhone = await ctx.http().post('/api/v1/auth/register').send(registration({ phone: body.phone }));
    expect(samePhone.body.error.code).toBe('PHONE_TAKEN');
  });

  it('valide les champs', async () => {
    const res = await makeTestApp()
      .http()
      .post('/api/v1/auth/register')
      .send(registration({ phone: '0412345678', password: 'abc' }));
    expect(res.status).toBe(400);
    const messages = res.body.error.details.fields.map((f: { message: string }) => f.message);
    expect(messages).toEqual(expect.arrayContaining(['validation.phone', 'validation.passwordRules']));
  });
});

describe("vérification de l'email", () => {
  it('valide le bon code', async () => {
    const ctx = makeTestApp();
    const { body } = await registerUser(ctx);
    const code = otpFromMail(ctx.mailer.last(body.email)!.text);
    const res = await ctx.http().post('/api/v1/auth/verify-email').send({ email: body.email, code });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('bloque après 5 essais et refuse un code expiré', async () => {
    const ctx = makeTestApp();
    const { body } = await registerUser(ctx);
    const code = otpFromMail(ctx.mailer.last(body.email)!.text);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      const r = await ctx.http().post('/api/v1/auth/verify-email').send({ email: body.email, code: wrong });
      expect(r.body.error.code).toBe('INVALID_CODE');
    }
    const fifth = await ctx.http().post('/api/v1/auth/verify-email').send({ email: body.email, code: wrong });
    expect(fifth.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    const blocked = await ctx.http().post('/api/v1/auth/verify-email').send({ email: body.email, code });
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');

    ctx.clock.advance(61_000);
    await ctx.http().post('/api/v1/auth/resend-code').send({ email: body.email });
    const fresh = otpFromMail(ctx.mailer.last(body.email)!.text);
    ctx.clock.advance(16 * 60_000);
    const expired = await ctx.http().post('/api/v1/auth/verify-email').send({ email: body.email, code: fresh });
    expect(expired.body.error.code).toBe('CODE_EXPIRED');
  });

  it('impose 60 s entre deux envois et 5 envois par heure', async () => {
    const ctx = makeTestApp();
    const { body } = await registerUser(ctx);
    const tooSoon = await ctx.http().post('/api/v1/auth/resend-code').send({ email: body.email });
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) {
      ctx.clock.advance(61_000);
      expect((await ctx.http().post('/api/v1/auth/resend-code').send({ email: body.email })).status).toBe(204);
    }
    ctx.clock.advance(61_000);
    expect((await ctx.http().post('/api/v1/auth/resend-code').send({ email: body.email })).status).toBe(429);
  });

  it("répond pareil pour un email inconnu", async () => {
    const res = await makeTestApp().http().post('/api/v1/auth/resend-code').send({ email: 'nobody@test.dz' });
    expect(res.status).toBe(204);
  });
});

describe('connexion', () => {
  const login = (ctx: ReturnType<typeof makeTestApp>, email: string, password: string, deviceId = 'device-login-1') =>
    ctx.http().post('/api/v1/auth/login').send({ email, password, deviceId, platform: 'ios' });

  it('connecte avec le bon mot de passe et refuse le mauvais', async () => {
    const ctx = makeTestApp();
    const { body } = await registerUser(ctx);
    expect((await login(ctx, body.email, 'secret123')).status).toBe(200);
    const bad = await login(ctx, body.email, 'wrong-pass1');
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
    expect((await login(ctx, 'inconnu@test.dz', 'secret123')).body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('applique un délai progressif après 5 échecs sur un email', async () => {
    const ctx = makeTestApp();
    const { body } = await registerUser(ctx);
    for (let i = 0; i < 5; i++) await login(ctx, body.email, 'wrong-pass1');
    const blocked = await login(ctx, body.email, 'secret123');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.details.retryAfterSeconds).toBe(30);
    ctx.clock.advance(31_000);
    await login(ctx, body.email, 'wrong-pass1');
    const longer = await login(ctx, body.email, 'secret123');
    expect(longer.body.error.details.retryAfterSeconds).toBe(60);
    ctx.clock.advance(61_000);
    expect((await login(ctx, body.email, 'secret123')).status).toBe(200);
  });

  it('refuse un compte suspendu avec le motif et la date de fin', async () => {
    const ctx = makeTestApp();
    const { body } = await registerUser(ctx);
    const until = new Date(ctx.clock.now().getTime() + 86_400_000);
    await UserModel.updateOne({ email: body.email }, { status: 'suspended', suspension: { reason: 'Fraude', until } });
    const res = await login(ctx, body.email, 'secret123');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'ACCOUNT_SUSPENDED', details: { reason: 'Fraude' } });
    ctx.clock.advance(86_400_001);
    expect((await login(ctx, body.email, 'secret123')).status).toBe(200);
  });
});

describe('jetons', () => {
  it('fait tourner le jeton de rafraîchissement et détecte un rejeu', async () => {
    const ctx = makeTestApp();
    const { body, res } = await registerUser(ctx);
    const first = res.body.refreshToken;
    const rotated = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: first, deviceId: body.deviceId });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    const replay = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: first, deviceId: body.deviceId });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');
    // Toute la famille de l'appareil est révoquée : le jeton légitime ne marche plus non plus.
    const legit = await ctx
      .http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken, deviceId: body.deviceId });
    expect(legit.status).toBe(401);
  });

  it('refuse un jeton présenté par un autre appareil', async () => {
    const ctx = makeTestApp();
    const { res } = await registerUser(ctx);
    const other = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: res.body.refreshToken, deviceId: 'autre-appareil' });
    expect(other.body.error.code).toBe('TOKEN_REUSED');
  });

  it('expire le jeton d’accès après 15 min', async () => {
    const ctx = makeTestApp();
    const { res } = await registerUser(ctx);
    expect((await ctx.http().get('/api/v1/me').set(bearer(res.body.accessToken))).status).toBe(200);
    ctx.clock.advance(15 * 60_000 + 1000);
    expect((await ctx.http().get('/api/v1/me').set(bearer(res.body.accessToken))).status).toBe(401);
    expect((await ctx.http().get('/api/v1/me')).status).toBe(401);
    expect((await ctx.http().get('/api/v1/me').set(bearer('garbage'))).body.error.code).toBe('UNAUTHENTICATED');
  });

  it('éjecte immédiatement un compte suspendu, même avec un jeton valide', async () => {
    const ctx = makeTestApp();
    const { body, res } = await registerUser(ctx);
    await UserModel.updateOne({ email: body.email }, { status: 'suspended', suspension: { reason: 'Abus' } });
    const me = await ctx.http().get('/api/v1/me').set(bearer(res.body.accessToken));
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe('ACCOUNT_SUSPENDED');
    const refresh = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: res.body.refreshToken, deviceId: body.deviceId });
    expect(refresh.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('déconnecte : le jeton de rafraîchissement est révoqué', async () => {
    const ctx = makeTestApp();
    const { body, res } = await registerUser(ctx);
    const out = await ctx.http().post('/api/v1/auth/logout').set(bearer(res.body.accessToken)).send({ deviceId: body.deviceId });
    expect(out.status).toBe(204);
    const refresh = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: res.body.refreshToken, deviceId: body.deviceId });
    expect(refresh.status).toBe(401);
  });
});

describe('mot de passe oublié', () => {
  it('répond pareil que le compte existe ou non, puis réinitialise et révoque les sessions', async () => {
    const ctx = makeTestApp();
    const { body, res } = await registerUser(ctx);
    expect((await ctx.http().post('/api/v1/auth/forgot-password').send({ email: 'nobody@test.dz' })).status).toBe(204);
    expect((await ctx.http().post('/api/v1/auth/forgot-password').send({ email: body.email })).status).toBe(204);
    const code = otpFromMail(ctx.mailer.last(body.email)!.text);

    const reset = await ctx
      .http()
      .post('/api/v1/auth/reset-password')
      .send({ email: body.email, code, password: 'nouveau456', passwordConfirm: 'nouveau456' });
    expect(reset.status).toBe(204);
    const refresh = await ctx.http().post('/api/v1/auth/refresh').send({ refreshToken: res.body.refreshToken, deviceId: body.deviceId });
    expect(refresh.status).toBe(401);
    const login = await ctx.http().post('/api/v1/auth/login').send({ email: body.email, password: 'nouveau456', deviceId: 'device-new-1', platform: 'android' });
    expect(login.status).toBe(200);
  });
});
