import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../src/errors';
import { NAMESPACES, flattenKeys, isRtl, resources, translate } from '../src/i18n';

describe('traductions', () => {
  it('FR et AR ont exactement les mêmes clés', () => {
    expect(flattenKeys(resources.ar).sort()).toEqual(flattenKeys(resources.fr).sort());
  });

  it('déclare tous les espaces de noms', () => {
    expect(Object.keys(resources.fr).sort()).toEqual([...NAMESPACES].sort());
  });

  it("traduit chaque code d'erreur de l'API", () => {
    for (const code of ERROR_CODES) {
      expect(translate('fr', `errors.${code}`)).not.toBe(`errors.${code}`);
      expect(translate('ar', `errors.${code}`)).not.toBe(`errors.${code}`);
    }
  });

  it('insère les paramètres et retombe sur la clé inconnue', () => {
    expect(translate('fr', 'common.home.greeting', { name: 'Amina' })).toBe('Bonjour, Amina');
    expect(translate('fr', 'common.home.greeting')).toBe('Bonjour, ');
    expect(translate('ar', 'absent.key')).toBe('absent.key');
  });

  it("active le RTL pour l'arabe seulement", () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
  });
});
