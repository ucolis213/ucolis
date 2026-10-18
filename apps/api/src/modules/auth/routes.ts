import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerRequestSchema,
  resendCodeSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { authenticate } from '../../lib/auth';
import { validate } from '../../lib/validate';
import { authController } from './controller';
import type { AuthService } from './service';

export function authRoutes(deps: Deps, auth: AuthService): Router {
  const c = authController(auth);
  const r = Router();
  r.post('/auth/register', validate(registerRequestSchema), c.register);
  r.post('/auth/verify-email', validate(verifyEmailSchema), c.verifyEmail);
  r.post('/auth/resend-code', validate(resendCodeSchema), c.resendCode);
  r.post('/auth/login', validate(loginSchema), c.login);
  r.post('/auth/refresh', validate(refreshSchema), c.refresh);
  r.post('/auth/logout', authenticate(deps.config.accessSecret, { now: deps.now }), validate(logoutSchema), c.logout);
  r.post('/auth/forgot-password', validate(forgotPasswordSchema), c.forgotPassword);
  r.post('/auth/reset-password', validate(resetPasswordSchema), c.resetPassword);
  return r;
}
