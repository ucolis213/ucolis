import { afterEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { createMemoryCache, createRedisCache } from '../src/lib/cache';
import { createCloudinaryFileStore } from '../src/lib/files';
import { createGoogleGeocoder, createLocalGeocoder } from '../src/lib/geocoder';
import { createBrevoMailer, createLogMailer } from '../src/lib/mailer';
import { createLogger } from '../src/lib/logger';
import { toCsv } from '../src/lib/csv';
import { decrypt, encrypt } from '../src/lib/crypto';
import { base32Decode, base32Encode, totpAt, verifyTotp } from '../src/lib/totp';

const sendPushNotificationsAsync = vi.fn();
vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken = (t: string) => t.startsWith('ExponentPushToken');
    chunkPushNotifications = (m: unknown[]) => [m];
    sendPushNotificationsAsync = sendPushNotificationsAsync;
  }
  return { Expo };
});
vi.mock('../src/modules/push/model', () => ({ PushTokenModel: { deleteMany: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

describe('emails', () => {
  it('envoie par Brevo et signale une erreur', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse({ code: 'bad' }, false, 400));
    vi.stubGlobal('fetch', fetchMock);
    const mailer = createBrevoMailer('key');
    await mailer.send({ to: 'a@b.dz', subject: 'S', text: 'T' });
    expect(fetchMock.mock.calls[0]![1].headers['api-key']).toBe('key');
    await expect(mailer.send({ to: 'a@b.dz', subject: 'S', text: 'T' })).rejects.toThrow('Brevo 400');
  });

  it('journalise les emails en développement', async () => {
    const logger = pino({ level: 'silent' });
    const info = vi.spyOn(logger, 'info');
    await createLogMailer(logger).send({ to: 'a@b.dz', subject: 'S', text: 'T' });
    expect(info).toHaveBeenCalled();
    expect(createLogger('silent')).toBeTruthy();
  });
});

describe('géocodage Google', () => {
  it('met en cache le géocodage inverse et la recherche', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ status: 'OK', results: [{ formatted_address: 'Rue X, Sétif', geometry: { location: { lat: 36.19, lng: 5.41 } } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const geo = createGoogleGeocoder('k', createMemoryCache());
    const a = await geo.reverse({ lat: 36.19, lng: 5.41 }, 'fr');
    await geo.reverse({ lat: 36.19, lng: 5.41 }, 'fr');
    expect(a).toMatchObject({ address: 'Rue X, Sétif', wilayaCode: '19' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const results = await geo.search('Sétif', 'fr');
    await geo.search('Setif ', 'fr');
    expect(results[0]!.wilayaCode).toBe('19');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('se replie sur le référentiel local sans résultat et signale les erreurs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ status: 'ZERO_RESULTS', results: [] })).mockResolvedValueOnce(jsonResponse({ status: 'REQUEST_DENIED', results: [] })));
    const geo = createGoogleGeocoder('k', createMemoryCache());
    expect((await geo.reverse({ lat: 35.7, lng: -0.63 }, 'ar')).wilayaCode).toBe('31');
    await expect(geo.search('Oran', 'fr')).rejects.toThrow('REQUEST_DENIED');
    expect(await createLocalGeocoder().search('x', 'fr')).toEqual([]);
    expect((await createLocalGeocoder().search('وهران', 'ar')).length).toBeGreaterThan(0);
  });
});

describe('Cloudinary, cache Redis et push', () => {
  it('supprime les fichiers par API signée', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    await createCloudinaryFileStore({ cloudName: 'c', apiKey: 'k', apiSecret: 's' }).destroy(
      [{ url: 'u', publicId: 'ucolis/identity_doc/u/a', kind: 'pdf' }],
      'authenticated',
    );
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.cloudinary.com/v1_1/c/raw/destroy');
    expect(String(fetchMock.mock.calls[0]![1].body)).toContain('signature=');
  });

  it('lit et écrit le cache Redis en JSON avec expiration', async () => {
    const store = new Map<string, string>();
    const redis = {
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string, mode: string, ttl: number) => {
        expect([mode, ttl]).toEqual(['EX', 60]);
        store.set(k, v);
      },
      del: async (k: string) => store.delete(k),
    };
    const cache = createRedisCache(redis as never);
    await cache.set('a', { x: 1 }, 60);
    expect(await cache.get('a')).toEqual({ x: 1 });
    await cache.del('a');
    expect(await cache.get('a')).toBeNull();
    const mem = createMemoryCache(() => 0);
    await mem.set('b', 1, 1);
    await mem.del('b');
    expect(await mem.get('b')).toBeNull();
  });

  it('envoie les push Expo et supprime les jetons invalides', async () => {
    const { createExpoPushSender } = await import('../src/lib/push');
    const { PushTokenModel } = await import('../src/modules/push/model');
    sendPushNotificationsAsync.mockResolvedValueOnce([
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);
    const sender = createExpoPushSender('', pino({ level: 'silent' }));
    await sender.send([
      { to: 'ExponentPushToken[a]', title: 'T', body: 'B', data: {}, group: 'conv' },
      { to: 'ExponentPushToken[b]', title: 'T', body: 'B', data: {} },
      { to: 'pas-un-jeton', title: 'T', body: 'B', data: {} },
    ]);
    expect(PushTokenModel.deleteMany).toHaveBeenCalledWith({ token: { $in: ['pas-un-jeton'] } });
    expect(PushTokenModel.deleteMany).toHaveBeenCalledWith({ token: { $in: ['ExponentPushToken[b]'] } });
    sendPushNotificationsAsync.mockRejectedValueOnce(new Error('réseau'));
    await expect(sender.send([{ to: 'ExponentPushToken[c]', title: 'T', body: 'B', data: {} }])).resolves.toBeUndefined();
  });
});

describe('utilitaires', () => {
  it('chiffre, encode en base32 et calcule la TOTP du RFC 6238', () => {
    const key = Buffer.alloc(32, 1);
    expect(decrypt(key, encrypt(key, 'secret'))).toBe('secret');
    expect(() => decrypt(key, 'abc')).toThrow();
    expect(base32Decode(base32Encode(Buffer.from('12345678901234567890'))).toString()).toBe('12345678901234567890');
    // Vecteur de test du RFC 6238 (SHA-1, T = 59 s) : 94287082 → 6 derniers chiffres.
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(totpAt(secret, 59_000)).toBe('287082');
    expect(verifyTotp(secret, '287082', 59_000 + 30_000)).toBe(true);
    expect(verifyTotp(secret, 'abc', 59_000)).toBe(false);
    expect(() => base32Decode('1!')).toThrow();
  });

  it('neutralise les formules dans les exports CSV', () => {
    expect(toCsv(['a', 'b'], [{ a: '=SUM(A1)', b: 'x;y' }])).toBe('a;b\r\n\'=SUM(A1);"x;y"');
  });
});
