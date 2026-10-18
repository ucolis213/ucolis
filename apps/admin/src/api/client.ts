// Client HTTP du back-office. Les erreurs de l'API arrivent au format { error: { code, message, details } }.
// Un 401 déclenche un unique rafraîchissement (partagé entre requêtes concurrentes), puis la requête est rejouée.

import type { ApiErrorBody, ErrorCode } from '@ucolis/shared';
import { sessionStore, type StaffDto } from '../auth/store';

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

const BASE = '/api/v1/admin';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

async function raw(path: string, init: RequestInit, token: string | undefined): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as (ApiErrorBody & { error: { details?: Record<string, unknown> } }) | null;
  return new ApiError(res.status, body?.error.code ?? 'INTERNAL_ERROR', body?.error.message ?? res.statusText, body?.error.details);
}

let refreshing: Promise<boolean> | null = null;

/** Rotation du jeton de rafraîchissement ; échec = session terminée. */
export function refreshSession(refreshToken = sessionStore.get()?.refreshToken ?? sessionStore.storedRefreshToken()): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false);
  refreshing ??= (async () => {
    try {
      const res = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, undefined);
      if (!res.ok) {
        sessionStore.set(null);
        return false;
      }
      const tokens = (await res.json()) as TokenResponse;
      const staff = sessionStore.get()?.staff ?? (await (await raw('/me', {}, tokens.accessToken)).json() as StaffDto);
      sessionStore.set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, staff });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await raw(path, init, sessionStore.get()?.accessToken);
  if (res.status === 401 && !path.startsWith('/auth/') && (await refreshSession())) {
    res = await raw(path, init, sessionStore.get()?.accessToken);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const withBody = (method: string) => <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: withBody('POST'),
  put: withBody('PUT'),
  patch: withBody('PATCH'),
  delete: withBody('DELETE'),
};

/** Chaîne de requête sans les valeurs vides. */
export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** Export CSV : le fichier est téléchargé avec le jeton du staff (pas de lien public). */
export async function downloadCsv(path: string, filename: string) {
  const res = await send(path);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  INVALID_CREDENTIALS: 'Email, mot de passe ou code incorrect.',
  TOTP_REQUIRED: 'Saisissez votre code de double authentification.',
  RATE_LIMITED: 'Trop de tentatives. Réessayez plus tard.',
  PERMISSION_DENIED: 'Vous n’avez pas la permission nécessaire.',
  FORBIDDEN: 'Action interdite.',
  UNAUTHENTICATED: 'Session expirée. Reconnectez-vous.',
  NOT_FOUND: 'Élément introuvable.',
  VALIDATION_ERROR: 'Certains champs sont invalides.',
  EMAIL_TAKEN: 'Cet email est déjà utilisé.',
};

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'INVALID_TRANSITION' && err.details?.by) return `Dossier pris en charge par ${String(err.details.by)}.`;
    return MESSAGES[err.code] ?? err.message;
  }
  return 'Erreur réseau. Vérifiez votre connexion.';
}
