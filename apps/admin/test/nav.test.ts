import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERMISSION_TEMPLATES, PERMISSIONS, colors } from '@ucolis/shared';
import { NAV_ITEMS, visibleNav } from '../src/nav';

const paths = (items: { path: string }[]) => items.map((i) => i.path);

describe('menu latéral', () => {
  it('montre tout au super-administrateur', () => {
    expect(visibleNav({ role: 'super_admin', permissions: [] })).toHaveLength(NAV_ITEMS.length);
  });

  it('limite le Vérificateur à ses files', () => {
    const nav = visibleNav({ role: 'moderator', permissions: [...PERMISSION_TEMPLATES.verifier] });
    expect(paths(nav)).toEqual(['/', '/users', '/verifications/identity', '/verifications/pro']);
  });

  it('ne montre jamais Réglages, Staff ni Audit à un modérateur', () => {
    const nav = visibleNav({ role: 'moderator', permissions: [...PERMISSIONS] });
    expect(paths(nav)).not.toContain('/settings');
    expect(paths(nav)).not.toContain('/staff');
    expect(paths(nav)).not.toContain('/audit');
  });

  it('ouvre Conversations avec view_reported ou view_all', () => {
    const nav = visibleNav({ role: 'moderator', permissions: ['conversations.view_all'] });
    expect(paths(nav)).toEqual(['/conversations']);
  });
});

describe('thème Tailwind', () => {
  it('reprend les couleurs de shared/theme', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8').toLowerCase();
    const expected: [string, string][] = [
      ['primary', colors.primary],
      ['navy', colors.navy],
      ['accent', colors.accent],
      ['danger', colors.danger],
      ['warning', colors.warning],
      ['background', colors.background],
    ];
    for (const [name, value] of expected)
      expect(css).toContain(`--color-${name}: ${value.toLowerCase()};`);
  });
});
