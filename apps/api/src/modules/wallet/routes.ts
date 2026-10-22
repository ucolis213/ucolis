import { Router } from 'express';
import type { z } from 'zod';
import {
  adminTopUpsQuerySchema,
  adminWalletsQuerySchema,
  paginationSchema,
  topUpDecisionSchema,
  topUpRequestSchema,
  walletAdjustmentSchema,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser } from '../../lib/auth';
import { idParam, validQuery } from '../../lib/http';
import { requirePermission } from '../../lib/staffAuth';
import { validate } from '../../lib/validate';
import type { WalletService } from './service';

/** Portefeuille du transporteur connecté. */
export function walletRoutes(deps: Deps, wallet: WalletService) {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });
  r.get('/me/wallet', auth, async (req, res) => {
    res.json(await wallet.me(currentUser(req).user));
  });
  r.get('/me/wallet/transactions', auth, validate(paginationSchema, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof paginationSchema>>(req);
    res.json(await wallet.transactions(currentUser(req).userId, q.page, q.limit));
  });
  r.get('/me/wallet/topups', auth, async (req, res) => {
    res.json(await wallet.topUps(currentUser(req).userId));
  });
  r.post('/me/wallet/topups', auth, validate(topUpRequestSchema), async (req, res) => {
    res.status(201).json(await wallet.requestTopUp(currentUser(req).user, req.body));
  });
  return r;
}

/** Recharges à valider, soldes et ajustements (wallet.manage). */
export function walletAdminRoutes(wallet: WalletService) {
  const r = Router();
  r.get('/wallets/topups', requirePermission('wallet.manage'), validate(adminTopUpsQuerySchema, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof adminTopUpsQuerySchema>>(req);
    res.json(await wallet.topUpQueue(q.status, q.page, q.limit));
  });
  r.get('/wallets/topups/:id', requirePermission('wallet.manage'), async (req, res) => {
    res.json(await wallet.topUpDetail(req, idParam(req)));
  });
  r.post('/wallets/topups/:id/decision', requirePermission('wallet.manage'), validate(topUpDecisionSchema), async (req, res) => {
    res.json(await wallet.decideTopUp(req, idParam(req), req.body));
  });
  r.get('/wallets', requirePermission('wallet.manage'), validate(adminWalletsQuerySchema, 'query'), async (req, res) => {
    res.json(await wallet.list(validQuery<z.infer<typeof adminWalletsQuerySchema>>(req)));
  });
  r.get('/wallets/:userId', requirePermission('wallet.manage'), async (req, res) => {
    res.json(await wallet.detail(idParam(req, 'userId')));
  });
  r.post('/wallets/:userId/adjust', requirePermission('wallet.manage'), validate(walletAdjustmentSchema), async (req, res) => {
    res.json(await wallet.adjust(req, idParam(req, 'userId'), req.body.amount, req.body.reason));
  });
  return r;
}
