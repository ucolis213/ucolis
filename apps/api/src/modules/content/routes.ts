import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { deletionRequestSchema, reasonSchema, wilayaCodeSchema } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { authenticate, currentUser } from '../../lib/auth';
import { AppError } from '../../lib/errors';
import { currentStaff, requirePermission } from '../../lib/staffAuth';
import { validate } from '../../lib/validate';
import { hasOngoingDelivery } from '../users/anonymize';
import { UserModel } from '../users/model';
import { toMe, type MeDto } from '../users/serializers';
import { CONTENT_KEYS, type ContentKey } from './model';
import { isLocale, type ContentService } from './service';

const keyOf = (v: unknown): ContentKey => {
  if (!CONTENT_KEYS.includes(v as ContentKey)) throw new AppError(404, 'NOT_FOUND', 'Contenu inconnu');
  return v as ContentKey;
};

const bilingual = z.object({ fr: z.string().trim().min(1).max(500), ar: z.string().trim().min(1).max(500) });
const broadcastSchema = z.object({
  title: z.object({ fr: z.string().trim().min(1).max(80), ar: z.string().trim().min(1).max(80) }),
  body: bilingual,
  segment: z
    .object({ kind: z.enum(['all', 'carriers', 'senders', 'pros', 'wilaya']), wilayaCode: wilayaCodeSchema.nullable().optional() })
    .refine((s) => s.kind !== 'wilaya' || !!s.wilayaCode, { message: 'validation.wilaya', path: ['wilayaCode'] }),
  link: z.string().regex(/^ucolis:\/\//).nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  reason: reasonSchema,
});

export const DELETION_GRACE_DAYS = 14;

export function contentRoutes(deps: Deps, content: ContentService) {
  const r = Router();
  const auth = authenticate(deps.config.accessSecret, { now: deps.now });

  // Public : la politique de confidentialité doit être accessible sans compte.
  r.get('/content/:key', async (req, res) => {
    const locale = isLocale(req.query.locale) ? req.query.locale : 'fr';
    res.json(await content.getPublished(keyOf(req.params.key), locale));
  });

  /** Suppression de compte : mot de passe, aucune livraison en cours, délai de grâce de 14 jours. */
  r.post('/me/deletion', auth, validate(deletionRequestSchema), async (req, res) => {
    const { userId } = currentUser(req);
    const user = await UserModel.findById(userId).select('+passwordHash');
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      throw new AppError(400, 'INVALID_CREDENTIALS', 'Mot de passe incorrect');
    }
    if (await hasOngoingDelivery(userId)) throw new AppError(409, 'DELIVERY_IN_PROGRESS', 'Une livraison est en cours');
    user.status = 'pending_deletion';
    user.deletionRequestedAt = deps.now();
    await user.save();
    const me: MeDto = toMe(user.toObject() as never);
    res.json({ ...me, deletionScheduledFor: new Date(deps.now().getTime() + DELETION_GRACE_DAYS * 86_400_000) });
  });
  r.delete('/me/deletion', auth, async (req, res) => {
    const updated = await UserModel.findOneAndUpdate(
      { _id: currentUser(req).userId, status: 'pending_deletion' },
      { status: 'active', deletionRequestedAt: null },
      { new: true },
    ).lean();
    if (!updated) throw new AppError(409, 'INVALID_TRANSITION', 'Aucune suppression en attente');
    res.json(toMe(updated as never));
  });
  return r;
}

export function contentAdminRoutes(deps: Deps, content: ContentService) {
  const r = Router();
  r.get('/content', requirePermission('content.manage'), async (_req, res) => {
    res.json(await content.listForStaff());
  });
  r.put('/content/:key/:locale', requirePermission('content.manage'), validate(z.object({ body: z.string().max(100_000) })), async (req, res) => {
    const locale = req.params.locale;
    if (!isLocale(locale)) throw new AppError(404, 'NOT_FOUND', 'Langue inconnue');
    await content.saveDraft(keyOf(req.params.key), locale, req.body.body, currentStaff(req).id);
    res.status(204).end();
  });
  r.post('/content/:key/:locale/publish', requirePermission('content.manage'), validate(z.object({ reason: reasonSchema })), async (req, res) => {
    const locale = req.params.locale;
    if (!isLocale(locale)) throw new AppError(404, 'NOT_FOUND', 'Langue inconnue');
    const result = await content.publish(keyOf(req.params.key), locale, currentStaff(req).id);
    await audit(req, { action: 'content.publish', targetType: 'content', targetId: `${req.params.key}:${locale}`, reason: req.body.reason, after: { version: result.version } });
    res.json(result);
  });

  r.post('/broadcasts/preview', requirePermission('broadcast.send'), async (req, res) => {
    const segment = broadcastSchema.shape.segment.parse(req.body.segment);
    res.json({ recipients: await content.previewCount(segment) });
  });
  r.post('/broadcasts', requirePermission('broadcast.send'), validate(broadcastSchema), async (req, res) => {
    const { reason, ...input } = req.body;
    const b = await content.createBroadcast(input, currentStaff(req).id);
    await audit(req, { action: 'broadcast.send', targetType: 'broadcast', targetId: b._id.toString(), reason, after: { segment: input.segment, scheduledAt: input.scheduledAt ?? null } });
    res.status(201).json(b);
  });
  r.get('/broadcasts', requirePermission('broadcast.send'), async (_req, res) => {
    res.json(await content.listBroadcasts());
  });
  void deps;
  return r;
}
