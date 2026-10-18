import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  MY_OFFER_TABS,
  OFFER_SORTS,
  counterOfferSchema,
  createOfferSchema,
  paginationSchema,
  reofferSchema,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser, requireEmailVerified } from '../../lib/auth';
import { idParam, validQuery } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { OfferService } from './service';

const sortQuery = z.object({ sort: z.enum(OFFER_SORTS).default('recent') });
const tabQuery = paginationSchema.extend({ tab: z.enum(MY_OFFER_TABS).default('active') });

export function offerRoutes(deps: Deps, offers: OfferService): Router {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });

  r.get('/parcels/:id/offers', auth, validate(sortQuery, 'query'), async (req, res) => {
    const { sort } = validQuery<z.infer<typeof sortQuery>>(req);
    res.json(await offers.listForParcel(currentUser(req).userId, idParam(req), sort));
  });
  r.post('/parcels/:id/offers', auth, requireEmailVerified, validate(createOfferSchema), async (req, res) => {
    res.status(201).json(await offers.create(currentUser(req).user, idParam(req), req.body));
  });
  r.get('/me/offers', auth, validate(tabQuery, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof tabQuery>>(req);
    res.json(await offers.mine(currentUser(req).userId, q.tab, q.page, q.limit));
  });
  r.get('/offers/:id', auth, async (req, res) => {
    res.json(await offers.get(currentUser(req).userId, idParam(req)));
  });

  const action =
    (name: 'accept' | 'reject' | 'acceptCounter' | 'rejectCounter' | 'withdraw'): RequestHandler =>
    async (req, res) => {
      res.json(await offers[name](currentUser(req).userId, idParam(req)));
    };
  r.post('/offers/:id/accept', auth, action('accept'));
  r.post('/offers/:id/reject', auth, action('reject'));
  r.post('/offers/:id/accept-counter', auth, action('acceptCounter'));
  r.post('/offers/:id/reject-counter', auth, action('rejectCounter'));
  r.post('/offers/:id/withdraw', auth, action('withdraw'));
  r.post('/offers/:id/counter', auth, validate(counterOfferSchema), async (req, res) => {
    res.json(await offers.counter(currentUser(req).userId, idParam(req), req.body));
  });
  r.post('/offers/:id/reoffer', auth, validate(reofferSchema), async (req, res) => {
    res.json(await offers.reoffer(currentUser(req).userId, idParam(req), req.body));
  });
  return r;
}
