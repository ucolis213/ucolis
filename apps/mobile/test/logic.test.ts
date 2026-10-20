import { DEFAULT_SETTINGS } from '@ucolis/shared';
import { parseFaq } from '../src/components/Markdown';
import { normalizeSearch } from '../src/components/Select';
import { formatDateTime, formatTime } from '../src/format';
import { startupRoute } from '../src/hooks/useAppConfig';
import { pickLocale } from '../src/i18n';

describe('pickLocale', () => {
  it('privilégie la langue enregistrée, puis celle de l’appareil, puis le français', () => {
    expect(pickLocale('ar', 'fr')).toBe('ar');
    expect(pickLocale(null, 'ar')).toBe('ar');
    expect(pickLocale(null, 'en')).toBe('fr');
    expect(pickLocale('xx', undefined)).toBe('fr');
  });
});

describe('startupRoute', () => {
  const base = { config: DEFAULT_SETTINGS, installedVersion: '1.0.0', onboardingDone: true };

  it('bloque une version trop ancienne avant tout le reste', () => {
    const config = {
      ...DEFAULT_SETTINGS,
      minAppVersion: '1.2.0',
      maintenance: { enabled: true, message: { fr: '', ar: '' } },
    };
    expect(startupRoute({ ...base, config })).toBe('update-required');
  });

  it('affiche la maintenance, puis l’onboarding, puis l’accueil', () => {
    const maintenance = {
      ...DEFAULT_SETTINGS,
      maintenance: { enabled: true, message: { fr: '', ar: '' } },
    };
    expect(startupRoute({ ...base, config: maintenance })).toBe('maintenance');
    expect(startupRoute({ ...base, onboardingDone: false })).toBe('onboarding');
    expect(startupRoute(base)).toBe('home');
  });

  it('demande d’accepter les nouvelles CGU à un utilisateur connecté', () => {
    expect(startupRoute({ ...base, acceptedTermsVersion: null })).toBe('accept-terms');
    expect(startupRoute({ ...base, acceptedTermsVersion: DEFAULT_SETTINGS.termsVersion })).toBe('home');
    // Invité : pas de version connue, on ne bloque pas.
    expect(startupRoute({ ...base, acceptedTermsVersion: undefined })).toBe('home');
  });

  it('laisse passer sans configuration (hors connexion)', () => {
    expect(startupRoute({ ...base, config: undefined })).toBe('home');
  });
});

describe('normalizeSearch', () => {
  it('ignore accents et casse', () => {
    expect(normalizeSearch('  Sétif ')).toBe('setif');
    expect(normalizeSearch('BÉJAÏA')).toBe('bejaia');
  });
});

describe('parseFaq', () => {
  it('découpe la FAQ en questions et réponses', () => {
    const body = ['# FAQ', '', '## Comment publier ?', 'Touchez Publier.', '', '## Qui paie ?', '- En espèces', '- À la livraison'].join('\n');
    expect(parseFaq(body)).toEqual([
      { question: 'Comment publier ?', answer: 'Touchez Publier.' },
      { question: 'Qui paie ?', answer: '- En espèces\n- À la livraison' },
    ]);
  });
});

describe('format des heures', () => {
  it('affiche les heures sur 24 h', () => {
    const d = new Date(2026, 9, 20, 16, 28);
    expect(formatTime(d)).toMatch(/16[:h]28/);
    expect(formatDateTime(d)).toMatch(/16[:h]28/);
    expect(formatTime(d)).not.toMatch(/PM|AM/i);
  });
});
