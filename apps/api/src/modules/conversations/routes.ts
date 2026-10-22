import { Router } from 'express';
import { muteSchema, openConversationSchema, sendMessageSchema } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser, requireEmailVerified } from '../../lib/auth';
import { idParam } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { ConversationService } from './service';

export function conversationRoutes(deps: Deps, conversations: ConversationService): Router {
  const r = Router();
  r.use('/conversations', authenticate(deps.config.accessSecret, { now: deps.now }));
  r.get('/conversations', async (req, res) => {
    res.json(await conversations.list(currentUser(req).userId));
  });
  r.post('/conversations', requireEmailVerified, validate(openConversationSchema), async (req, res) => {
    res.json(await conversations.open(currentUser(req).userId, req.body.userId, req.body.parcelId));
  });
  r.get('/conversations/:id', async (req, res) => {
    res.json(await conversations.get(currentUser(req).userId, idParam(req)));
  });
  r.get('/conversations/:id/messages', async (req, res) => {
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    res.json(await conversations.messages(currentUser(req).userId, idParam(req), before));
  });
  r.post('/conversations/:id/messages', requireEmailVerified, validate(sendMessageSchema), async (req, res) => {
    res.status(201).json(await conversations.send(currentUser(req).userId, idParam(req), req.body));
  });
  r.post('/conversations/:id/read', async (req, res) => {
    await conversations.read(currentUser(req).userId, idParam(req));
    res.status(204).end();
  });
  r.delete('/conversations/:id', async (req, res) => {
    await conversations.hide(currentUser(req).userId, idParam(req));
    res.status(204).end();
  });
  r.post('/conversations/:id/mute', validate(muteSchema), async (req, res) => {
    res.json(await conversations.mute(currentUser(req).userId, idParam(req), req.body.muted));
  });
  return r;
}
