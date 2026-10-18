import { Router, type Request } from 'express';
import { declareDeliverySchema, deliveryCodeSchema } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser } from '../../lib/auth';
import { idParam } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { ParcelService } from '../parcels/service';
import type { TrackingService } from '../tracking/service';
import type { DeliveryService } from './service';

export function deliveryRoutes(
  deps: Deps,
  delivery: DeliveryService,
  parcels: ParcelService,
  tracking: TrackingService,
): Router {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });
  const dto = async (req: Request) => parcels.toDto(await parcels.load(idParam(req)), currentUser(req).userId);

  r.post('/parcels/:id/start', auth, async (req, res) => {
    await delivery.start(currentUser(req).userId, idParam(req));
    res.json(await dto(req));
  });
  r.post('/parcels/:id/delivery-code', auth, validate(deliveryCodeSchema), async (req, res) => {
    await delivery.submitCode(currentUser(req).userId, idParam(req), req.body.code);
    res.json(await dto(req));
  });
  r.get('/parcels/:id/delivery-code', auth, async (req, res) => {
    res.json(await delivery.deliveryCode(currentUser(req).userId, idParam(req)));
  });
  r.post('/parcels/:id/declare-delivered', auth, validate(declareDeliverySchema), async (req, res) => {
    await delivery.declare(currentUser(req).userId, idParam(req), req.body);
    res.json(await dto(req));
  });
  r.post('/parcels/:id/confirm-delivery', auth, async (req, res) => {
    await delivery.confirm(currentUser(req).userId, idParam(req));
    res.json(await dto(req));
  });
  r.post('/parcels/:id/withdraw', auth, async (req, res) => {
    await delivery.withdraw(currentUser(req).userId, idParam(req));
    res.json({ ok: true });
  });
  r.get('/parcels/:id/tracking', auth, async (req, res) => {
    const p = await tracking.assertCanFollow(currentUser(req).userId, idParam(req));
    res.json({ status: p.status, last: await tracking.last(idParam(req)) });
  });
  return r;
}
