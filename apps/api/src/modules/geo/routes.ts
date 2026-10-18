import { Router } from 'express';
import { z } from 'zod';
import type { Deps } from '../../deps';
import { authenticate } from '../../lib/auth';
import type { Geocoder } from '../../lib/geocoder';
import { requestLocale, validQuery } from '../../lib/http';
import { validate } from '../../lib/validate';

const reverseQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
const searchQuery = z.object({ q: z.string().trim().min(2).max(100) });

export function geoRoutes(deps: Deps, geocoder: Geocoder): Router {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });
  r.get('/geo/reverse', auth, validate(reverseQuery, 'query'), async (req, res) => {
    res.json(await geocoder.reverse(validQuery<z.infer<typeof reverseQuery>>(req), requestLocale(req)));
  });
  r.get('/geo/search', auth, validate(searchQuery, 'query'), async (req, res) => {
    const { q } = validQuery<z.infer<typeof searchQuery>>(req);
    res.json({ items: await geocoder.search(q, requestLocale(req)) });
  });
  return r;
}
