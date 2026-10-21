// API du staff (/api/v1/admin) : jeton distinct, permission vérifiée sur chaque route,
// motif obligatoire et entrée d'audit sur chaque écriture.

import { Router, type Request } from 'express';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import {
  APP_SETTING_KEYS,
  APP_SETTING_SCHEMAS,
  acceptInviteSchema,
  adminParcelsQuerySchema,
  adminUsersQuerySchema,
  auditQuerySchema,
  forceStatusSchema,
  hasPermission,
  hideSchema,
  paginationSchema,
  inviteStaffSchema,
  reasonOnlySchema,
  reasonSchema,
  staffLoginSchema,
  suspendUserSchema,
  transferSuperAdminSchema,
  updateStaffSchema,
  verificationDecisionSchema,
  UPLOAD_RULES,
  type AppSettingKey,
  type Permission,
  type StorageUsageDto,
  type UploadPurpose,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { sendCsv } from '../../lib/csv';
import { AppError } from '../../lib/errors';
import { idParam, paginate, validQuery } from '../../lib/http';
import { privateDownloadUrl } from '../../lib/cloudinary';
import { authenticateStaff, currentStaff, requirePermission } from '../../lib/staffAuth';
import { LIMITS, consume } from '../../lib/rateLimit';
import { validate } from '../../lib/validate';
import { AppSettingModel } from '../settings/model';
import { TripModel, type TripLean } from '../trips/model';
import { createClaims } from './claims';
import { AuditLogModel, StaffModel, type AuditLean } from './model';
import { PARCEL_CSV_COLUMNS, createParcelsAdmin } from './parcelsAdmin';
import { createStaffService } from './staffService';
import { dashboardStats } from './stats';
import { USER_CSV_COLUMNS, createUsersAdmin } from './usersAdmin';
import { contentAdminRoutes } from '../content/routes';
import { proAdminRoutes } from '../pro/routes';
import { trustAdminRoutes } from './trustAdmin';
import { createVerificationsAdmin } from './verificationsAdmin';
import type { Services } from '../../services';

const refreshBody = z.object({ refreshToken: z.string().min(1) });

/** Dossier Cloudinary d'un fichier → permission requise pour le servir. */
const FILE_PERMISSIONS: Record<string, Permission[]> = {
  identity_doc: ['verifications.identity'],
  pro_doc: ['verifications.pro'],
  dispute_photo: ['disputes.handle'],
  delivery_proof: ['disputes.handle', 'parcels.view'],
};

export function adminRoutes(deps: Deps, services: Services) {
  const r = Router();
  const staffService = createStaffService(deps);
  const claims = createClaims(deps);
  const users = createUsersAdmin(deps);
  const verifications = createVerificationsAdmin(deps, claims);
  const parcels = createParcelsAdmin(deps);
  const meta = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

  // --- Authentification -------------------------------------------------------------------------
  const loginLimiter = deps.limiters('staff-login', LIMITS.authIp);
  r.post('/auth/login', validate(staffLoginSchema), async (req, res) => {
    try {
      res.json(await staffService.login(req.body.email, req.body.password, req.body.totp, meta(req)));
    } catch (err) {
      // Seuls les échecs comptent : 10 par IP sur 15 min.
      if (err instanceof AppError && err.code !== 'TOTP_REQUIRED') await consume(loginLimiter, req.ip ?? 'unknown');
      throw err;
    }
  });
  r.post('/auth/refresh', validate(refreshBody), async (req, res) => {
    res.json(await staffService.refresh(req.body.refreshToken));
  });
  r.post('/auth/logout', validate(refreshBody), async (req, res) => {
    await staffService.logout(req.body.refreshToken);
    res.status(204).end();
  });
  r.get('/auth/invite/:token', async (req, res) => {
    res.json(await staffService.inviteInfo(String(req.params.token)));
  });
  r.post('/auth/accept-invite', validate(acceptInviteSchema), async (req, res) => {
    res.json(await staffService.acceptInvite(req.body.token, req.body.password, req.body.totp));
  });

  r.use(authenticateStaff(deps.config.staffSecret, deps.now));
  r.get('/me', async (req, res) => {
    res.json(await staffService.me(currentStaff(req).id));
  });

  // --- Tableau de bord --------------------------------------------------------------------------
  r.get('/stats', requirePermission('dashboard.view'), async (_req, res) => {
    res.json(await dashboardStats(deps));
  });

  /** Consommation Cloudinary du mois, gardée 15 min en cache (l'Admin API est limitée en nombre d'appels). */
  r.get('/storage-usage', requirePermission('dashboard.view'), async (_req, res) => {
    const key = 'admin:storage-usage';
    let usage = await deps.cache.get<StorageUsageDto>(key);
    if (!usage) {
      usage = await deps.files.usage();
      if (usage) await deps.cache.set(key, usage, 15 * 60);
    }
    res.json({ usage });
  });

  // --- Utilisateurs -----------------------------------------------------------------------------
  r.get('/users', requirePermission('users.view'), validate(adminUsersQuerySchema, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof adminUsersQuerySchema>>(req);
    if (q.format === 'csv') {
      const all = await users.list(req, q, true);
      return sendCsv(res, 'utilisateurs.csv', USER_CSV_COLUMNS, all.items as unknown as Record<string, unknown>[]);
    }
    res.json(await users.list(req, q));
  });
  r.get('/users/:id', requirePermission('users.view'), async (req, res) => {
    res.json(await users.detail(req, idParam(req)));
  });
  r.post('/users/:id/suspend', requirePermission('users.suspend'), validate(suspendUserSchema), async (req, res) => {
    await users.suspend(req, idParam(req), req.body.reason, req.body.until);
    res.status(204).end();
  });
  r.post('/users/:id/reactivate', requirePermission('users.suspend'), validate(reasonOnlySchema), async (req, res) => {
    await users.reactivate(req, idParam(req), req.body.reason);
    res.status(204).end();
  });
  r.delete('/users/:id', requirePermission('users.delete'), validate(reasonOnlySchema), async (req, res) => {
    await users.remove(req, idParam(req), req.body.reason);
    res.status(204).end();
  });

  // --- Vérifications d'identité -----------------------------------------------------------------
  r.get('/verifications/identity', requirePermission('verifications.identity'), async (_req, res) => {
    res.json(await verifications.identityQueue());
  });
  r.get('/verifications/identity/:userId', requirePermission('verifications.identity'), async (req, res) => {
    res.json(await verifications.identityDetail(req, idParam(req, 'userId')));
  });
  r.post('/verifications/identity/:userId/claim', requirePermission('verifications.identity'), async (req, res) => {
    res.json(await verifications.claimIdentity(currentStaff(req).id, idParam(req, 'userId')));
  });
  r.post(
    '/verifications/identity/:userId/decision',
    requirePermission('verifications.identity'),
    validate(verificationDecisionSchema),
    async (req, res) => {
      await verifications.decideIdentity(req, idParam(req, 'userId'), req.body.decision, req.body.reason);
      res.status(204).end();
    },
  );

  /** Pièces sensibles : URL signée de 5 min, seulement avec la permission correspondante. */
  r.get('/files', async (req, res) => {
    const publicId = String(req.query.publicId ?? '');
    const folder = publicId.split('/')[1] ?? '';
    const needed = FILE_PERMISSIONS[folder];
    if (!needed) throw new AppError(404, 'NOT_FOUND', 'Fichier inconnu');
    if (!needed.some((p) => hasPermission(currentStaff(req), p))) {
      throw new AppError(403, 'PERMISSION_DENIED', 'Permission insuffisante');
    }
    const now = Math.floor(deps.now().getTime() / 1000);
    const isPdf = req.query.kind === 'pdf';
    await audit(req, { action: 'file.view', targetType: 'file', targetId: publicId });
    res.json({
      url: privateDownloadUrl(deps.config.cloudinary, publicId, {
        resourceType: isPdf ? 'raw' : 'image',
        timestamp: now,
        expiresAt: now + 300,
        format: isPdf ? 'pdf' : 'jpg',
        type: UPLOAD_RULES[folder as UploadPurpose].access,
      }),
      expiresAt: new Date((now + 300) * 1000).toISOString(),
    });
  });

  // --- Colis ------------------------------------------------------------------------------------
  r.get('/parcels', requirePermission('parcels.view'), validate(adminParcelsQuerySchema, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof adminParcelsQuerySchema>>(req);
    if (q.format === 'csv') {
      const all = await parcels.list(q, true);
      return sendCsv(res, 'colis.csv', PARCEL_CSV_COLUMNS, all.items as unknown as Record<string, unknown>[]);
    }
    res.json(await parcels.list(q));
  });
  r.get('/parcels/:id', requirePermission('parcels.view'), async (req, res) => {
    res.json(await parcels.detail(req, idParam(req)));
  });
  r.post('/parcels/:id/force-status', requirePermission('parcels.moderate'), validate(forceStatusSchema), async (req, res) => {
    await parcels.forceStatus(req, idParam(req), req.body.status, req.body.reason);
    res.json(await parcels.detail(req, idParam(req)));
  });
  r.post('/parcels/:id/hide', requirePermission('parcels.moderate'), validate(hideSchema), async (req, res) => {
    await parcels.hide(req, idParam(req), req.body.hidden, req.body.reason);
    res.status(204).end();
  });
  r.delete('/parcels/:id', requirePermission('parcels.moderate'), validate(reasonOnlySchema), async (req, res) => {
    await parcels.remove(req, idParam(req), req.body.reason);
    res.status(204).end();
  });

  // --- Trajets ---------------------------------------------------------------------------------
  const tripsQuery = paginationSchema.extend({ status: z.enum(['active', 'full', 'completed', 'cancelled']).optional() });
  r.get('/trips', requirePermission('parcels.view'), validate(tripsQuery, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof tripsQuery>>(req);
    const filter = q.status ? { status: q.status } : {};
    const [total, items] = await Promise.all([
      TripModel.countDocuments(filter),
      TripModel.find(filter).sort({ departureAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    const dtos = await services.trips.dtos(items as TripLean[]);
    res.json(paginate(dtos.map((d, i) => ({ ...d, hidden: !!items[i]!.hidden?.isHidden })), q.page, q.limit, total));
  });
  r.get('/trips/:id', requirePermission('parcels.view'), async (req, res) => {
    const t = await services.trips.load(idParam(req));
    res.json({ ...(await services.trips.dtos([t]))[0], hidden: t.hidden });
  });
  r.post('/trips/:id/hide', requirePermission('parcels.moderate'), validate(hideSchema), async (req, res) => {
    const t = await services.trips.load(idParam(req));
    await TripModel.updateOne({ _id: t._id }, { hidden: { isHidden: req.body.hidden, reason: req.body.reason, by: currentStaff(req).id, at: deps.now() } });
    await audit(req, { action: req.body.hidden ? 'trip.hide' : 'trip.unhide', targetType: 'trip', targetId: t._id.toString(), reason: req.body.reason });
    res.status(204).end();
  });
  r.delete('/trips/:id', requirePermission('parcels.moderate'), validate(reasonOnlySchema), async (req, res) => {
    const t = await services.trips.load(idParam(req));
    await TripModel.updateOne({ _id: t._id }, { status: 'cancelled', hidden: { isHidden: true, reason: req.body.reason, by: currentStaff(req).id, at: deps.now() } });
    await audit(req, { action: 'trip.delete', targetType: 'trip', targetId: t._id.toString(), reason: req.body.reason, before: { status: t.status } });
    res.status(204).end();
  });

  // --- Réglages (super-administrateur) ----------------------------------------------------------
  r.get('/settings', requirePermission('settings.manage'), async (_req, res) => {
    res.json(await deps.settings.getAll());
  });
  r.put('/settings/:key', requirePermission('settings.manage'), async (req, res) => {
    const key = String(req.params.key) as AppSettingKey;
    if (!APP_SETTING_KEYS.includes(key)) throw new AppError(404, 'NOT_FOUND', 'Réglage inconnu');
    const body = z.object({ value: APP_SETTING_SCHEMAS[key], reason: reasonSchema }).parse(req.body);
    const before = (await deps.settings.getAll())[key];
    await AppSettingModel.updateOne(
      { key },
      { $set: { value: body.value, updatedBy: currentStaff(req).id } },
      { upsert: true },
    );
    await audit(req, { action: 'settings.update', targetType: 'setting', targetId: key, reason: body.reason, before, after: body.value });
    await deps.bus.emit('settings.updated', { key });
    res.json(await deps.settings.getAll());
  });

  // --- Staff (super-administrateur) -------------------------------------------------------------
  r.get('/staff', requirePermission('staff.manage'), async (_req, res) => {
    res.json(await staffService.list());
  });
  r.post('/staff/invite', requirePermission('staff.manage'), validate(inviteStaffSchema), async (req, res) => {
    const result = await staffService.invite(req.body, currentStaff(req).id);
    await audit(req, { action: 'staff.invite', targetType: 'staff', targetId: result.staff.id, after: { email: req.body.email, permissions: result.staff.permissions } });
    res.status(201).json(result.staff);
  });
  r.patch('/staff/:id', requirePermission('staff.manage'), validate(updateStaffSchema), async (req, res) => {
    const change = await staffService.setPermissions(idParam(req), req.body.permissions, currentStaff(req).id);
    await audit(req, { action: 'staff.permissions', targetType: 'staff', targetId: idParam(req), reason: req.body.reason, ...change });
    res.json((await staffService.list()).items.find((s) => s.id === idParam(req)));
  });
  r.post('/staff/:id/disable', requirePermission('staff.manage'), validate(reasonOnlySchema), async (req, res) => {
    const change = await staffService.disable(idParam(req));
    await audit(req, { action: 'staff.disable', targetType: 'staff', targetId: idParam(req), reason: req.body.reason, ...change });
    res.status(204).end();
  });
  r.post('/staff/transfer-super-admin', requirePermission('staff.manage'), validate(transferSuperAdminSchema), async (req, res) => {
    const staff = currentStaff(req);
    if (staff.role !== 'super_admin') throw new AppError(403, 'PERMISSION_DENIED', 'Réservé au super-administrateur');
    await staffService.transferSuperAdmin(staff.id, req.body.toStaffId, req.body.password, req.body.totp);
    await audit(req, { action: 'staff.transfer_super_admin', targetType: 'staff', targetId: req.body.toStaffId, reason: req.body.reason });
    res.status(204).end();
  });

  // --- Journal d'audit (super-administrateur) ---------------------------------------------------
  const auditFilter = (q: z.infer<typeof auditQuerySchema>) => {
    const f: FilterQuery<AuditLean> = {};
    if (q.actor) f.actor = q.actor;
    if (q.action) f.action = q.action;
    if (q.targetType) f.targetType = q.targetType;
    if (q.targetId) f.targetId = q.targetId;
    if (q.from || q.to) f.createdAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    return f;
  };
  const auditRows = async (entries: AuditLean[]) => {
    const staff = await StaffModel.find({ _id: { $in: entries.map((e) => e.actor) } }, { email: 1, firstName: 1, lastName: 1 }).lean();
    const names = new Map(staff.map((s) => [s._id.toString(), `${s.firstName} ${s.lastName} <${s.email}>`]));
    return entries.map((e) => ({
      id: e._id.toString(),
      at: e.createdAt,
      actor: names.get(e.actor.toString()) ?? e.actor.toString(),
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      reason: e.reason,
      before: e.before,
      after: e.after,
      ip: e.ip,
    }));
  };
  r.get('/audit', requirePermission('audit.view'), validate(auditQuerySchema, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof auditQuerySchema>>(req);
    const f = auditFilter(q);
    const [total, entries] = await Promise.all([
      AuditLogModel.countDocuments(f),
      AuditLogModel.find(f).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    res.json(paginate(await auditRows(entries as AuditLean[]), q.page, q.limit, total));
  });
  r.get('/audit/export', requirePermission('audit.view'), validate(auditQuerySchema, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof auditQuerySchema>>(req);
    const entries = (await AuditLogModel.find(auditFilter(q)).sort({ createdAt: -1 }).limit(50_000).lean()) as AuditLean[];
    const rows = (await auditRows(entries)).map((e) => ({ ...e, before: JSON.stringify(e.before), after: JSON.stringify(e.after) }));
    sendCsv(res, 'audit.csv', ['at', 'actor', 'action', 'targetType', 'targetId', 'reason', 'before', 'after', 'ip'], rows);
  });

  r.use(trustAdminRoutes(deps, services, claims));
  r.use(proAdminRoutes(services.pro, claims));
  r.use(contentAdminRoutes(deps, services.content));

  return { router: r, claims, staffService };
}
