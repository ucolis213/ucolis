import { Redis } from 'ioredis';

export function createRedis(url: string): Redis {
  // maxRetriesPerRequest: null est exigé par BullMQ, qui partagera ces options.
  return new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true });
}

export async function pingRedis(redis: Redis): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}
