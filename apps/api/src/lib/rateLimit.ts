// Limitation de débit stockée dans Redis, par utilisateur authentifié et non par IP seule (CGNAT).

import type { RequestHandler } from 'express';
import type { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
  type RateLimiterAbstract,
} from 'rate-limiter-flexible';
import { AppError } from './errors';

export interface LimiterSpec {
  points: number;
  durationSeconds: number;
  /** Blocage après dépassement ; doublé à chaque nouveau dépassement (délai progressif). */
  blockSeconds?: number;
}

export type LimiterFactory = (name: string, spec: LimiterSpec) => RateLimiterAbstract;

export function limiterFactory(redis: Redis | null): LimiterFactory {
  return (name, spec) => {
    const opts = {
      keyPrefix: `rl:${name}`,
      points: spec.points,
      duration: spec.durationSeconds,
      blockDuration: spec.blockSeconds ?? 0,
    };
    return redis ? new RateLimiterRedis({ storeClient: redis, ...opts }) : new RateLimiterMemory(opts);
  };
}

export const LIMITS = {
  user: { points: 300, durationSeconds: 15 * 60 },
  publicIp: { points: 60, durationSeconds: 15 * 60 },
  authIp: { points: 10, durationSeconds: 15 * 60 },
  authEmail: { points: 5, durationSeconds: 15 * 60, blockSeconds: 15 * 60 },
  otpSend: { points: 5, durationSeconds: 60 * 60 },
  messages: { points: 30, durationSeconds: 60 },
  conversationsPerDay: { points: 10, durationSeconds: 24 * 3600 },
  tripRequestsPerDay: { points: 10, durationSeconds: 24 * 3600 },
} satisfies Record<string, LimiterSpec>;

export function tooMany(res: unknown): AppError {
  const retryAfterSeconds =
    res instanceof RateLimiterRes ? Math.ceil(res.msBeforeNext / 1000) : undefined;
  return new AppError(429, 'RATE_LIMITED', 'Trop de requêtes', { retryAfterSeconds });
}

/** Consomme un point ; lève 429 RATE_LIMITED si la limite est atteinte. */
export async function consume(limiter: RateLimiterAbstract, key: string, points = 1) {
  try {
    await limiter.consume(key, points);
  } catch (err) {
    if (err instanceof RateLimiterRes) throw tooMany(err);
    throw err;
  }
}

/**
 * Limite globale : 300 requêtes / 15 min par utilisateur authentifié, 60 / 15 min par IP sinon.
 * Le jeton n'est que décodé ici (vérification de signature, sans base) pour choisir la clé.
 */
export function globalRateLimit(factory: LimiterFactory, accessSecret: string): RequestHandler {
  const perUser = factory('user', LIMITS.user);
  const perIp = factory('ip', LIMITS.publicIp);
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    let userId: string | null = null;
    if (header?.startsWith('Bearer ')) {
      try {
        userId = (jwt.verify(header.slice(7), accessSecret) as { sub: string }).sub;
      } catch {
        userId = null;
      }
    }
    try {
      if (userId) await consume(perUser, userId);
      else await consume(perIp, req.ip ?? 'unknown');
      next();
    } catch (err) {
      next(err);
    }
  };
}
