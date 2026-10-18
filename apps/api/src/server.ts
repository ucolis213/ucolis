import { createServer } from 'node:http';
import * as Sentry from '@sentry/node';
import { createApp } from './app';
import { loadEnv, type Env } from './config/env';
import { connectMongo, disconnectMongo, pingMongo } from './db/mongo';
import { createRedis, pingRedis } from './db/redis';
import type { Deps } from './deps';
import { EventBus } from './events/bus';
import { createRedisCache } from './lib/cache';
import { createCloudinaryFileStore } from './lib/files';
import { createGoogleGeocoder, createLocalGeocoder } from './lib/geocoder';
import { createLogger } from './lib/logger';
import { createBrevoMailer, createLogMailer } from './lib/mailer';
import { limiterFactory } from './lib/rateLimit';
import { createSettingsService } from './modules/settings/service';
import { createExpoPushSender } from './lib/push';
import { attachSocketServer, createDeferredRealtime, socketRealtime } from './realtime/socket';
import { startJobs } from './jobs';
import { createServices } from './services';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';

export function buildDeps(env: Env, redis: Redis, logger: Logger): Deps {
  const cache = createRedisCache(redis);
  return {
    config: {
      nodeEnv: env.NODE_ENV,
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      staffSecret: env.STAFF_JWT_SECRET,
      deliveryCodeKey: Buffer.from(env.DELIVERY_CODE_KEY, 'hex'),
      cloudinary: {
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        apiSecret: env.CLOUDINARY_API_SECRET,
      },
      googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
      expoAccessToken: env.EXPO_ACCESS_TOKEN,
      adminUrl: env.ADMIN_URL,
      corsOrigins: env.CORS_ORIGINS,
      bcryptCost: 12,
    },
    logger,
    mailer: env.BREVO_API_KEY ? createBrevoMailer(env.BREVO_API_KEY) : createLogMailer(logger),
    cache,
    geocoder: env.GOOGLE_MAPS_API_KEY
      ? createGoogleGeocoder(env.GOOGLE_MAPS_API_KEY, cache)
      : createLocalGeocoder(),
    limiters: limiterFactory(redis),
    bus: new EventBus(logger),
    realtime: createDeferredRealtime(),
    push: createExpoPushSender(env.EXPO_ACCESS_TOKEN, logger),
    files: createCloudinaryFileStore({
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    }),
    settings: createSettingsService(),
    health: { mongo: pingMongo, redis: () => pingRedis(redis) },
    now: () => new Date(),
  };
}

async function main() {
  const env = loadEnv();
  if (env.SENTRY_DSN) Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0.1 });
  const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');

  await connectMongo(env.MONGODB_URI);
  const redis = createRedis(env.REDIS_URL);
  await redis.connect();

  const deps = buildDeps(env, redis, logger);
  const services = createServices(deps);
  const app = createApp(deps, services);
  if (env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

  const server = createServer(app);
  const pub = redis.duplicate();
  const sub = redis.duplicate();
  const io = attachSocketServer(server, deps, services, { redis: { pub, sub } });
  (deps.realtime as ReturnType<typeof createDeferredRealtime>).attach(socketRealtime(io));
  const jobs = await startJobs(deps, services, redis);
  server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'API UCOLIS démarrée'));

  // Arrêt propre : on laisse finir les requêtes en cours, puis on ferme les connexions.
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'arrêt en cours');
    const force = setTimeout(() => process.exit(1), 15_000).unref();
    server.close(async () => {
      io.close();
      await jobs.close();
      await Promise.allSettled([disconnectMongo(), redis.quit(), pub.quit(), sub.quit()]);
      clearTimeout(force);
      logger.info('arrêt terminé');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
