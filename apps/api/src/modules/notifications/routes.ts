import { Router } from 'express';
import { paginationSchema, type Pagination } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser } from '../../lib/auth';
import { idParam, validQuery } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { NotificationService } from './service';

export function notificationRoutes(deps: Deps, notifications: NotificationService): Router {
  const r = Router();
  r.use('/notifications', authenticate(deps.config.accessSecret, { now: deps.now }));
  r.get('/notifications', validate(paginationSchema, 'query'), async (req, res) => {
    const q = validQuery<Pagination>(req);
    res.json(await notifications.list(currentUser(req).userId, q.page, q.limit));
  });
  r.get('/notifications/unread-count', async (req, res) => {
    res.json(await notifications.counters(currentUser(req).userId));
  });
  r.post('/notifications/read-all', async (req, res) => {
    await notifications.markAllRead(currentUser(req).userId);
    res.status(204).end();
  });
  r.post('/notifications/:id/read', async (req, res) => {
    await notifications.markRead(currentUser(req).userId, idParam(req));
    res.status(204).end();
  });
  r.delete('/notifications/:id', async (req, res) => {
    await notifications.remove(currentUser(req).userId, idParam(req));
    res.status(204).end();
  });
  r.delete('/notifications', async (req, res) => {
    await notifications.remove(currentUser(req).userId);
    res.status(204).end();
  });
  return r;
}
