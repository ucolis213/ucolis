// Comptes staff : connexion (mot de passe + TOTP), session glissante de 30 min, invitations (72 h),
// permissions et transfert du rôle de super-administrateur.

import bcrypt from 'bcryptjs';
import {
  PERMISSION_TEMPLATES,
  sanitizeModeratorPermissions,
  type Permission,
  type PermissionTemplate,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { decrypt, deriveKey, encrypt, hmac, randomToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { STAFF_ACCESS_TTL_SECONDS, signStaffToken } from '../../lib/staffAuth';
import { newTotpSecret, otpauthUrl, verifyTotp } from '../../lib/totp';
import { StaffModel, StaffSessionModel, type StaffLean } from './model';

export const STAFF_IDLE_MS = 30 * 60_000;
export const INVITE_TTL_MS = 72 * 3600_000;

export function toStaffDto(s: StaffLean) {
  return {
    id: s._id.toString(),
    email: s.email,
    firstName: s.firstName,
    lastName: s.lastName,
    role: s.role,
    permissions: s.permissions as Permission[],
    status: s.status,
    lastLoginAt: s.lastLoginAt ?? null,
    createdAt: s.createdAt,
  };
}

export function createStaffService(deps: Deps) {
  const totpKey = deriveKey(deps.config.deliveryCodeKey, 'staff-totp');
  const hashToken = (t: string) => hmac(deps.config.staffSecret, t);

  async function openSession(staffId: string, meta: { ip?: string; userAgent?: string }) {
    const refreshToken = randomToken();
    const now = deps.now();
    await StaffSessionModel.create({
      staff: staffId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(now.getTime() + STAFF_IDLE_MS),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      accessToken: signStaffToken(staffId, deps.config.staffSecret, now),
      accessTokenExpiresIn: STAFF_ACCESS_TTL_SECONDS,
      refreshToken,
    };
  }

  async function checkSecondFactor(staffId: string, code: string | undefined) {
    const s = await StaffModel.findById(staffId).select('+totpSecret').lean();
    if (!s?.totpSecret) throw new AppError(401, 'INVALID_CREDENTIALS', 'Double authentification non configurée');
    if (!code) throw new AppError(401, 'TOTP_REQUIRED', 'Code de double authentification requis');
    if (!verifyTotp(decrypt(totpKey, s.totpSecret), code, deps.now().getTime())) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Code incorrect');
    }
  }

  async function checkPassword(staffId: string, password: string) {
    const s = await StaffModel.findById(staffId).select('+passwordHash').lean();
    if (!s?.passwordHash || !(await bcrypt.compare(password, s.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects');
    }
  }

  return {
    encryptTotp: (secret: string) => encrypt(totpKey, secret),

    async login(email: string, password: string, totp: string | undefined, meta: { ip?: string; userAgent?: string }) {
      const s = await StaffModel.findOne({ email }).select('+passwordHash').lean();
      const ok = s?.passwordHash && s.status === 'active' && (await bcrypt.compare(password, s.passwordHash));
      if (!ok || !s) throw new AppError(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects');
      await checkSecondFactor(s._id.toString(), totp);
      await StaffModel.updateOne({ _id: s._id }, { lastLoginAt: deps.now() });
      return { ...(await openSession(s._id.toString(), meta)), staff: toStaffDto(s) };
    },

    /** Rotation et prolongation de la fenêtre d'inactivité de 30 min. */
    async refresh(refreshToken: string) {
      const now = deps.now();
      const session = await StaffSessionModel.findOne({ tokenHash: hashToken(refreshToken) });
      if (!session || session.revokedAt || session.expiresAt <= now) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Session expirée');
      }
      const staff = await StaffModel.findById(session.staff).lean();
      if (!staff || staff.status !== 'active') throw new AppError(401, 'UNAUTHENTICATED', 'Compte inactif');
      session.revokedAt = now;
      await session.save();
      return openSession(staff._id.toString(), { ip: session.ip ?? undefined, userAgent: session.userAgent ?? undefined });
    },

    async logout(refreshToken: string) {
      await StaffSessionModel.updateOne({ tokenHash: hashToken(refreshToken) }, { revokedAt: deps.now() });
    },

    async me(staffId: string) {
      return toStaffDto((await StaffModel.findById(staffId).lean()) as StaffLean);
    },

    async list() {
      const all = (await StaffModel.find().sort({ role: -1, createdAt: 1 }).lean()) as StaffLean[];
      return { items: all.map(toStaffDto) };
    },

    /** Seul le super-administrateur invite ; le lien reste valable 72 h. */
    async invite(input: {
      email: string;
      firstName: string;
      lastName: string;
      template?: PermissionTemplate;
      permissions: Permission[];
    }, invitedBy: string) {
      if (await StaffModel.exists({ email: input.email })) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Email déjà utilisé');
      }
      const base = input.template ? [...PERMISSION_TEMPLATES[input.template]] : [];
      const permissions = sanitizeModeratorPermissions([...base, ...input.permissions]);
      const token = randomToken(32);
      const staff = await StaffModel.create({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'moderator',
        permissions,
        status: 'invited',
        inviteTokenHash: hashToken(token),
        inviteExpiresAt: new Date(deps.now().getTime() + INVITE_TTL_MS),
        invitedBy,
      });
      const link = `${deps.config.adminUrl}/accept-invite/${token}`;
      await deps.mailer.send({
        to: input.email,
        subject: 'Invitation au back-office UCOLIS',
        text: `Bonjour ${input.firstName},\n\nVous êtes invité(e) à rejoindre le back-office UCOLIS. Ce lien est valable 72 heures :\n${link}\n\nVous y définirez votre mot de passe et la double authentification.`,
      });
      return { staff: toStaffDto(staff.toObject() as StaffLean), link };
    },

    /** Prépare la 2FA : renvoie le secret à scanner (stocké chiffré en attente de confirmation). */
    async inviteInfo(token: string) {
      const s = await StaffModel.findOne({ inviteTokenHash: hashToken(token), status: 'invited' });
      if (!s || !s.inviteExpiresAt || s.inviteExpiresAt <= deps.now()) {
        throw new AppError(404, 'NOT_FOUND', 'Invitation invalide ou expirée');
      }
      const secret = newTotpSecret();
      s.set('totpSecret', encrypt(totpKey, secret));
      await s.save();
      return { email: s.email, firstName: s.firstName, secret, otpauthUrl: otpauthUrl(secret, s.email) };
    },

    async acceptInvite(token: string, password: string, totp: string) {
      const s = await StaffModel.findOne({ inviteTokenHash: hashToken(token), status: 'invited' });
      if (!s || !s.inviteExpiresAt || s.inviteExpiresAt <= deps.now()) {
        throw new AppError(404, 'NOT_FOUND', 'Invitation invalide ou expirée');
      }
      await checkSecondFactor(s.id, totp);
      s.set('passwordHash', await bcrypt.hash(password, deps.config.bcryptCost));
      s.status = 'active';
      s.inviteTokenHash = null;
      s.inviteExpiresAt = null;
      await s.save();
      return toStaffDto(s.toObject() as StaffLean);
    },

    async setPermissions(targetId: string, permissions: Permission[], actorId: string) {
      if (targetId === actorId) throw new AppError(403, 'FORBIDDEN', 'Impossible de modifier ses propres permissions');
      const target = await StaffModel.findById(targetId).lean();
      if (!target) throw new AppError(404, 'NOT_FOUND', 'Membre introuvable');
      if (target.role === 'super_admin') throw new AppError(403, 'FORBIDDEN', 'Le super-administrateur a toutes les permissions');
      const clean = sanitizeModeratorPermissions(permissions);
      await StaffModel.updateOne({ _id: targetId }, { permissions: clean });
      return { before: target.permissions, after: clean };
    },

    async disable(targetId: string) {
      const target = await StaffModel.findById(targetId).lean();
      if (!target) throw new AppError(404, 'NOT_FOUND', 'Membre introuvable');
      if (target.role === 'super_admin') throw new AppError(403, 'FORBIDDEN', 'Le super-administrateur ne peut pas être désactivé');
      await StaffModel.updateOne({ _id: targetId }, { status: 'disabled' });
      await StaffSessionModel.updateMany({ staff: targetId, revokedAt: null }, { revokedAt: deps.now() });
      return { before: target.status, after: 'disabled' };
    },

    /** Transfert à un modérateur actif, après confirmation par mot de passe et code 2FA. */
    async transferSuperAdmin(actorId: string, toStaffId: string, password: string, totp: string) {
      await checkPassword(actorId, password);
      await checkSecondFactor(actorId, totp);
      const target = await StaffModel.findById(toStaffId).lean();
      if (!target || target.status !== 'active' || target.role !== 'moderator') {
        throw new AppError(422, 'VALIDATION_ERROR', 'Le destinataire doit être un modérateur actif');
      }
      const session = await StaffModel.startSession();
      try {
        await session.withTransaction(async () => {
          await StaffModel.updateOne({ _id: actorId }, { role: 'moderator', permissions: [] }, { session });
          await StaffModel.updateOne({ _id: toStaffId }, { role: 'super_admin', permissions: [] }, { session });
        });
      } finally {
        await session.endSession();
      }
    },
  };
}

export type StaffService = ReturnType<typeof createStaffService>;
