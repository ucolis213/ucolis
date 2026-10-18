import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import {
  MANDATORY_CATEGORIES,
  isOwnedUpload,
  type FileRef,
  type PreferencesInput,
  type UpdateMeInput,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { OtpCodeModel } from '../auth/model';
import type { OtpService } from '../auth/otp';
import type { SessionService } from '../auth/sessions';
import { duplicateKeyError } from '../auth/service';
import { PushTokenModel } from '../push/model';
import { UserModel, type UserLean } from '../users/model';
import { toMe, toUserSummary } from '../users/serializers';

export function createMeService(deps: Deps, otp: OtpService, sessions: SessionService) {
  async function load(userId: string): Promise<UserLean> {
    const user = (await UserModel.findById(userId).lean()) as UserLean | null;
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable');
    return user;
  }

  async function update(userId: string, set: Record<string, unknown>) {
    try {
      const user = await UserModel.findByIdAndUpdate(userId, { $set: set }, { new: true, runValidators: true }).lean();
      return toMe(user as UserLean);
    } catch (err) {
      throw duplicateKeyError(err) ?? err;
    }
  }

  return {
    async get(userId: string) {
      return toMe(await load(userId));
    },

    async updateProfile(userId: string, input: UpdateMeInput) {
      const set: Record<string, unknown> = {};
      for (const key of ['firstName', 'lastName', 'phone', 'bio', 'intent'] as const) {
        if (input[key] !== undefined) set[key] = input[key];
      }
      if (input.place) {
        set.wilayaCode = input.place.wilayaCode;
        set.commune = input.place.commune;
      }
      if (input.phone && (await UserModel.exists({ phone: input.phone, _id: { $ne: userId } }))) {
        throw new AppError(409, 'PHONE_TAKEN', 'Téléphone déjà utilisé');
      }
      return update(userId, set);
    },

    async setAvatar(userId: string, avatar: FileRef | null) {
      if (avatar && !isOwnedUpload(avatar.publicId, 'avatar', userId)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Fichier invalide');
      }
      return update(userId, { avatar });
    },

    async changePassword(userId: string, current: string, next: string, deviceId?: string) {
      const user = await UserModel.findById(userId).select('+passwordHash');
      if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
        throw new AppError(400, 'INVALID_CREDENTIALS', 'Mot de passe actuel incorrect');
      }
      user.passwordHash = await bcrypt.hash(next, deps.config.bcryptCost);
      await user.save();
      await sessions.revokeAll(userId, deviceId);
      await deps.bus.emit('user.sessions_revoked', { userId, reason: 'password_changed' });
    },

    /** L'ancienne adresse reste active jusqu'à la saisie du code envoyé à la nouvelle. */
    async requestEmailChange(userId: string, email: string) {
      const user = await load(userId);
      if (user.email === email) throw new AppError(400, 'VALIDATION_ERROR', 'Adresse identique');
      if (await UserModel.exists({ email })) throw new AppError(409, 'EMAIL_TAKEN', 'Email déjà utilisé');
      await otp.issue({
        email,
        purpose: 'change_email',
        name: user.firstName,
        locale: user.preferences?.language ?? 'fr',
        user: user._id,
      });
    },

    async confirmEmailChange(userId: string, code: string) {
      const pending = await OtpCodeModel.findOne({ user: userId, purpose: 'change_email' })
        .sort({ sentAt: -1 })
        .lean();
      if (!pending) throw new AppError(400, 'INVALID_CODE', 'Aucun changement en attente');
      await otp.verify(pending.email, 'change_email', code);
      if (await UserModel.exists({ email: pending.email, _id: { $ne: userId } })) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Email déjà utilisé');
      }
      return update(userId, { email: pending.email, emailVerifiedAt: deps.now() });
    },

    async updatePreferences(userId: string, input: PreferencesInput) {
      const set: Record<string, unknown> = {};
      if (input.language) set['preferences.language'] = input.language;
      for (const [category, enabled] of Object.entries(input.notifications ?? {})) {
        // La catégorie Compte et vérification ne se désactive pas.
        const forced = MANDATORY_CATEGORIES.includes(category as never);
        set[`preferences.notifications.${category}`] = forced ? true : enabled;
      }
      return update(userId, set);
    },

    async acceptTerms(userId: string, version: string) {
      return update(userId, { terms: { version, acceptedAt: deps.now() } });
    },

    listSessions: (userId: string, deviceId?: string) => sessions.list(userId, deviceId),

    async revokeSession(userId: string, familyId: string) {
      if (!(await sessions.revokeFamily(userId, familyId))) {
        throw new AppError(404, 'NOT_FOUND', 'Session introuvable');
      }
      await deps.bus.emit('user.sessions_revoked', { userId, reason: 'remote_logout' });
    },

    async revokeOtherSessions(userId: string, deviceId?: string) {
      await sessions.revokeAll(userId, deviceId);
      await deps.bus.emit('user.sessions_revoked', { userId, reason: 'remote_logout' });
    },

    async registerPushToken(
      userId: string,
      input: { token: string; platform: 'ios' | 'android'; deviceId: string; appVersion?: string },
    ) {
      await PushTokenModel.updateOne(
        { token: input.token },
        { $set: { ...input, user: userId, lastUsedAt: deps.now() } },
        { upsert: true },
      );
    },

    async removePushToken(userId: string, token: string) {
      await PushTokenModel.deleteOne({ token, user: userId });
    },

    async listBlocked(userId: string) {
      const user = await load(userId);
      const blocked = await UserModel.find({ _id: { $in: user.blockedUsers } }).lean();
      return blocked.map((u) => toUserSummary(u as UserLean));
    },

    async block(userId: string, targetId: string) {
      if (userId === targetId) throw new AppError(400, 'VALIDATION_ERROR', 'Impossible de se bloquer');
      if (!(await UserModel.exists({ _id: targetId }))) throw new AppError(404, 'NOT_FOUND', 'Introuvable');
      await UserModel.updateOne({ _id: userId }, { $addToSet: { blockedUsers: new Types.ObjectId(targetId) } });
    },

    async unblock(userId: string, targetId: string) {
      await UserModel.updateOne({ _id: userId }, { $pull: { blockedUsers: new Types.ObjectId(targetId) } });
    },
  };
}

export type MeService = ReturnType<typeof createMeService>;

/** Vrai si l'un des deux utilisateurs a bloqué l'autre. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const hit = await UserModel.exists({
    $or: [
      { _id: a, blockedUsers: new Types.ObjectId(b) },
      { _id: b, blockedUsers: new Types.ObjectId(a) },
    ],
  });
  return !!hit;
}
