import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { colors, suggestPrice } from '@ucolis/shared';
import { ILLUSTRATIONS } from '../src/illustrations';
import { LEGAL_DOCS, legalDocFromHash, parseMarkdown } from '../src/legal';
import ar from '../src/locales/ar.json';
import en from '../src/locales/en.json';
import fr from '../src/locales/fr.json';
import { SAME_WILAYA_KM, estimate } from '../src/simulator';

/** Forme d'un arbre de traduction : clés, et longueur des listes. */
function shape(node: unknown, path = ''): string[] {
  if (Array.isArray(node)) return [`${path}[${node.length}]`, ...node.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [path];
}

const strings = (node: unknown): string[] =>
  Array.isArray(node) ? node.flatMap(strings) : node && typeof node === 'object' ? Object.values(node).flatMap(strings) : [String(node)];

describe('traductions du site', () => {
  it('ont exactement les mêmes clés en français, en arabe et en anglais', () => {
    expect(shape(ar)).toEqual(shape(fr));
    expect(shape(en)).toEqual(shape(fr));
  });

  it("n'utilisent pas de tiret cadratin", () => {
    for (const s of [...strings(fr), ...strings(ar), ...strings(en)]) expect(s).not.toContain('—');
  });
});

describe('couleurs', () => {
  it('reprennent les jetons de shared/theme', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8').toLowerCase();
    for (const key of ['primary', 'navy', 'accent', 'danger', 'warning', 'background', 'border'] as const) {
      expect(css).toContain(`--color-${key}: ${colors[key].toLowerCase()};`);
    }
  });
});

describe('simulateur', () => {
  it('applique le barème de shared entre deux wilayas', () => {
    const e = estimate('16', '31', 'small', false);
    expect(e.distanceKm).toBeGreaterThan(300);
    expect(e.price).toBe(suggestPrice({ distanceKm: e.distanceKm, weightKg: 3, volumeM3: 0.009, fragile: false }));
  });

  it('prend une course en ville dans la même wilaya', () => {
    expect(estimate('16', '16', 'envelope', false).distanceKm).toBe(SAME_WILAYA_KM);
  });

  it('majore un colis fragile', () => {
    expect(estimate('19', '16', 'medium', true).price).toBeGreaterThan(estimate('19', '16', 'medium', false).price);
  });
});

describe('illustrations', () => {
  it('ont toutes un prompt dans ILLUSTRATIONS.md', () => {
    const doc = readFileSync(new URL('../ILLUSTRATIONS.md', import.meta.url), 'utf8');
    for (const { file } of Object.values(ILLUSTRATIONS)) expect(doc).toContain(`\`${file}\``);
  });
});

describe('documents légaux', () => {
  it("reprennent les CGU de l'application, avec l'article sur la responsabilité de UCOLIS", () => {
    for (const lang of ['fr', 'ar'] as const) {
      const titles = parseMarkdown(LEGAL_DOCS.cgu[lang]).filter((b) => b.type === 'h2');
      expect(titles.some((b) => b.type === 'h2' && b.text.startsWith('21.'))).toBe(true);
      expect(parseMarkdown(LEGAL_DOCS.confidentialite[lang])[0]?.type).toBe('h1');
    }
  });

  it('regroupent les lignes « - » en une seule liste', () => {
    expect(parseMarkdown('# T\n\nTexte\n- a\n- b\n\n## S')).toEqual([
      { type: 'h1', text: 'T' },
      { type: 'p', text: 'Texte' },
      { type: 'ul', items: ['a', 'b'] },
      { type: 'h2', text: 'S' },
    ]);
  });

  it("s'ouvrent par « #/cgu » sans confondre les ancres de sections", () => {
    expect(legalDocFromHash('#/cgu')).toBe('cgu');
    expect(legalDocFromHash('#/confidentialite')).toBe('confidentialite');
    expect(legalDocFromHash('#faq')).toBeNull();
    expect(legalDocFromHash('#/inconnu')).toBeNull();
  });
});
