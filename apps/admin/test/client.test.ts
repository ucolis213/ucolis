import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, errorText, qs } from '../src/api/client';
import { sessionStore, type StaffDto } from '../src/auth/store';

const staff = { id: 's1', email: 'a@b.dz', firstName: 'A', lastName: 'B', role: 'moderator', permissions: [], status: 'active', lastLoginAt: null, createdAt: '' } as StaffDto;
const json = (status: number, body: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('client du back-office', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStore.set({ accessToken: 'old', refreshToken: 'r1', staff });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStore.set(null);
  });

  it('rafraîchit une seule fois pour des requêtes concurrentes, puis les rejoue', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'new', refreshToken: 'r2' });
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new' ? json(200, { ok: url }) : json(401, { error: { code: 'UNAUTHENTICATED', message: 'expiré' } });
    });
    const [a, b] = await Promise.all([api.get<{ ok: string }>('/stats'), api.get<{ ok: string }>('/users')]);
    expect(a.ok).toContain('/stats');
    expect(b.ok).toContain('/users');
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))).toHaveLength(1);
    expect(sessionStore.get()).toMatchObject({ accessToken: 'new', refreshToken: 'r2', staff });
  });

  it('ferme la session quand le rafraîchissement échoue', async () => {
    fetchMock.mockImplementation(async () => json(401, { error: { code: 'UNAUTHENTICATED', message: 'expiré' } }));
    await expect(api.get('/stats')).rejects.toBeInstanceOf(ApiError);
    expect(sessionStore.get()).toBeNull();
  });

  it('traduit les erreurs, dont la prise en charge par un collègue', () => {
    expect(errorText(new ApiError(403, 'PERMISSION_DENIED', 'x'))).toMatch(/permission/);
    expect(errorText(new ApiError(409, 'INVALID_TRANSITION', 'x', { by: 'Samia K.' }))).toBe('Dossier pris en charge par Samia K..');
    expect(errorText(new TypeError('fetch'))).toMatch(/réseau/);
  });

  it('construit une chaîne de requête sans valeurs vides', () => {
    expect(qs({ q: 'sétif', status: '', page: 2, x: undefined })).toBe('?q=s%C3%A9tif&page=2');
    expect(qs({})).toBe('');
  });
});
