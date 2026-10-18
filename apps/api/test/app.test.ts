import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@ucolis/shared';
import { makeTestApp } from './helpers';

describe('GET /api/v1/health', () => {
  it('répond 200 quand MongoDB et Redis sont joignables', async () => {
    const res = await makeTestApp().http().get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', mongo: 'up', redis: 'up' });
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('répond 503 si une dépendance est indisponible', async () => {
    const { http } = makeTestApp({ health: { mongo: async () => true, redis: async () => false } });
    const res = await http().get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', redis: 'down' });
  });

  it("reprend l'identifiant de requête fourni", async () => {
    const res = await makeTestApp().http().get('/api/v1/health').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('GET /api/v1/app/config', () => {
  it('renvoie uniquement les réglages publics', async () => {
    const { http } = makeTestApp({
      settings: {
        minAppVersion: '1.4.0',
        maintenance: { enabled: true, message: { fr: 'Pause', ar: 'توقف' } },
      },
    });
    const res = await http().get('/api/v1/app/config');
    expect(res.status).toBe(200);
    expect(res.body.minAppVersion).toBe('1.4.0');
    expect(res.body.maintenance.enabled).toBe(true);
    expect(res.body.termsVersion).toBe(DEFAULT_SETTINGS.termsVersion);
    expect(res.body).not.toHaveProperty('reviewWindowDays');
  });
});

describe('POST /api/v1/pricing/suggest', () => {
  const body = {
    pickup: { lat: 36.77123, lng: 3.06122 },
    dropoff: { lat: 35.69874, lng: -0.63493 },
    weightKg: 5,
    dimensionsCm: { length: 40, width: 30, height: 30 },
  };

  it('calcule la distance et le prix à partir des points', async () => {
    const res = await makeTestApp().http().post('/api/v1/pricing/suggest').send(body);
    expect(res.status).toBe(200);
    expect(res.body.volumeM3).toBe(0.036);
    expect(res.body.distanceKm).toBeGreaterThan(340);
    expect(res.body.suggestedPrice % 50).toBe(0);
    expect(res.body.suggestedPrice).toBeGreaterThanOrEqual(3150);
    expect(res.body.suggestedPrice).toBeLessThanOrEqual(3350);
  });

  it('ignore une distance envoyée par le client', async () => {
    const { http } = makeTestApp();
    const a = await http().post('/api/v1/pricing/suggest').send(body);
    const b = await http()
      .post('/api/v1/pricing/suggest')
      .send({ ...body, distanceKm: 1 });
    expect(b.body.suggestedPrice).toBe(a.body.suggestedPrice);
  });

  it('utilise le barème des réglages', async () => {
    const { http } = makeTestApp({
      settings: { pricing: { ...DEFAULT_SETTINGS.pricing, baseFee: 10_000 } },
    });
    const res = await http().post('/api/v1/pricing/suggest').send(body);
    expect(res.body.suggestedPrice).toBeGreaterThan(12_000);
  });

  it('renvoie 400 VALIDATION_ERROR avec le détail des champs', async () => {
    const res = await makeTestApp()
      .http()
      .post('/api/v1/pricing/suggest')
      .send({ ...body, weightKg: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields[0]).toMatchObject({
      path: 'weightKg',
      message: 'validation.weight',
    });
  });
});

describe('protections transverses', () => {
  it('refuse les opérateurs MongoDB dans le corps', async () => {
    const res = await makeTestApp()
      .http()
      .post('/api/v1/pricing/suggest')
      .send({ weightKg: { $gt: 0 } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un JSON illisible', async () => {
    const res = await makeTestApp()
      .http()
      .post('/api/v1/pricing/suggest')
      .set('content-type', 'application/json')
      .send('{"oops"');
    expect(res.status).toBe(400);
  });

  it('refuse un corps de plus de 1 Mo', async () => {
    const res = await makeTestApp()
      .http()
      .post('/api/v1/pricing/suggest')
      .send({ pad: 'x'.repeat(1_100_000) });
    expect(res.status).toBe(413);
  });

  it('renvoie 404 NOT_FOUND au format standard', async () => {
    const res = await makeTestApp().http().get('/api/v1/inconnue');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route introuvable' } });
  });

  it('masque les erreurs internes', async () => {
    const broken = makeTestApp();
    broken.deps.settings.getAll = async () => Promise.reject(new Error('boom'));
    const res = await broken.http().get('/api/v1/app/config');
    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Erreur interne' });
  });

  it("n'autorise CORS que pour les origines configurées", async () => {
    const { http } = makeTestApp();
    const ok = await http().get('/api/v1/health').set('origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const ko = await http().get('/api/v1/health').set('origin', 'https://evil.example');
    expect(ko.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('limite les routes publiques à 60 requêtes par IP sur 15 min', async () => {
    const { http } = makeTestApp();
    for (let i = 0; i < 60; i++) await http().get('/api/v1/app/config');
    const res = await http().get('/api/v1/app/config');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('documentation OpenAPI', () => {
  it('liste les routes et leurs schémas en développement', async () => {
    const res = await makeTestApp().http().get('/api/v1/docs');
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/api/v1/parcels'].post.requestBody).toBeTruthy();
    expect(res.body.paths['/api/v1/parcels/{id}/offers'].post).toBeTruthy();
    expect(res.body.paths['/api/v1/admin/users'].get.parameters.map((p: { name: string }) => p.name)).toContain('q');
  });
});
