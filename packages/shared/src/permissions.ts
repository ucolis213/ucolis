// Permissions du staff et modèles pré-cochés de l'écran de création d'un modérateur.

import type { StaffRole } from './enums';

export const PERMISSIONS = [
  'dashboard.view',
  'users.view',
  'users.view_pii',
  'users.suspend',
  'users.delete',
  'verifications.identity',
  'verifications.pro',
  'parcels.view',
  'parcels.moderate',
  'reviews.moderate',
  'reports.handle',
  'disputes.handle',
  'conversations.view_reported',
  'conversations.view_all',
  'broadcast.send',
  'wallet.manage',
  'content.manage',
  'settings.manage',
  'staff.manage',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Ne peuvent jamais être accordées à un modérateur. */
export const SUPER_ADMIN_ONLY: readonly Permission[] = [
  'settings.manage',
  'staff.manage',
  'audit.view',
];

export const MODERATOR_GRANTABLE: readonly Permission[] = PERMISSIONS.filter(
  (p) => !SUPER_ADMIN_ONLY.includes(p),
);

export const PERMISSION_TEMPLATES = {
  verifier: ['dashboard.view', 'users.view', 'verifications.identity', 'verifications.pro'],
  content_moderator: [
    'dashboard.view',
    'users.view',
    'users.suspend',
    'parcels.view',
    'parcels.moderate',
    'reviews.moderate',
    'reports.handle',
    'conversations.view_reported',
  ],
  support: [
    'dashboard.view',
    'users.view',
    'users.view_pii',
    'parcels.view',
    'disputes.handle',
    'conversations.view_reported',
  ],
} as const satisfies Record<string, readonly Permission[]>;

export type PermissionTemplate = keyof typeof PERMISSION_TEMPLATES;

export interface StaffPrincipal {
  role: StaffRole;
  permissions: readonly Permission[];
}

export function hasPermission(staff: StaffPrincipal, permission: Permission): boolean {
  if (staff.role === 'super_admin') return true;
  if (SUPER_ADMIN_ONLY.includes(permission)) return false;
  return staff.permissions.includes(permission);
}

export function hasAnyPermission(
  staff: StaffPrincipal,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => hasPermission(staff, p));
}

/** Retire les permissions qu'un modérateur ne peut pas recevoir. */
export function sanitizeModeratorPermissions(permissions: readonly string[]): Permission[] {
  const grantable = new Set<string>(MODERATOR_GRANTABLE);
  return [...new Set(permissions)].filter((p): p is Permission => grantable.has(p));
}
