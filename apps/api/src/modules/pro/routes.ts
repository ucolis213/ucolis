import { Router } from 'express';
import { proApplicationSchema, reasonOnlySchema, verificationDecisionSchema } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser, requireEmailVerified } from '../../lib/auth';
import { sendCsv } from '../../lib/csv';
import { AppError } from '../../lib/errors';
import { idParam } from '../../lib/http';
import { currentStaff, requirePermission } from '../../lib/staffAuth';
import { validate } from '../../lib/validate';
import type { Claims } from '../admin/claims';
import { ParcelModel } from '../parcels/model';
import { accountTypeOf } from '../users/model';
import type { ProService } from './service';

export function proRoutes(deps: Deps, pro: ProService) {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });
  r.get('/me/pro', auth, requireEmailVerified, async (req, res) => {
    res.json(await pro.get(currentUser(req).userId));
  });
  r.post('/me/pro', auth, requireEmailVerified, validate(proApplicationSchema), async (req, res) => {
    res.json(await pro.submit(currentUser(req).userId, req.body));
  });
  /** Avantage pro : export CSV de l'historique des colis. */
  r.get('/me/parcels/export', auth, async (req, res) => {
    const { user, userId } = currentUser(req);
    if (accountTypeOf(user) !== 'professional') throw new AppError(403, 'FORBIDDEN', 'Réservé aux comptes professionnels');
    const parcels = await ParcelModel.find({ sender: userId }).sort({ createdAt: -1 }).limit(10_000).lean();
    sendCsv(
      res,
      'historique-colis.csv',
      ['reference', 'createdAt', 'title', 'from', 'to', 'weightKg', 'status', 'requestedPrice', 'finalPrice', 'deliveredAt'],
      parcels.map((p) => ({
        reference: p.reference,
        createdAt: p.createdAt,
        title: p.title,
        from: `${p.pickup.commune} (${p.pickup.wilayaCode})`,
        to: `${p.dropoff.commune} (${p.dropoff.wilayaCode})`,
        weightKg: p.weightKg,
        status: p.status,
        requestedPrice: p.requestedPrice,
        finalPrice: p.finalPrice,
        deliveredAt: p.deliveredAt,
      })),
    );
  });
  return r;
}

export function proAdminRoutes(pro: ProService, claims: Claims) {
  const r = Router();
  r.get('/verifications/pro', requirePermission('verifications.pro'), async (_req, res) => {
    res.json(await pro.queue(claims));
  });
  r.get('/verifications/pro/:userId', requirePermission('verifications.pro'), async (req, res) => {
    res.json(await pro.detail(req, idParam(req, 'userId'), claims));
  });
  r.post('/verifications/pro/:userId/claim', requirePermission('verifications.pro'), async (req, res) => {
    res.json(await claims.claim('pro', idParam(req, 'userId'), currentStaff(req).id));
  });
  r.post('/verifications/pro/:userId/decision', requirePermission('verifications.pro'), validate(verificationDecisionSchema), async (req, res) => {
    await pro.decide(req, idParam(req, 'userId'), req.body.decision, req.body.reason, claims);
    res.status(204).end();
  });
  r.post('/verifications/pro/:userId/revoke', requirePermission('verifications.pro'), validate(reasonOnlySchema), async (req, res) => {
    await pro.revoke(req, idParam(req, 'userId'), req.body.reason);
    res.status(204).end();
  });
  return r;
}
