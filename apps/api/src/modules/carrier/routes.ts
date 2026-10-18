import { Router } from 'express';
import { carrierVerificationSchema, vehicleInputSchema, vehicleUpdateSchema } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser } from '../../lib/auth';
import { idParam } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { CarrierService } from './service';

export function carrierRoutes(deps: Deps, carrier: CarrierService): Router {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });
  r.get('/me/carrier-verification', auth, async (req, res) => {
    res.json(await carrier.getVerification(currentUser(req).userId));
  });
  r.post('/me/carrier-verification', auth, validate(carrierVerificationSchema), async (req, res) => {
    res.json(await carrier.submitVerification(currentUser(req).userId, req.body));
  });
  r.get('/me/vehicles', auth, async (req, res) => {
    res.json({ items: await carrier.listVehicles(currentUser(req).userId) });
  });
  r.post('/me/vehicles', auth, validate(vehicleInputSchema), async (req, res) => {
    res.status(201).json({ items: await carrier.addVehicle(currentUser(req).userId, req.body) });
  });
  r.patch('/me/vehicles/:id', auth, validate(vehicleUpdateSchema), async (req, res) => {
    res.json({ items: await carrier.updateVehicle(currentUser(req).userId, idParam(req), req.body) });
  });
  r.delete('/me/vehicles/:id', auth, async (req, res) => {
    res.json({ items: await carrier.deleteVehicle(currentUser(req).userId, idParam(req)) });
  });
  return r;
}
