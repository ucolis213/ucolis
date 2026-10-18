import type { Request } from 'express';
import { isValidObjectId } from 'mongoose';
import { LOCALES, type Locale } from '@ucolis/shared';
import { AppError } from './errors';

/** Langue de la requête : préférence de l'utilisateur, sinon Accept-Language, sinon français. */
export function requestLocale(req: Request): Locale {
  const pref = req.auth?.user.preferences?.language;
  if (pref) return pref;
  const header = req.headers['accept-language']?.slice(0, 2).toLowerCase();
  return LOCALES.includes(header as Locale) ? (header as Locale) : 'fr';
}

export const clientIp = (req: Request) => req.ip ?? 'unknown';

/** Paramètre de route ObjectId ; 404 s'il est mal formé. */
export function idParam(req: Request, name = 'id'): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !isValidObjectId(value)) {
    throw new AppError(404, 'NOT_FOUND', 'Introuvable');
  }
  return value;
}

/** Données validées par validate(schema, 'query'). */
export function validQuery<T>(req: Request): T {
  return (req.validated?.query ?? {}) as T;
}

export function paginate<T>(items: T[], page: number, limit: number, total: number) {
  return { items, page, limit, total, hasMore: page * limit < total };
}
