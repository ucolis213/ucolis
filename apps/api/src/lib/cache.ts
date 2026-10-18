// Cache clé/valeur JSON : Redis en production, mémoire en test et en secours.

import type { Redis } from 'ioredis';

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export function createRedisCache(redis: Redis): Cache {
  return {
    async get(key) {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    },
    async set(key, value, ttl) {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    },
    async del(key) {
      await redis.del(key);
    },
  };
}

export function createMemoryCache(now = () => Date.now()): Cache {
  const store = new Map<string, { value: string; expires: number }>();
  return {
    async get(key) {
      const hit = store.get(key);
      if (!hit || hit.expires < now()) return null;
      return JSON.parse(hit.value);
    },
    async set(key, value, ttl) {
      store.set(key, { value: JSON.stringify(value), expires: now() + ttl * 1000 });
    },
    async del(key) {
      store.delete(key);
    },
  };
}
