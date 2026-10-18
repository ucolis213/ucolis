import { Router } from 'express';
import { toPublicConfig } from '@ucolis/shared';
import type { SettingsReader } from '../settings/service';

/** GET /app/config : version minimale, maintenance, réglages publics, version des CGU. Public. */
export function configRoutes(settings: SettingsReader): Router {
  const router = Router();
  router.get('/app/config', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json(toPublicConfig(await settings.getAll()));
  });
  return router;
}
