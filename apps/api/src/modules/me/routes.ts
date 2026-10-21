import { Router, type Request } from 'express';
import {
  acceptTermsSchema,
  avatarSchema,
  changePasswordSchema,
  emailChangeConfirmSchema,
  emailChangeSchema,
  positionSchema,
  preferencesSchema,
  pushTokenSchema,
  updateMeSchema,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate, currentUser } from '../../lib/auth';
import { idParam } from '../../lib/http';
import { validate } from '../../lib/validate';
import type { MeService } from './service';

/** L'application envoie son identifiant d'appareil pour marquer la session courante. */
const deviceIdOf = (req: Request) => {
  const v = req.headers['x-device-id'];
  return typeof v === 'string' ? v : undefined;
};

export function meRoutes(deps: Deps, me: MeService): Router {
  const r = Router();
  r.use('/me', authenticate(deps.config.accessSecret, { now: deps.now }));

  r.get('/me', async (req, res) => {
    res.json(await me.get(currentUser(req).userId));
  });
  r.patch('/me', validate(updateMeSchema), async (req, res) => {
    res.json(await me.updateProfile(currentUser(req).userId, req.body));
  });
  r.put('/me/avatar', validate(avatarSchema), async (req, res) => {
    res.json(await me.setAvatar(currentUser(req).userId, req.body.avatar));
  });
  r.put('/me/password', validate(changePasswordSchema), async (req, res) => {
    const { currentPassword, password } = req.body;
    await me.changePassword(currentUser(req).userId, currentPassword, password, deviceIdOf(req));
    res.status(204).end();
  });
  r.post('/me/email-change', validate(emailChangeSchema), async (req, res) => {
    await me.requestEmailChange(currentUser(req).userId, req.body.email);
    res.status(204).end();
  });
  r.post('/me/email-change/confirm', validate(emailChangeConfirmSchema), async (req, res) => {
    res.json(await me.confirmEmailChange(currentUser(req).userId, req.body.code));
  });
  r.patch('/me/preferences', validate(preferencesSchema), async (req, res) => {
    res.json(await me.updatePreferences(currentUser(req).userId, req.body));
  });
  r.post('/me/terms/accept', validate(acceptTermsSchema), async (req, res) => {
    res.json(await me.acceptTerms(currentUser(req).userId, req.body.version));
  });

  r.get('/me/sessions', async (req, res) => {
    res.json({ items: await me.listSessions(currentUser(req).userId, deviceIdOf(req)) });
  });
  r.delete('/me/sessions/:id', async (req, res) => {
    await me.revokeSession(currentUser(req).userId, String(req.params.id));
    res.status(204).end();
  });
  r.delete('/me/sessions', async (req, res) => {
    await me.revokeOtherSessions(currentUser(req).userId, deviceIdOf(req));
    res.status(204).end();
  });

  r.put('/me/position', validate(positionSchema), async (req, res) => {
    await me.updatePosition(currentUser(req).userId, req.body);
    res.status(204).end();
  });

  r.post('/me/push-tokens', validate(pushTokenSchema), async (req, res) => {
    await me.registerPushToken(currentUser(req).userId, req.body);
    res.status(204).end();
  });
  r.delete('/me/push-tokens/:token', async (req, res) => {
    await me.removePushToken(currentUser(req).userId, String(req.params.token));
    res.status(204).end();
  });

  r.get('/me/blocked', async (req, res) => {
    res.json({ items: await me.listBlocked(currentUser(req).userId) });
  });
  r.post('/me/blocked/:userId', async (req, res) => {
    await me.block(currentUser(req).userId, idParam(req, 'userId'));
    res.status(204).end();
  });
  r.delete('/me/blocked/:userId', async (req, res) => {
    await me.unblock(currentUser(req).userId, idParam(req, 'userId'));
    res.status(204).end();
  });
  return r;
}
