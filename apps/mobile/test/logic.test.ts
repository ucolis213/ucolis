import { DEFAULT_SETTINGS, NAMESPACES, resources } from '@ucolis/shared';
import { parseFaq } from '../src/components/Markdown';
import { normalizeSearch } from '../src/components/Select';
import i18n from 'i18next';
import { atNoon, clampMonth, monthCells, weekDays } from '../src/calendar';
import { formatDateTime, formatRelative, formatTime } from '../src/format';
import {
  addRecent,
  clearRecents,
  loadRecents,
  localSuggestions,
  MAX_RECENTS,
  toPlace,
  withoutDuplicates,
} from '../src/state/addressBook';
import { startupRoute } from '../src/hooks/useAppConfig';
import { clusterByProximity } from '../src/mapClusters';
import { pickLocale } from '../src/i18n';
import { draftFromParcel } from '../src/state/draftFromParcel';
import { priceToApply, quickPayload, stepErrors } from '../src/state/draftPayload';
import { draftEntryRoute, EMPTY_DRAFT, newParcelRoute, useParcelDraft } from '../src/state/parcelDraft';

describe('pickLocale', () => {
  it('privilégie la langue enregistrée, puis celle de l’appareil, puis le français', () => {
    expect(pickLocale('ar', 'fr')).toBe('ar');
    expect(pickLocale(null, 'ar')).toBe('ar');
    expect(pickLocale(null, 'en')).toBe('en');
    expect(pickLocale(null, 'es')).toBe('fr');
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
    expect(startupRoute({ ...base, acceptedTermsVersion: DEFAULT_SETTINGS.termsVersion })).toBe(
      'home',
    );
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
    const body = [
      '# FAQ',
      '',
      '## Comment publier ?',
      'Touchez Publier.',
      '',
      '## Qui paie ?',
      '- En espèces',
      '- À la livraison',
    ].join('\n');
    expect(parseFaq(body)).toEqual([
      { section: 'FAQ', question: 'Comment publier ?', answer: 'Touchez Publier.' },
      { section: 'FAQ', question: 'Qui paie ?', answer: '- En espèces\n- À la livraison' },
    ]);
  });

  it('rattache chaque question à sa rubrique', () => {
    const body = ['## Sans rubrique', 'Oui.', '', '# Livraison', '', '## Code ?', 'Quatre chiffres.', '', '# Compte', '## Supprimer ?', 'Profil.'].join('\n');
    expect(parseFaq(body)).toEqual([
      { section: '', question: 'Sans rubrique', answer: 'Oui.' },
      { section: 'Livraison', question: 'Code ?', answer: 'Quatre chiffres.' },
      { section: 'Compte', question: 'Supprimer ?', answer: 'Profil.' },
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

describe('calendrier du sélecteur de date', () => {
  it('aligne le 1er du mois sur son jour de semaine, à partir du dimanche', () => {
    // Octobre 2026 commence un jeudi et compte 31 jours.
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toEqual(atNoon(2026, 9, 1));
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
    expect(weekDays(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it('ramène le mois dans les bornes au changement d’année', () => {
    const min = atNoon(2026, 9, 21);
    const max = atNoon(2028, 3, 10);
    expect(clampMonth(2026, 2, min, max)).toBe(9);
    expect(clampMonth(2027, 2, min, max)).toBe(2);
    expect(clampMonth(2028, 11, min, max)).toBe(3);
  });
});

describe('temps relatif', () => {
  beforeAll(() => i18n.init({ resources, lng: 'fr', ns: [...NAMESPACES], defaultNS: 'common', interpolation: { escapeValue: false } }));

  it('se passe de Intl.RelativeTimeFormat, absent de Hermes', () => {
    const now = new Date(2026, 9, 21, 12, 0);
    const ago = (s: number) => formatRelative(new Date(now.getTime() - s * 1000), now);
    // Simulation de Hermes.
    const intl = Intl as { RelativeTimeFormat?: unknown };
    const saved = intl.RelativeTimeFormat;
    delete intl.RelativeTimeFormat;
    try {
      expect(ago(10)).toBe("À l'instant");
      expect(ago(-30)).toBe("À l'instant");
      expect(ago(5 * 60)).toBe('Il y a 5 min');
      expect(ago(3 * 3600)).toBe('Il y a 3 h');
      expect(ago(30 * 3600)).toBe('Hier');
      expect(ago(3 * 86400)).toBe('Il y a 3 j');
      expect(ago(10 * 86400)).toMatch(/11/);
    } finally {
      intl.RelativeTimeFormat = saved;
    }
  });
});

describe('sélecteur d’adresse', () => {
  it('propose les communes, celles qui commencent par la recherche d’abord, en français et en arabe', () => {
    expect(localSuggestions('a')).toEqual([]);
    const oran = localSuggestions('oran');
    expect(oran[0]).toMatchObject({
      commune: expect.any(String),
      wilayaCode: '31',
      address: 'Oran, Oran',
    });
    expect(localSuggestions('وهران')[0]!.wilayaCode).toBe('31');
    // « Bab » : les communes dont le nom commence par la recherche passent avant celles qui la contiennent.
    const bab = localSuggestions('bab', 50).map((p) => p.address.toLowerCase().startsWith('bab'));
    expect(bab[0]).toBe(true);
    expect(bab.indexOf(false) === -1 || bab.slice(bab.indexOf(false)).every((x) => !x)).toBe(true);
    expect(localSuggestions('el', 3)).toHaveLength(3);
  });

  it('écarte les doublons et retire le libellé court', () => {
    const local = localSuggestions('oran').slice(0, 1);
    const remote = [
      { ...local[0]! },
      {
        name: 'Gare d’Oran',
        address: 'Gare d’Oran, Oran',
        location: { lat: 35.7, lng: -0.64 },
        wilayaCode: '31',
        commune: local[0]!.commune,
      },
    ];
    const filtered = withoutDuplicates(remote, local);
    expect(filtered).toHaveLength(1);
    expect(toPlace(filtered[0]!)).not.toHaveProperty('name');
  });

  it('garde les adresses récentes sans doublon, les plus récentes d’abord, et les efface', async () => {
    await clearRecents();
    expect(await loadRecents()).toEqual([]);
    const places = localSuggestions('el', MAX_RECENTS + 2).map(toPlace);
    for (const p of places) await addRecent(p);
    await addRecent(places[2]!);
    const recents = await loadRecents();
    expect(recents).toHaveLength(MAX_RECENTS);
    expect(recents[0]).toEqual(places[2]);
    expect(new Set(recents.map((r) => r.address)).size).toBe(MAX_RECENTS);
    await clearRecents();
    expect(await loadRecents()).toEqual([]);
  });
});

describe('publication rapide', () => {
  const place = (wilayaCode: string, commune: string, lat: number, lng: number) => ({
    address: 'Rue Didouche Mourad',
    details: '',
    wilayaCode,
    commune,
    location: { lat, lng },
  });
  const draft = {
    ...EMPTY_DRAFT,
    pickup: place('16', '16001', 36.77, 3.06),
    dropoff: place('31', '31001', 35.7, -0.63),
    title: 'Carton de livres',
    requestedPrice: 2000,
    prohibitedItemsDeclared: true,
  };

  it('se contente du trajet, du titre, du prix et de la déclaration, sans photo', () => {
    expect(EMPTY_DRAFT.mode).toBe('quick');
    expect(stepErrors('quick', draft)).toEqual({});
    expect(quickPayload(draft)).toMatchObject({ mode: 'quick', photos: [] });
    expect(quickPayload(draft)).not.toHaveProperty('weightKg');
  });

  it('signale les champs manquants', () => {
    const errors = stepErrors('quick', { ...draft, pickup: null, title: '', prohibitedItemsDeclared: false });
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['pickup', 'title', 'prohibitedItemsDeclared']));
  });

  it('reprend une annonce rapide dans le même mode, sans les valeurs posées par l’API', () => {
    const d = draftFromParcel({ weightKg: null, category: 'other', vehicleTypes: ['car', 'van'], paymentArrangement: 'other' });
    expect(d).toMatchObject({ mode: 'quick', category: null, vehicleTypes: [], paymentArrangement: null });
    expect(draftFromParcel({ weightKg: 5 }).mode).toBe('full');
    expect(draftEntryRoute('quick')).toBe('/parcel/new/quick');
    expect(draftEntryRoute('full')).toBe('/parcel/new/route');
  });
});

describe('nouvelle annonce après une modification abandonnée', () => {
  it('abandonne la modification en cours au lieu de rouvrir l’annonce publiée', () => {
    useParcelDraft.getState().start({ mode: 'quick', title: 'Annonce déjà publiée' }, 'parcel-1');
    expect(newParcelRoute()).toBe('/parcel/new/quick');
    expect(useParcelDraft.getState()).toMatchObject({ editingId: null, editingQuick: false, draft: EMPTY_DRAFT });
  });

  it('garde un brouillon de nouvelle annonce en cours', () => {
    useParcelDraft.getState().start();
    useParcelDraft.getState().update({ title: 'Carton de livres' });
    newParcelRoute();
    expect(useParcelDraft.getState().draft.title).toBe('Carton de livres');
  });
});

describe('clusterByProximity', () => {
  const at = (id: string, lat: number, lng: number) => ({ id, location: { lat, lng } });
  const run = (items: ReturnType<typeof at>[], delta: number) =>
    clusterByProximity(items, { latitudeDelta: delta, longitudeDelta: delta }, (p) => p.location, (p) => p.id);
  // Trois adresses d'une même commune, à quelques centaines de mètres, et une autre ville.
  const items = [at('a', 36.77, 3.06), at('b', 36.772, 3.058), at('c', 36.768, 3.062), at('d', 34.67, 3.25)];

  it('regroupe les adresses proches quand la carte montre tout le pays', () => {
    const clusters = run(items, 10);
    expect(clusters.map((c) => c.items.map((p) => p.id))).toEqual([['a', 'b', 'c'], ['d']]);
    expect(clusters[0]!.key).toBe('a');
  });

  it('sépare les adresses en zoomant', () => {
    expect(run(items, 0.02)).toHaveLength(4);
  });

  it('garde groupées les annonces au même point, à tout zoom', () => {
    expect(run([at('a', 36.77, 3.06), at('b', 36.77, 3.06)], 0.0001)).toHaveLength(1);
  });
});

describe('priceToApply', () => {
  // Distance seule : 700 DA ; avec le poids et le volume ajoutés ensuite : 1 200 DA.
  it("recalcule un prix pré-rempli en mode rapide quand on ajoute les détails", () => {
    expect(priceToApply({ requestedPrice: 700, priceIsSuggested: true }, 1200, 700)).toBe(1200);
  });

  it('reconnaît le prix rapide d’une annonce publiée que l’on complète', () => {
    expect(priceToApply({ requestedPrice: 700, priceIsSuggested: false }, 1200, 700)).toBe(1200);
  });

  it('remplit un prix vide', () => {
    expect(priceToApply({ requestedPrice: null, priceIsSuggested: false }, 1200, 700)).toBe(1200);
  });

  it('ne touche jamais un prix saisi à la main', () => {
    expect(priceToApply({ requestedPrice: 900, priceIsSuggested: false }, 1200, 700)).toBeNull();
  });

  it('ne fait rien sans suggestion ou quand le prix est déjà le bon', () => {
    expect(priceToApply({ requestedPrice: 700, priceIsSuggested: true }, null, 700)).toBeNull();
    expect(priceToApply({ requestedPrice: 1200, priceIsSuggested: true }, 1200, 700)).toBeNull();
  });
});
