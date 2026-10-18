// Utilisateurs côté staff. Masquage dans l'API : sans users.view_pii, email et téléphone masqués,
// y compris dans les exports. Chaque affichage en clair est journalisé.

import type { FilterQuery } from 'mongoose';
import { hasPermission, maskEmail, maskPhone } from '@ucolis/shared';
import type { Request } from 'express';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import type { StaffContext } from '../../lib/staffAuth';
import { RefreshTokenModel } from '../auth/model';
import { OfferModel } from '../offers/model';
import { ParcelModel } from '../parcels/model';
import { normalizeSearch } from '../parcels/service';
import { DisputeModel, ReportModel, ReviewModel } from '../trust/model';
import { anonymizeUser } from '../users/anonymize';
import { UserModel, accountTypeOf, type UserLean } from '../users/model';
import { successRate } from '../users/serializers';

export const canSeePii = (staff: StaffContext) => hasPermission(staff, 'users.view_pii');

export function adminUserRow(u: UserLean, pii: boolean) {
  return {
    id: u._id.toString(),
    firstName: u.firstName,
    lastName: u.lastName,
    email: pii ? u.email : maskEmail(u.email),
    phone: pii ? u.phone : maskPhone(u.phone),
    wilayaCode: u.wilayaCode,
    commune: u.commune,
    intent: u.intent,
    accountType: accountTypeOf(u),
    status: u.status,
    emailVerified: !!u.emailVerifiedAt,
    carrierVerification: u.carrierVerification?.status ?? 'not_submitted',
    proStatus: u.pro?.status ?? 'none',
    companyName: u.pro?.companyName ?? null,
    rating: { average: u.rating?.average ?? 0, count: u.rating?.count ?? 0 },
    stats: { ...u.stats, successRate: successRate(u.stats) },
    suspension: u.status === 'suspended' ? u.suspension : null,
    lastSeenAt: u.lastSeenAt ?? null,
    createdAt: u.createdAt,
  };
}

export const USER_CSV_COLUMNS = [
  'id', 'firstName', 'lastName', 'email', 'phone', 'wilayaCode', 'intent', 'accountType', 'status',
  'emailVerified', 'carrierVerification', 'proStatus', 'createdAt',
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createUsersAdmin(deps: Deps) {
  return {
    async list(
      req: Request,
      q: { page: number; limit: number; q?: string; status?: string; intent?: string; accountType?: string; wilayaCode?: string; verified?: boolean },
      all = false,
    ) {
      const staff = req.staff!;
      const filter: FilterQuery<UserLean> = {};
      if (q.status) filter.status = q.status;
      if (q.intent) filter.intent = q.intent;
      if (q.wilayaCode) filter.wilayaCode = q.wilayaCode;
      if (q.accountType) filter['pro.status'] = q.accountType === 'professional' ? 'approved' : { $ne: 'approved' };
      if (q.verified !== undefined) {
        filter['carrierVerification.status'] = q.verified ? 'approved' : { $ne: 'approved' };
      }
      if (q.q) {
        const rx = new RegExp(escapeRegex(normalizeSearch(q.q)), 'i');
        const raw = new RegExp(escapeRegex(q.q.trim()), 'i');
        // La recherche par email ou téléphone reste réservée à users.view_pii.
        filter.$or = [
          { firstName: raw },
          { lastName: raw },
          { 'pro.companyName': raw },
          ...(canSeePii(staff) ? [{ email: rx }, { phone: raw }] : []),
        ];
      }
      const total = await UserModel.countDocuments(filter);
      const query = UserModel.find(filter).sort({ createdAt: -1 });
      if (!all) query.skip((q.page - 1) * q.limit).limit(q.limit);
      else query.limit(10_000);
      const users = (await query.lean()) as UserLean[];
      const pii = canSeePii(staff);
      if (pii) await audit(req, { action: 'user.view_pii', targetType: 'users', reason: 'liste' });
      return paginate(users.map((u) => adminUserRow(u, pii)), q.page, q.limit, total);
    },

    async detail(req: Request, userId: string) {
      const u = (await UserModel.findById(userId).lean()) as UserLean | null;
      if (!u) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
      const pii = canSeePii(req.staff!);
      if (pii) await audit(req, { action: 'user.view_pii', targetType: 'user', targetId: userId, reason: 'fiche' });
      const [parcels, offers, devices] = await Promise.all([
        ParcelModel.find({ $or: [{ sender: userId }, { assignedCarrier: userId }] })
          .sort({ createdAt: -1 })
          .limit(30)
          .lean(),
        OfferModel.find({ carrier: userId }).sort({ createdAt: -1 }).limit(30).lean(),
        RefreshTokenModel.find({ user: userId, revokedAt: null, expiresAt: { $gt: deps.now() } }).lean(),
      ]);
      return {
        user: { ...adminUserRow(u, pii), bio: u.bio, vehicles: u.vehicles ?? [], badges: { pro: u.pro?.status === 'approved', identity: u.carrierVerification?.status === 'approved' } },
        parcels: parcels.map((p) => ({
          id: p._id.toString(),
          reference: p.reference,
          title: p.title,
          status: p.status,
          role: p.sender.toString() === userId ? 'sender' : 'carrier',
          price: p.finalPrice ?? p.requestedPrice,
          createdAt: p.createdAt,
        })),
        offers: offers.map((o) => ({ id: o._id.toString(), parcelId: o.parcel.toString(), price: o.price, status: o.status, createdAt: o.createdAt })),
        devices: devices.map((d) => ({ id: d.familyId, deviceName: d.deviceName, platform: d.platform, lastActiveAt: d.lastUsedAt })),
        ...(await adminUserExtras(userId)),
      };
    },

    async suspend(req: Request, userId: string, reason: string, until: Date | null | undefined) {
      const u = await UserModel.findById(userId).lean();
      if (!u) throw new AppError(404, 'NOT_FOUND', 'Utilisateur introuvable');
      if (u.status === 'deleted') throw new AppError(409, 'INVALID_TRANSITION', 'Compte supprimé');
      const now = deps.now();
      const suspension = { reason, until: until ?? null, by: req.staff!.id, at: now };
      await UserModel.updateOne({ _id: userId }, { status: 'suspended', suspension });
      // Sessions révoquées et sockets coupés immédiatement.
      await RefreshTokenModel.updateMany({ user: userId, revokedAt: null }, { revokedAt: now });
      await audit(req, { action: 'user.suspend', targetType: 'user', targetId: userId, reason, before: { status: u.status }, after: { status: 'suspended', until: until ?? null } });
      await deps.bus.emit('user.suspended', { userId, reason });
    },

    async reactivate(req: Request, userId: string, reason: string) {
      const u = await UserModel.findById(userId).lean();
      if (!u || u.status !== 'suspended') throw new AppError(409, 'INVALID_TRANSITION', 'Compte non suspendu');
      await UserModel.updateOne({ _id: userId }, { status: 'active', suspension: { reason: null, until: null, by: null, at: null } });
      await audit(req, { action: 'user.reactivate', targetType: 'user', targetId: userId, reason, before: { status: 'suspended' }, after: { status: 'active' } });
    },

    async remove(req: Request, userId: string, reason: string) {
      await anonymizeUser(deps, userId);
      await audit(req, { action: 'user.delete', targetType: 'user', targetId: userId, reason });
    },
  };
}

/** Avis, signalements et litiges d'un utilisateur (complétés au lot 7). */
async function adminUserExtras(userId: string): Promise<Record<string, unknown>> {
  const [reviews, reports, disputes] = await Promise.all([
    ReviewModel.find({ $or: [{ author: userId }, { target: userId }] }).sort({ createdAt: -1 }).limit(30).lean(),
    ReportModel.find({ $or: [{ reporter: userId }, { targetType: 'user', targetId: userId }] }).sort({ createdAt: -1 }).limit(30).lean(),
    DisputeModel.find({ $or: [{ openedBy: userId }, { against: userId }] }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  return {
    reviews: reviews.map((r) => ({ id: r._id.toString(), rating: r.rating, comment: r.comment, direction: r.direction, mine: r.author.toString() === userId, hidden: !!r.hidden?.isHidden, publishedAt: r.publishedAt })),
    reports: reports.map((r) => ({ id: r._id.toString(), reason: r.reason, status: r.status, against: r.targetType === 'user' && r.targetId.toString() === userId, createdAt: r.createdAt })),
    disputes: disputes.map((d) => ({ id: d._id.toString(), parcelId: d.parcel.toString(), reason: d.reason, status: d.status, outcome: d.outcome, createdAt: d.createdAt })),
  };
}
