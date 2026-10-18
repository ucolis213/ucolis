import type { RequestHandler } from 'express';
import { currentUser } from '../../lib/auth';
import { clientIp, requestLocale } from '../../lib/http';
import type { AuthService } from './service';

export function authController(auth: AuthService) {
  const register: RequestHandler = async (req, res) => {
    res.status(201).json(await auth.register(req.body, clientIp(req), requestLocale(req)));
  };
  const verifyEmail: RequestHandler = async (req, res) => {
    res.json({ user: await auth.verifyEmail(req.body.email, req.body.code) });
  };
  const resendCode: RequestHandler = async (req, res) => {
    await auth.resendCode(req.body.email);
    res.status(204).end();
  };
  const login: RequestHandler = async (req, res) => {
    res.json(await auth.login(req.body, clientIp(req)));
  };
  const refresh: RequestHandler = async (req, res) => {
    res.json(await auth.refresh(req.body.refreshToken, req.body.deviceId));
  };
  const logout: RequestHandler = async (req, res) => {
    await auth.logout(currentUser(req).userId, req.body.deviceId);
    res.status(204).end();
  };
  const forgotPassword: RequestHandler = async (req, res) => {
    await auth.forgotPassword(req.body.email);
    res.status(204).end();
  };
  const resetPassword: RequestHandler = async (req, res) => {
    await auth.resetPassword(req.body.email, req.body.code, req.body.password);
    res.status(204).end();
  };
  return { register, verifyEmail, resendCode, login, refresh, logout, forgotPassword, resetPassword };
}
