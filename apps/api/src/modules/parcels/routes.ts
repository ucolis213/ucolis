import { Router } from 'express';
import { z } from 'zod';
import {
  PARCEL_STATUSES,
  cancelParcelSchema,
  createParcelSchema,
  paginationSchema,
  parcelListQuerySchema,
  updateParcelSchema,
  type ParcelListQuery,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser, requireEmailVerified } from '../../lib/auth';
import { idParam, validQuery } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { ParcelService } from './service';

const myParcelsQuery = paginationSchema.extend({
  status: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.enum(PARCEL_STATUSES)))
    .optional(),
});

export function parcelRoutes(deps: Deps, parcels: ParcelService): Router {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });
  const maybeAuth = authenticate(deps.config.accessSecret, { optional: true, now: deps.now });

  r.get('/parcels', maybeAuth, validate(parcelListQuerySchema, 'query'), async (req, res) => {
    res.json(await parcels.list(validQuery<ParcelListQuery>(req), req.auth?.userId));
  });
  r.get('/parcels/:id', maybeAuth, async (req, res) => {
    res.json(await parcels.get(idParam(req), req.auth?.userId));
  });
  r.post('/parcels', auth, requireEmailVerified, validate(createParcelSchema), async (req, res) => {
    res.status(201).json(await parcels.create(currentUser(req).user, req.body));
  });
  r.patch('/parcels/:id', auth, requireEmailVerified, validate(updateParcelSchema), async (req, res) => {
    res.json(await parcels.update(currentUser(req).userId, idParam(req), req.body));
  });
  r.post('/parcels/:id/cancel', auth, validate(cancelParcelSchema), async (req, res) => {
    res.json(await parcels.cancel(currentUser(req).userId, idParam(req), req.body.reason));
  });
  r.post('/parcels/:id/duplicate', auth, async (req, res) => {
    res.json(await parcels.duplicate(currentUser(req).user, idParam(req)));
  });
  r.get('/me/parcels', auth, validate(myParcelsQuery, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof myParcelsQuery>>(req);
    res.json(await parcels.mine(currentUser(req).userId, q.status, q.page, q.limit));
  });
  return r;
}
