// Couleur de marque (réglage branding) : les variables CSS de Tailwind sont redéfinies à l'exécution.
// La dernière couleur connue est gardée localement pour éviter un flash de la couleur par défaut.

import { brandPalette, isValidBrandColor, type PublicAppConfig } from '@ucolis/shared';

const KEY = 'ucolis.admin.brand-color';

export function applyAdminBrand(hex: string) {
  if (!isValidBrandColor(hex)) return;
  const p = brandPalette(hex);
  const root = document.documentElement.style;
  root.setProperty('--color-primary', p.primary);
  root.setProperty('--color-primary-dark', p.primaryDark);
  root.setProperty('--color-primary-soft', p.primarySoft);
  try {
    localStorage.setItem(KEY, hex);
  } catch {
    // Stockage indisponible : la couleur sera relue au prochain chargement.
  }
}

export function initBrand() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) applyAdminBrand(stored);
  } catch {
    // Stockage indisponible.
  }
  fetch('/api/v1/app/config')
    .then((r) => (r.ok ? (r.json() as Promise<PublicAppConfig>) : null))
    .then((c) => c?.branding?.primaryColor && applyAdminBrand(c.branding.primaryColor))
    .catch(() => undefined);
}
