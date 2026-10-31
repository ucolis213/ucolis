import { describe, expect, it } from 'vitest';
import { LOCALES } from '../src/enums';
import { ERROR_CODES } from '../src/errors';
import { NAMESPACES, contentLocale, flattenKeys, isContentLocale, isRtl, resources, translate } from '../src/i18n';

/** Paramètres « {{nom}} » de chaque texte, par clé. */
function placeholders(tree: unknown, prefix = ''): Record<string, string> {
  if (typeof tree === 'string') return { [prefix]: [...tree.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',') };
  if (Array.isArray(tree)) return {};
  return Object.assign({}, ...Object.entries(tree as object).map(([k, v]) => placeholders(v, prefix ? `${prefix}.${k}` : k)));
}

describe('traductions', () => {
  it('toutes les langues ont exactement les mêmes clés que le français', () => {
    for (const locale of LOCALES) expect(flattenKeys(resources[locale]).sort()).toEqual(flattenKeys(resources.fr).sort());
  });

  it('gardent les mêmes paramètres {{…}} que le français', () => {
    for (const locale of LOCALES) expect(placeholders(resources[locale])).toEqual(placeholders(resources.fr));
  });

  it('déclare tous les espaces de noms', () => {
    expect(Object.keys(resources.fr).sort()).toEqual([...NAMESPACES].sort());
  });

  it("traduit chaque code d'erreur de l'API", () => {
    for (const locale of LOCALES) {
      for (const code of ERROR_CODES) expect(translate(locale, `errors.${code}`)).not.toBe(`errors.${code}`);
    }
  });

  it('insère les paramètres et retombe sur la clé inconnue', () => {
    expect(translate('fr', 'common.home.greeting', { name: 'Amina' })).toBe('Bonjour, Amina');
    expect(translate('en', 'common.home.greeting', { name: 'Amina' })).toBe('Hello, Amina');
    expect(translate('fr', 'common.home.greeting')).toBe('Bonjour, ');
    expect(translate('ar', 'absent.key')).toBe('absent.key');
  });

  it("active le RTL pour l'arabe seulement", () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
    expect(isRtl('en')).toBe(false);
  });

  it("sert les contenus du back-office en français à l'anglais", () => {
    expect(contentLocale('en')).toBe('fr');
    expect(contentLocale('ar')).toBe('ar');
    expect(isContentLocale('en')).toBe(false);
    expect(isContentLocale('fr')).toBe(true);
  });
});
