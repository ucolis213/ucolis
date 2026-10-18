// Jetons de rafraîchissement : opaques, 30 jours, stockés hachés, rotatifs, liés à un appareil.
// Un jeton déjà consommé qui revient révoque toute la famille de jetons de l'appareil.

import type { Types } from 'mongoose';
import type { Platform } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { signAccessToken, ACCESS_TOKEN_TTL_SECONDS } from '../../lib/auth';
import { hmac, randomToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { RefreshTokenModel } from './model';

export const REFRESH_TTL_MS = 30 * 24 * 3600_000;

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  platform?: Platform;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export function createSessionService(deps: Deps) {
  const hashToken = (token: string) => hmac(deps.config.refreshSecret, token);

  async function issue(userId: Types.ObjectId | string, device: DeviceInfo, familyId?: string) {
    const refreshToken = randomToken();
    const now = deps.now();
    const doc = await RefreshTokenModel.create({
      user: userId,
      tokenHash: hashToken(refreshToken),
      familyId: familyId ?? randomToken(16),
      deviceId: device.deviceId,
      deviceName: device.deviceName ?? null,
      platform: device.platform ?? null,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      lastUsedAt: now,
    });
    const tokens: SessionTokens = {
      accessToken: signAccessToken(userId.toString(), deps.config.accessSecret, now),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
    return { tokens, doc };
  }

  return {
    /** Nouvelle session ; les sessions précédentes du même appareil sont fermées. */
    async open(userId: Types.ObjectId | string, device: DeviceInfo) {
      await RefreshTokenModel.updateMany(
        { user: userId, deviceId: device.deviceId, revokedAt: null },
        { revokedAt: deps.now() },
      );
      return (await issue(userId, device)).tokens;
    },

    /** Rotation. Renvoie l'identifiant utilisateur et les nouveaux jetons. */
    async rotate(refreshToken: string, deviceId: string) {
      const now = deps.now();
      const current = await RefreshTokenModel.findOne({ tokenHash: hashToken(refreshToken) });
      if (!current) throw new AppError(401, 'UNAUTHENTICATED', 'Session inconnue');

      const reused = current.revokedAt !== null && current.replacedBy !== null;
      if (reused || current.deviceId !== deviceId) {
        await RefreshTokenModel.updateMany(
          { familyId: current.familyId, revokedAt: null },
          { revokedAt: now },
        );
        await deps.bus.emit('user.sessions_revoked', {
          userId: current.user.toString(),
          deviceId: current.deviceId,
          reason: 'token_reused',
        });
        throw new AppError(401, 'TOKEN_REUSED', 'Jeton déjà utilisé');
      }
      if (current.revokedAt || current.expiresAt <= now) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Session expirée');
      }

      const device = {
        deviceId: current.deviceId,
        deviceName: current.deviceName ?? undefined,
        platform: (current.platform ?? undefined) as Platform | undefined,
      };
      const next = await issue(current.user, device, current.familyId);
      // Mise à jour conditionnelle : deux rotations simultanées du même jeton n'en valident qu'une.
      const swapped = await RefreshTokenModel.updateOne(
        { _id: current._id, revokedAt: null },
        { revokedAt: now, replacedBy: next.doc._id, lastUsedAt: now },
      );
      if (swapped.modifiedCount === 0) {
        await RefreshTokenModel.deleteOne({ _id: next.doc._id });
        throw new AppError(401, 'TOKEN_REUSED', 'Jeton déjà utilisé');
      }
      return { userId: current.user.toString(), tokens: next.tokens };
    },

    async revokeDevice(userId: string, deviceId: string) {
      await RefreshTokenModel.updateMany(
        { user: userId, deviceId, revokedAt: null },
        { revokedAt: deps.now() },
      );
    },

    async revokeFamily(userId: string, familyId: string) {
      const res = await RefreshTokenModel.updateMany(
        { user: userId, familyId, revokedAt: null },
        { revokedAt: deps.now() },
      );
      return res.modifiedCount > 0;
    },

    /** Révoque toutes les sessions, sauf éventuellement celle de l'appareil courant. */
    async revokeAll(userId: string, exceptDeviceId?: string) {
      await RefreshTokenModel.updateMany(
        {
          user: userId,
          revokedAt: null,
          ...(exceptDeviceId ? { deviceId: { $ne: exceptDeviceId } } : {}),
        },
        { revokedAt: deps.now() },
      );
    },

    /** Appareils connectés : une ligne par famille encore active. */
    async list(userId: string, currentDeviceId?: string) {
      const active = await RefreshTokenModel.find({
        user: userId,
        revokedAt: null,
        expiresAt: { $gt: deps.now() },
      })
        .sort({ lastUsedAt: -1 })
        .lean();
      return active.map((t) => ({
        id: t.familyId,
        deviceName: t.deviceName,
        platform: t.platform,
        lastActiveAt: t.lastUsedAt,
        current: t.deviceId === currentDeviceId,
      }));
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
