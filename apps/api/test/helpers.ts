import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from '@ucolis/shared';
import { createApp } from '../src/app';
import type { Deps } from '../src/deps';
import { EventBus } from '../src/events/bus';
import { createMemoryCache } from '../src/lib/cache';
import { createMemoryFileStore } from '../src/lib/files';
import { createLocalGeocoder } from '../src/lib/geocoder';
import { createMemoryMailer } from '../src/lib/mailer';
import { createMemoryPushSender } from '../src/lib/push';
import { limiterFactory } from '../src/lib/rateLimit';
import { createMemoryRealtime } from '../src/lib/realtime';
import { createServices } from '../src/services';

/** Connecte mongoose à une base dédiée au fichier de test et la vide avant chaque test. */
export function useDatabase() {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `t_${randomUUID().slice(0, 8)}` });
    await mongoose.connection.syncIndexes();
  });
  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

/** Horloge contrôlable par les tests. */
export function makeClock(start = new Date()) {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
    set: (d: Date) => {
      current = d.getTime();
    },
  };
}

export function makeDeps(
  overrides: Omit<Partial<Deps>, 'settings'> & { settings?: Partial<AppSettings> } = {},
) {
  const clock = makeClock();
  const mailer = createMemoryMailer();
  const realtime = createMemoryRealtime();
  const push = createMemoryPushSender();
  const files = createMemoryFileStore();
  const { settings, ...rest } = overrides;
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  const deps: Deps = {
    config: {
      nodeEnv: 'test',
      accessSecret: 'a'.repeat(40),
      refreshSecret: 'r'.repeat(40),
      staffSecret: 's'.repeat(40),
      deliveryCodeKey: Buffer.alloc(32, 7),
      cloudinary: { cloudName: 'demo', apiKey: 'key', apiSecret: 'secret' },
      googleMapsApiKey: '',
      expoAccessToken: '',
      adminUrl: 'http://localhost:5173',
      corsOrigins: ['http://localhost:5173'],
      bcryptCost: 4,
    },
    logger: pino({ level: 'silent' }),
    mailer,
    geocoder: createLocalGeocoder(),
    cache: createMemoryCache(() => clock.now().getTime()),
    limiters: limiterFactory(null),
    bus: new EventBus(),
    realtime,
    push,
    files,
    settings: { getAll: async () => merged },
    health: { mongo: async () => true, redis: async () => true },
    now: clock.now,
    ...rest,
  };
  return { deps, clock, mailer, realtime, push, files };
}

export function makeTestApp(overrides: Parameters<typeof makeDeps>[0] = {}) {
  const ctx = makeDeps(overrides);
  const services = createServices(ctx.deps);
  const app = createApp(ctx.deps, services);
  return { ...ctx, services, app, http: () => request(app) };
}

let counter = 0;
/** Données d'inscription valides et uniques. */
export function registration(patch: Record<string, unknown> = {}) {
  counter += 1;
  const n = String(counter).padStart(8, '0');
  return {
    firstName: 'Amina',
    lastName: 'Benali',
    email: `user${counter}-${randomUUID().slice(0, 6)}@test.dz`,
    phone: `05${n}`,
    password: 'secret123',
    passwordConfirm: 'secret123',
    place: { wilayaCode: '16', commune: '16001' },
    intent: 'both',
    acceptTerms: true,
    termsVersion: DEFAULT_SETTINGS.termsVersion,
    deviceId: `device-${counter}-xyz`,
    platform: 'android',
    ...patch,
  };
}

export const otpFromMail = (text: string) => /(\d{6})/.exec(text)?.[1] ?? '';

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
