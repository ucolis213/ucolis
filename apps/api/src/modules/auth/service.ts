import bcrypt from 'bcryptjs';
import type { Locale, LoginInput, RegisterRequest } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { liftExpiredSuspension, suspendedError } from '../../lib/auth';
import { AppError } from '../../lib/errors';
import { PushTokenModel } from '../push/model';
import { UserModel, type UserLean } from '../users/model';
import { toMe } from '../users/serializers';
import { createOtpService } from './otp';
import { createSessionService, type DeviceInfo } from './sessions';

/** Échecs de connexion : 10 par IP et 5 par email sur 15 min, puis délai doublé à chaque échec. */
const FAIL_WINDOW_S = 15 * 60;
const IP_MAX_FAILS = 10;
const EMAIL_FREE_FAILS = 5;
const BASE_DELAY_S = 30;

interface FailCounter {
  count: number;
  lastAt: number;
}

export function duplicateKeyError(err: unknown): AppError | null {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (e?.code !== 11000) return null;
  if (e.keyPattern?.email) return new AppError(409, 'EMAIL_TAKEN', 'Email déjà utilisé');
  if (e.keyPattern?.phone) return new AppError(409, 'PHONE_TAKEN', 'Téléphone déjà utilisé');
  return null;
}

export function createAuthService(deps: Deps) {
  const otp = createOtpService(deps);
  const sessions = createSessionService(deps);

  const failKey = (kind: 'ip' | 'email', value: string) => `loginfail:${kind}:${value}`;

  async function assertNotThrottled(ip: string, email: string) {
    const now = deps.now().getTime();
    const ipFails = await deps.cache.get<FailCounter>(failKey('ip', ip));
    if (ipFails && ipFails.count >= IP_MAX_FAILS) {
      throw new AppError(429, 'RATE_LIMITED', 'Trop de tentatives', {
        retryAfterSeconds: Math.ceil((ipFails.lastAt + FAIL_WINDOW_S * 1000 - now) / 1000),
      });
    }
    const emailFails = await deps.cache.get<FailCounter>(failKey('email', email));
    if (emailFails && emailFails.count >= EMAIL_FREE_FAILS) {
      const delayS = Math.min(FAIL_WINDOW_S, BASE_DELAY_S * 2 ** (emailFails.count - EMAIL_FREE_FAILS));
      const waitMs = emailFails.lastAt + delayS * 1000 - now;
      if (waitMs > 0) {
        throw new AppError(429, 'RATE_LIMITED', 'Trop de tentatives', {
          retryAfterSeconds: Math.ceil(waitMs / 1000),
        });
      }
    }
  }

  async function recordFailure(ip: string, email: string) {
    const now = deps.now().getTime();
    for (const key of [failKey('ip', ip), failKey('email', email)]) {
      const prev = await deps.cache.get<FailCounter>(key);
      await deps.cache.set(key, { count: (prev?.count ?? 0) + 1, lastAt: now }, FAIL_WINDOW_S);
    }
  }

  const localeOf = (u: Pick<UserLean, 'preferences'>): Locale => u.preferences?.language ?? 'fr';

  return {
    otp,
    sessions,

    async register(input: RegisterRequest, ip: string, locale: Locale) {
      await assertNotThrottled(ip, input.email);
      const [emailTaken, phoneTaken] = await Promise.all([
        UserModel.exists({ email: input.email }),
        UserModel.exists({ phone: input.phone }),
      ]);
      if (emailTaken) throw new AppError(409, 'EMAIL_TAKEN', 'Email déjà utilisé');
      if (phoneTaken) throw new AppError(409, 'PHONE_TAKEN', 'Téléphone déjà utilisé');

      const passwordHash = await bcrypt.hash(input.password, deps.config.bcryptCost);
      let user;
      try {
        user = await UserModel.create({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          passwordHash,
          wilayaCode: input.place.wilayaCode,
          commune: input.place.commune,
          intent: input.intent,
          avatar: input.avatar ?? null,
          preferences: { language: locale },
          terms: { version: input.termsVersion, acceptedAt: deps.now() },
        });
      } catch (err) {
        throw duplicateKeyError(err) ?? err;
      }
      await otp.issue({
        email: user.email,
        purpose: 'verify_email',
        name: user.firstName,
        locale,
      });
      await deps.bus.emit('user.registered', { userId: user.id });
      const tokens = await sessions.open(user._id, input);
      return { ...tokens, user: toMe(user.toObject() as UserLean) };
    },

    async verifyEmail(email: string, code: string) {
      const user = await UserModel.findOne({ email });
      if (!user) throw new AppError(400, 'INVALID_CODE', 'Code incorrect');
      if (!user.emailVerifiedAt) {
        await otp.verify(email, 'verify_email', code);
        user.emailVerifiedAt = deps.now();
        await user.save();
      }
      return toMe(user.toObject() as UserLean);
    },

    /** Réponse identique que l'email existe ou non. */
    async resendCode(email: string) {
      const user = await UserModel.findOne({ email }).lean();
      if (!user || user.emailVerifiedAt) return;
      await otp.issue({ email, purpose: 'verify_email', name: user.firstName, locale: localeOf(user) });
    },

    async login(input: LoginInput, ip: string) {
      await assertNotThrottled(ip, input.email);
      const found = await UserModel.findOne({ email: input.email }).select('+passwordHash').lean();
      const ok =
        found && found.status !== 'deleted' && (await bcrypt.compare(input.password, found.passwordHash));
      if (!ok || !found) {
        await recordFailure(ip, input.email);
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects');
      }
      await deps.cache.del(failKey('email', input.email));

      let user = (await liftExpiredSuspension(found as UserLean, deps.now())) as UserLean;
      if (user.status === 'suspended') throw suspendedError(user);
      // Une reconnexion pendant le délai de grâce annule la suppression demandée.
      if (user.status === 'pending_deletion') {
        await UserModel.updateOne({ _id: user._id }, { status: 'active', deletionRequestedAt: null });
        user = { ...user, status: 'active', deletionRequestedAt: null };
      }
      const device: DeviceInfo = input;
      const tokens = await sessions.open(user._id, device);
      return { ...tokens, user: toMe(user) };
    },

    async refresh(refreshToken: string, deviceId: string) {
      const { userId, tokens } = await sessions.rotate(refreshToken, deviceId);
      let user = (await UserModel.findById(userId).lean()) as UserLean | null;
      if (!user || user.status === 'deleted') throw new AppError(401, 'UNAUTHENTICATED', 'Compte introuvable');
      user = await liftExpiredSuspension(user, deps.now());
      if (user.status === 'suspended') {
        await sessions.revokeAll(userId);
        throw suspendedError(user);
      }
      return tokens;
    },

    async logout(userId: string, deviceId: string) {
      await sessions.revokeDevice(userId, deviceId);
      await PushTokenModel.deleteMany({ user: userId, deviceId });
    },

    async forgotPassword(email: string) {
      const user = await UserModel.findOne({ email, status: { $ne: 'deleted' } }).lean();
      if (!user) return;
      try {
        await otp.issue({ email, purpose: 'reset_password', name: user.firstName, locale: localeOf(user) });
      } catch (err) {
        // Même réponse, même sous limitation : on ne révèle pas l'existence du compte.
        if (!(err instanceof AppError && err.status === 429)) throw err;
      }
    },

    async resetPassword(email: string, code: string, password: string) {
      const user = await UserModel.findOne({ email });
      if (!user) throw new AppError(400, 'INVALID_CODE', 'Code incorrect');
      await otp.verify(email, 'reset_password', code);
      user.passwordHash = await bcrypt.hash(password, deps.config.bcryptCost);
      // Le code a été reçu par email : l'adresse est donc vérifiée.
      user.emailVerifiedAt ??= deps.now();
      await user.save();
      await sessions.revokeAll(user.id);
      await deps.bus.emit('user.sessions_revoked', { userId: user.id, reason: 'password_reset' });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
