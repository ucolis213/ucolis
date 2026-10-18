// Authentification du staff : jeton distinct (STAFF_JWT_SECRET), permissions vérifiées côté API.

import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { hasAnyPermission, type Permission, type StaffRole } from '@ucolis/shared';
import { StaffModel } from '../modules/admin/model';
import { AppError } from './errors';

export const STAFF_ACCESS_TTL_SECONDS = 10 * 60;

export interface StaffContext {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  permissions: Permission[];
}

declare module 'express-serve-static-core' {
  interface Request {
    staff?: StaffContext;
  }
}

export function signStaffToken(staffId: string, secret: string, now: Date) {
  return jwt.sign({ typ: 'staff', iat: Math.floor(now.getTime() / 1000) }, secret, {
    subject: staffId,
    expiresIn: STAFF_ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

export function authenticateStaff(secret: string, now: () => Date): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHENTICATED', 'Authentification requise');
      let staffId: string;
      try {
        const p = jwt.verify(header.slice(7), secret, {
          algorithms: ['HS256'],
          clockTimestamp: Math.floor(now().getTime() / 1000),
        }) as jwt.JwtPayload;
        if (p.typ !== 'staff' || !p.sub) throw new Error('typ');
        staffId = p.sub;
      } catch {
        throw new AppError(401, 'UNAUTHENTICATED', 'Jeton invalide ou expiré');
      }
      if (!isValidObjectId(staffId)) throw new AppError(401, 'UNAUTHENTICATED', 'Jeton invalide');
      const s = await StaffModel.findById(staffId).lean();
      if (!s || s.status !== 'active') throw new AppError(401, 'UNAUTHENTICATED', 'Compte staff inactif');
      req.staff = {
        id: staffId,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        role: s.role,
        permissions: s.permissions as Permission[],
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Au moins une des permissions (le super-administrateur les a toutes). */
export function requirePermission(...anyOf: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.staff || !hasAnyPermission(req.staff, anyOf)) {
      next(new AppError(403, 'PERMISSION_DENIED', 'Permission insuffisante', { required: anyOf }));
      return;
    }
    next();
  };
}

export function currentStaff(req: { staff?: StaffContext }): StaffContext {
  if (!req.staff) throw new AppError(401, 'UNAUTHENTICATED', 'Authentification requise');
  return req.staff;
}
