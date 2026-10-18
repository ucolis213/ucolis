// Refuse tout opérateur MongoDB dans les entrées (clés commençant par « $ » ou contenant un point).
// Remplace express-mongo-sanitize, incompatible avec Express 5 (req.query en lecture seule).

import type { RequestHandler } from 'express';
import { AppError } from './errors';

export function hasMongoOperator(value: unknown, depth = 0): boolean {
  if (depth > 20 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => hasMongoOperator(v, depth + 1));
  return Object.entries(value).some(
    ([k, v]) => k.startsWith('$') || k.includes('.') || hasMongoOperator(v, depth + 1),
  );
}

export const rejectMongoOperators: RequestHandler = (req, _res, next) => {
  if (hasMongoOperator(req.body) || hasMongoOperator(req.query) || hasMongoOperator(req.params)) {
    next(new AppError(400, 'VALIDATION_ERROR', 'Opérateur interdit dans la requête'));
    return;
  }
  next();
};
