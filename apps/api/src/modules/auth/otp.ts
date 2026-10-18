// Codes à 6 chiffres envoyés par email : 15 min de validité, 5 essais, renvoi après 60 s, 5 envois par heure.

import type { Types } from 'mongoose';
import { translate, type Locale, type OtpPurpose } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { hmac, randomDigits, safeEqual } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { LIMITS, consume } from '../../lib/rateLimit';
import { OtpCodeModel } from './model';

export const OTP_TTL_MS = 15 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_DELAY_MS = 60_000;

export function createOtpService(deps: Deps) {
  const sendLimiter = deps.limiters('otp-send', LIMITS.otpSend);
  const hash = (email: string, purpose: string, code: string) =>
    hmac(deps.config.refreshSecret, `${purpose}:${email}:${code}`);

  return {
    /** Remplace tout code précédent. Lève 429 si le délai de renvoi ou le quota horaire n'est pas respecté. */
    async issue(opts: {
      email: string;
      purpose: OtpPurpose;
      name: string;
      locale: Locale;
      user?: Types.ObjectId | string;
    }) {
      const now = deps.now();
      const previous = await OtpCodeModel.findOne({ email: opts.email, purpose: opts.purpose })
        .sort({ sentAt: -1 })
        .lean();
      if (previous && now.getTime() - previous.sentAt.getTime() < OTP_RESEND_DELAY_MS) {
        const wait = OTP_RESEND_DELAY_MS - (now.getTime() - previous.sentAt.getTime());
        throw new AppError(429, 'RATE_LIMITED', 'Patientez avant de redemander un code', {
          retryAfterSeconds: Math.ceil(wait / 1000),
        });
      }
      await consume(sendLimiter, `${opts.purpose}:${opts.email}`);

      const code = randomDigits(6);
      await OtpCodeModel.deleteMany({ email: opts.email, purpose: opts.purpose });
      await OtpCodeModel.create({
        email: opts.email,
        purpose: opts.purpose,
        codeHash: hash(opts.email, opts.purpose, code),
        user: opts.user ?? null,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        sentAt: now,
      });
      const params = { code, name: opts.name };
      await deps.mailer.send({
        to: opts.email,
        subject: translate(opts.locale, `auth.emails.${opts.purpose}.subject`, params),
        text: translate(opts.locale, `auth.emails.${opts.purpose}.body`, params),
      });
    },

    /** Vérifie et consomme le code. Renvoie le document (pour change_email : l'utilisateur d'origine). */
    async verify(email: string, purpose: OtpPurpose, code: string) {
      const otp = await OtpCodeModel.findOne({ email, purpose }).sort({ sentAt: -1 });
      if (!otp) throw new AppError(400, 'INVALID_CODE', 'Code incorrect');
      if (otp.expiresAt.getTime() <= deps.now().getTime()) {
        throw new AppError(400, 'CODE_EXPIRED', 'Code expiré');
      }
      if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop d’essais');
      }
      if (!safeEqual(otp.codeHash, hash(email, purpose, code))) {
        otp.attempts += 1;
        await otp.save();
        throw new AppError(
          otp.attempts >= OTP_MAX_ATTEMPTS ? 429 : 400,
          otp.attempts >= OTP_MAX_ATTEMPTS ? 'TOO_MANY_ATTEMPTS' : 'INVALID_CODE',
          'Code incorrect',
          { attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts) },
        );
      }
      await OtpCodeModel.deleteMany({ email, purpose });
      return otp;
    },
  };
}

export type OtpService = ReturnType<typeof createOtpService>;
