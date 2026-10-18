import { Router } from 'express';
import { z } from 'zod';
import {
  savedSearchSchema,
  savedSearchUpdateSchema,
  tripInputSchema,
  tripListQuerySchema,
  tripRequestSchema,
  tripStatusSchema,
  type TripListQuery,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser, requireEmailVerified } from '../../lib/auth';
import { idParam, validQuery } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { AlertService } from '../alerts/service';
import type { TripService } from './service';

const tripPatchSchema = z
  .object({
    capacityKg: z.number().positive().max(50_000),
    capacityM3: z.number().positive().max(200),
    note: z.string().trim().max(300),
    departureAt: z.coerce.date(),
    priceHint: z.object({ mode: z.enum(['flat', 'per_kg']), amount: z.number().int().min(1) }).nullable(),
  })
  .partial();

export function tripRoutes(deps: Deps, trips: TripService, alerts: AlertService) {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });
  const maybeAuth = authenticate(deps.config.accessSecret, { optional: true, now: deps.now });

  r.get('/trips', maybeAuth, validate(tripListQuerySchema, 'query'), async (req, res) => {
    res.json(await trips.list(validQuery<TripListQuery>(req), req.auth?.userId));
  });
  r.get('/trips/:id', async (req, res) => {
    res.json(await trips.get(idParam(req)));
  });
  r.post('/trips', auth, requireEmailVerified, validate(tripInputSchema), async (req, res) => {
    res.status(201).json(await trips.create(currentUser(req).user, req.body));
  });
  r.patch('/trips/:id', auth, validate(tripPatchSchema), async (req, res) => {
    res.json(await trips.update(currentUser(req).userId, idParam(req), req.body));
  });
  r.post('/trips/:id/status', auth, validate(tripStatusSchema), async (req, res) => {
    res.json(await trips.setStatus(currentUser(req).userId, idParam(req), req.body.status));
  });
  r.get('/me/trips', auth, async (req, res) => {
    res.json(await trips.mine(currentUser(req).userId));
  });
  r.get('/trips/:id/matching-parcels', auth, async (req, res) => {
    res.json(await trips.matchingParcels(idParam(req)));
  });
  r.post('/trips/:id/requests', auth, requireEmailVerified, validate(tripRequestSchema), async (req, res) => {
    res.status(201).json(await trips.request(currentUser(req).userId, idParam(req), req.body.parcelId));
  });
  r.get('/me/trip-requests', auth, async (req, res) => {
    res.json(await trips.requests(currentUser(req).userId));
  });
  r.post('/trip-requests/:id/decline', auth, async (req, res) => {
    await trips.decline(currentUser(req).userId, idParam(req));
    res.status(204).end();
  });
  r.get('/users/:id/trips', async (req, res) => {
    res.json(await trips.publicForUser(idParam(req)));
  });

  // Alertes (10 au maximum).
  r.get('/me/saved-searches', auth, async (req, res) => {
    res.json(await alerts.list(currentUser(req).userId));
  });
  r.post('/me/saved-searches', auth, validate(savedSearchSchema), async (req, res) => {
    res.status(201).json(await alerts.create(currentUser(req).userId, req.body));
  });
  r.patch('/me/saved-searches/:id', auth, validate(savedSearchUpdateSchema), async (req, res) => {
    res.json(await alerts.update(currentUser(req).userId, idParam(req), req.body));
  });
  r.delete('/me/saved-searches/:id', auth, async (req, res) => {
    await alerts.remove(currentUser(req).userId, idParam(req));
    res.status(204).end();
  });

  // Favoris.
  r.get('/me/favorites', auth, async (req, res) => {
    res.json(await alerts.favorites(currentUser(req).userId));
  });
  r.put('/me/favorites/:parcelId', auth, async (req, res) => {
    await alerts.addFavorite(currentUser(req).userId, idParam(req, 'parcelId'));
    res.status(204).end();
  });
  r.delete('/me/favorites/:parcelId', auth, async (req, res) => {
    await alerts.removeFavorite(currentUser(req).userId, idParam(req, 'parcelId'));
    res.status(204).end();
  });
  return r;
}
