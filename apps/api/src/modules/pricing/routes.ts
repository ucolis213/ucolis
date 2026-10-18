import { Router } from 'express';
import { pricingSuggestSchema } from '@ucolis/shared';
import { validate } from '../../lib/validate';
import type { SettingsReader } from '../settings/service';
import { quotePrice } from './service';

/** POST /pricing/suggest. Public. */
export function pricingRoutes(settings: SettingsReader): Router {
  const router = Router();
  router.post('/pricing/suggest', validate(pricingSuggestSchema), async (req, res) => {
    const { pricing } = await settings.getAll();
    res.json(quotePrice(req.body, pricing));
  });
  return router;
}
