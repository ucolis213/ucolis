import { describe, expect, it } from 'vitest';
import {
  MODERATOR_GRANTABLE,
  PERMISSIONS,
  PERMISSION_TEMPLATES,
  SUPER_ADMIN_ONLY,
  hasAnyPermission,
  hasPermission,
  sanitizeModeratorPermissions,
  type Permission,
} from '../src/permissions';

describe('permissions du staff', () => {
  it('donne tout au super-administrateur', () => {
    const admin = { role: 'super_admin' as const, permissions: [] };
    PERMISSIONS.forEach((p) => expect(hasPermission(admin, p)).toBe(true));
  });

  it('refuse les permissions réservées à un modérateur, même si elles sont stockées', () => {
    const mod = { role: 'moderator' as const, permissions: [...PERMISSIONS] };
    SUPER_ADMIN_ONLY.forEach((p) => expect(hasPermission(mod, p)).toBe(false));
    expect(hasPermission(mod, 'users.view')).toBe(true);
  });

  it('les modèles ne contiennent que des permissions attribuables', () => {
    Object.values(PERMISSION_TEMPLATES).forEach((perms) =>
      perms.forEach((p) => expect(MODERATOR_GRANTABLE).toContain(p)),
    );
    expect(PERMISSION_TEMPLATES.verifier).not.toContain('users.view_pii');
    expect(PERMISSION_TEMPLATES.support).toContain('users.view_pii');
  });

  it('nettoie une liste de permissions de modérateur', () => {
    expect(
      sanitizeModeratorPermissions(['users.view', 'users.view', 'staff.manage', 'unknown']),
    ).toEqual(['users.view']);
  });

  it('hasAnyPermission', () => {
    const permissions: Permission[] = ['conversations.view_reported'];
    const mod = { role: 'moderator' as const, permissions };
    expect(hasAnyPermission(mod, ['conversations.view_all', 'conversations.view_reported'])).toBe(
      true,
    );
    expect(hasAnyPermission(mod, ['conversations.view_all'])).toBe(false);
  });
});
