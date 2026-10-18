import { Router } from 'express';

export interface HealthChecks {
  mongo: () => Promise<boolean>;
  redis: () => Promise<boolean>;
}

/** GET /health : 200 si MongoDB et Redis répondent, 503 sinon. Public. */
export function healthRoutes(checks: HealthChecks): Router {
  const router = Router();
  router.get('/health', async (_req, res) => {
    const [mongo, redis] = await Promise.all([checks.mongo(), checks.redis()]);
    const ok = mongo && redis;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      mongo: mongo ? 'up' : 'down',
      redis: redis ? 'up' : 'down',
      time: new Date().toISOString(),
    });
  });
  return router;
}
