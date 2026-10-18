// Format d'erreur unique : { error: { code, message, details } }, avec un code stable traduit côté client.

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody, ErrorCode } from '@ucolis/shared';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Route introuvable'));
};

const body = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorBody => ({
  error: details ? { code, message, details } : { code, message },
});

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }
  if (err instanceof ZodError) {
    const fields = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    res.status(400).json(body('VALIDATION_ERROR', 'Requête invalide', { fields }));
    return;
  }
  // Corps JSON illisible ou trop volumineux (body-parser).
  const status = (err as { status?: number }).status;
  if (status === 400 || status === 413) {
    res
      .status(status)
      .json(body('VALIDATION_ERROR', status === 413 ? 'Corps trop volumineux' : 'JSON invalide'));
    return;
  }
  req.log?.error({ err }, 'unhandled error');
  res.status(500).json(body('INTERNAL_ERROR', 'Erreur interne'));
};
