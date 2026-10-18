import { Router } from 'express';
import {
  createDisputeSchema,
  createReportSchema,
  createReviewSchema,
  disputeResponseSchema,
  paginationSchema,
  reviewReplySchema,
  type Pagination,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser, requireEmailVerified } from '../../lib/auth';
import { idParam, validQuery } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { DisputeService } from './disputes';
import type { ReportService } from './reports';
import type { ReviewService } from './reviews';

export function trustRoutes(deps: Deps, s: { reviews: ReviewService; reports: ReportService; disputes: DisputeService }) {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });

  r.get('/parcels/:id/review-status', auth, async (req, res) => {
    res.json(await s.reviews.status(idParam(req), currentUser(req).userId));
  });
  r.post('/parcels/:id/reviews', auth, validate(createReviewSchema), async (req, res) => {
    res.status(201).json(await s.reviews.create(idParam(req), currentUser(req).userId, req.body));
  });
  r.post('/reviews/:id/reply', auth, validate(reviewReplySchema), async (req, res) => {
    await s.reviews.reply(idParam(req), currentUser(req).userId, req.body.text);
    res.status(204).end();
  });
  r.get('/me/reviews', auth, async (req, res) => {
    res.json(await s.reviews.mine(currentUser(req).userId));
  });
  r.get('/users/:id/reviews', validate(paginationSchema, 'query'), async (req, res) => {
    const q = validQuery<Pagination>(req);
    res.json(await s.reviews.forUser(idParam(req), q.page, q.limit));
  });

  r.post('/reports', auth, validate(createReportSchema), async (req, res) => {
    res.status(201).json(await s.reports.create(currentUser(req).userId, req.body));
  });

  r.post('/parcels/:id/disputes', auth, requireEmailVerified, validate(createDisputeSchema), async (req, res) => {
    res.status(201).json(await s.disputes.open(currentUser(req).userId, idParam(req), req.body));
  });
  r.get('/disputes/:id', auth, async (req, res) => {
    res.json(await s.disputes.get(currentUser(req).userId, idParam(req)));
  });
  r.post('/disputes/:id/response', auth, validate(disputeResponseSchema), async (req, res) => {
    res.json(await s.disputes.respond(currentUser(req).userId, idParam(req), req.body));
  });
  return r;
}
