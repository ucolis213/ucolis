// Authentification des utilisateurs : jeton d'accès JWT de 15 min, utilisateur rechargé à chaque requête
// pour qu'une suspension prenne effet immédiatement.

import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { UserModel, type UserLean } from '../modules/users/model';
import { AppError } from './errors';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export function signAccessToken(userId: string, secret: string, now = new Date()): string {
  return jwt.sign({ typ: 'user', iat: Math.floor(now.getTime() / 1000) }, secret, {
    subject: userId,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string, secret: string, now = new Date()): string | null {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      clockTimestamp: Math.floor(now.getTime() / 1000),
    }) as jwt.JwtPayload;
    return payload.typ === 'user' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export interface AuthContext {
  userId: string;
  user: UserLean;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

export function suspendedError(user: Pick<UserLean, 'suspension'>) {
  return new AppError(403, 'ACCOUNT_SUSPENDED', 'Compte suspendu', {
    reason: user.suspension?.reason ?? null,
    until: user.suspension?.until ?? null,
  });
}

/** Une suspension à durée échue est levée à la volée. */
export async function liftExpiredSuspension(user: UserLean, now: Date): Promise<UserLean> {
  if (user.status === 'suspended' && user.suspension?.until && user.suspension.until <= now) {
    await UserModel.updateOne({ _id: user._id }, { status: 'active' });
    return { ...user, status: 'active' };
  }
  return user;
}

/**
 * Charge l'utilisateur à partir du jeton Bearer.
 * optional : une requête sans jeton passe (routes publiques qui personnalisent la réponse).
 */
export function authenticate(
  secret: string,
  opts: { optional?: boolean; now?: () => Date } = {},
): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        if (opts.optional) return next();
        throw new AppError(401, 'UNAUTHENTICATED', 'Authentification requise');
      }
      const now = opts.now?.() ?? new Date();
      const userId = verifyAccessToken(header.slice(7), secret, now);
      if (!userId || !isValidObjectId(userId)) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Jeton invalide ou expiré');
      }
      let user = (await UserModel.findById(userId).lean()) as UserLean | null;
      if (!user || user.status === 'deleted') {
        throw new AppError(401, 'UNAUTHENTICATED', 'Compte introuvable');
      }
      user = await liftExpiredSuspension(user, now);
      if (user.status === 'suspended') throw suspendedError(user);
      // Activité : mise à jour au plus une fois par minute.
      if (!user.lastSeenAt || now.getTime() - new Date(user.lastSeenAt).getTime() > 60_000) {
        void UserModel.updateOne({ _id: userId }, { lastSeenAt: now }).catch(() => undefined);
      }
      req.auth = { userId, user };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireEmailVerified: RequestHandler = (req, _res, next) => {
  if (!req.auth?.user.emailVerifiedAt) {
    next(new AppError(403, 'EMAIL_NOT_VERIFIED', 'Email non vérifié'));
    return;
  }
  next();
};

/** Accès à l'utilisateur authentifié dans un contrôleur (lève si la route a oublié authenticate). */
export function currentUser(req: { auth?: AuthContext }): AuthContext {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentification requise');
  return req.auth;
}
