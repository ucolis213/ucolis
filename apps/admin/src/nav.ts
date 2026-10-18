// Menu latéral : chaque entrée déclare les permissions qui l'ouvrent. Le menu n'affiche que les pages permises.
// L'API reste seule juge : masquer une entrée n'est qu'un confort d'interface.

import { hasAnyPermission, type Permission, type StaffPrincipal } from '@ucolis/shared';

export interface NavItem {
  path: string;
  label: string;
  /** Une seule de ces permissions suffit. */
  anyOf: Permission[];
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Tableau de bord', anyOf: ['dashboard.view'] },
  { path: '/users', label: 'Utilisateurs', anyOf: ['users.view'] },
  {
    path: '/verifications/identity',
    label: 'Vérifications identité',
    anyOf: ['verifications.identity'],
  },
  { path: '/verifications/pro', label: 'Statut pro', anyOf: ['verifications.pro'] },
  { path: '/parcels', label: 'Colis', anyOf: ['parcels.view'] },
  { path: '/trips', label: 'Trajets', anyOf: ['parcels.view'] },
  { path: '/disputes', label: 'Litiges', anyOf: ['disputes.handle'] },
  { path: '/reports', label: 'Signalements', anyOf: ['reports.handle'] },
  { path: '/reviews', label: 'Avis', anyOf: ['reviews.moderate'] },
  {
    path: '/conversations',
    label: 'Conversations',
    anyOf: ['conversations.view_reported', 'conversations.view_all'],
  },
  { path: '/broadcasts', label: 'Diffusion', anyOf: ['broadcast.send'] },
  { path: '/content', label: 'Contenus', anyOf: ['content.manage'] },
  { path: '/settings', label: 'Réglages', anyOf: ['settings.manage'] },
  { path: '/staff', label: 'Staff', anyOf: ['staff.manage'] },
  { path: '/audit', label: "Journal d'audit", anyOf: ['audit.view'] },
];

export function visibleNav(staff: StaffPrincipal): NavItem[] {
  return NAV_ITEMS.filter((item) => hasAnyPermission(staff, item.anyOf));
}
