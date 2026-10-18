// BullMQ : chaque balayage est un planificateur de job répétable, avec plusieurs tentatives
// et un délai croissant. Plusieurs instances de l'API partagent la même file sans doublon.

import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Deps } from '../deps';
import type { Services } from '../services';
import { SCHEDULE } from './sweeps';

const QUEUE = 'ucolis-sweeps';

export async function startJobs(deps: Deps, services: Services, redis: Redis) {
  const connection = redis.duplicate();
  const queue = new Queue(QUEUE, { connection });
  for (const job of SCHEDULE) {
    await queue.upsertJobScheduler(
      job.name,
      { pattern: job.pattern },
      {
        name: job.name,
        opts: { attempts: 5, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 100, removeOnFail: 500 },
      },
    );
  }
  const byName = new Map(SCHEDULE.map((j) => [j.name, j.run]));
  const worker = new Worker(
    QUEUE,
    async (job) => {
      const run = byName.get(job.name);
      if (!run) return 0;
      const count = await run(deps, services);
      if (count) deps.logger.info({ job: job.name, count }, 'balayage effectué');
      return count;
    },
    { connection: redis.duplicate(), concurrency: 2 },
  );
  worker.on('failed', (job, err) => deps.logger.error({ err, job: job?.name }, 'job en échec'));
  return {
    async close() {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}
