// Client HTTP : jeton d'accès joint, rafraîchissement silencieux sur 401 (une seule rotation à la fois),
// erreurs de l'API ({ error: { code } }) traduites via errors:<code>.

import type { TFunction } from 'i18next';
import type { ApiErrorBody, ErrorCode, PublicAppConfig, TokenResponse } from '@ucolis/shared';
import { getDeviceId } from '../device';
import i18n from '../i18n';
import { tokens } from './tokens';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class NetworkError extends Error {}

type SessionListener = (reason: 'expired' | 'revoked') => void;
let onSessionLost: SessionListener | null = null;
/** Le contexte de session s'abonne pour repasser en invité quand la session est perdue. */
export const setSessionLostListener = (fn: SessionListener | null) => {
  onSessionLost = fn;
};

let refreshing: Promise<boolean> | null = null;

async function rawFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 15_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const access = tokens.getAccess();
  try {
    return await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': i18n.language || 'fr',
        'x-device-id': await getDeviceId(),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...rest.headers,
      },
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Rotation du jeton de rafraîchissement ; les appels concurrents attendent la même promesse. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await tokens.getRefresh();
      if (!refreshToken) return false;
      const res = await rawFetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken, deviceId: await getDeviceId() }),
      });
      if (!res.ok) {
        // Erreur réseau ou serveur : on garde la session ; un refus explicite la ferme.
        if (res.status === 401 || res.status === 403) {
          await tokens.clear();
          onSessionLost?.(res.status === 403 ? 'revoked' : 'expired');
        }
        return false;
      }
      const data = (await res.json()) as TokenResponse;
      tokens.setAccess(data.accessToken);
      await tokens.setRefresh(data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number; retried?: boolean } = {},
): Promise<T> {
  const { retried, ...rest } = init;
  const res = await rawFetch(path, rest);
  // Jeton d'accès expiré ou absent (démarrage à froid) : une rotation, puis un seul nouvel essai.
  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await refreshSession()) return apiFetch<T>(path, { ...rest, retried: true });
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const error = new ApiError(
      res.status,
      body?.error.code ?? 'INTERNAL_ERROR',
      body?.error.message ?? res.statusText,
      body?.error.details,
    );
    if (error.code === 'ACCOUNT_SUSPENDED') {
      await tokens.clear();
      onSessionLost?.('revoked');
    }
    throw error;
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? await res.json() : await res.text()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/** Chaîne de requête à partir d'un objet (valeurs vides ignorées). */
export function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, v instanceof Date ? v.toISOString() : String(v)]))}`;
}

/** Message lisible et traduit pour n'importe quelle erreur. */
export function errorMessage(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    return t(`errors:${err.code}`, { defaultValue: t('errors:INTERNAL_ERROR') });
  }
  if (err instanceof NetworkError) return t('common:offline');
  return t('errors:INTERNAL_ERROR');
}

/** Erreurs de validation de l'API ramenées au champ concerné. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_ERROR') return {};
  const fields = (err.details?.fields ?? []) as { path: string; message: string }[];
  return Object.fromEntries(fields.map((f) => [f.path, f.message]));
}

export const fetchAppConfig = () => apiFetch<PublicAppConfig>('/app/config', { timeoutMs: 8_000 });
