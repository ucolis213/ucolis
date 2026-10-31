// Traductions du site vitrine : français par défaut, arabe en RTL, anglais. La langue choisie est mémorisée dans le navigateur.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, formatPrice, isRtl, placeName, type Locale } from '@ucolis/shared';
import ar from './locales/ar.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

/** Langues du site : celles de l'application, plus l'anglais (propre au site). */
export const SITE_LOCALES = ['fr', 'ar', 'en'] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

/** Nom de chaque langue, écrit dans cette langue, pour le sélecteur. */
export const LOCALE_NAMES: Record<SiteLocale, string> = { fr: 'Français', ar: 'العربية', en: 'English' };

export type Messages = typeof fr;
const dictionaries: Record<SiteLocale, Messages> = { fr, ar, en };

/** Langue de l'application utilisée pour les données de shared (prix, noms de lieux) : l'anglais reprend le français. */
const dataLocale = (l: SiteLocale): Locale => (l === 'ar' ? 'ar' : 'fr');

const STORAGE_KEY = 'ucolis.site.locale';

function initialLocale(): SiteLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (SITE_LOCALES.includes(stored as SiteLocale)) return stored as SiteLocale;
  } catch {
    // Stockage indisponible (navigation privée) : on se rabat sur la langue du navigateur.
  }
  const browser = navigator.language?.slice(0, 2);
  return SITE_LOCALES.includes(browser as SiteLocale) ? (browser as SiteLocale) : DEFAULT_LOCALE;
}

/** Remplace les « {{nom}} » d'un texte par les paramètres donnés. */
export function interpolate(text: string, params: Record<string, string | number> = {}): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
}

interface I18nValue {
  locale: SiteLocale;
  rtl: boolean;
  m: Messages;
  setLocale: (l: SiteLocale) => void;
  price: (amount: number) => string;
  place: (p: { fr: string; ar: string }) => string;
  number: (n: number) => string;
  decimal: (n: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>(initialLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtl(dataLocale(locale)) ? 'rtl' : 'ltr';
    document.title = dictionaries[locale].meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', dictionaries[locale].meta.description);
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      rtl: isRtl(dataLocale(locale)),
      m: dictionaries[locale],
      setLocale: (l) => {
        setLocaleState(l);
        try {
          localStorage.setItem(STORAGE_KEY, l);
        } catch {
          // Stockage indisponible : la langue ne sera pas mémorisée.
        }
      },
      price: (amount) => formatPrice(amount, dataLocale(locale)),
      place: (p) => placeName(p, dataLocale(locale)),
      // Chiffres occidentaux dans toutes les langues, groupés par espace fine comme les prix.
      number: (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
      decimal: (n) => n.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits: 1 }),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n hors de I18nProvider');
  return ctx;
}
