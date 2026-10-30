// Traductions du site vitrine : français par défaut, arabe en RTL. La langue choisie est mémorisée dans le navigateur.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALES, formatPrice, isRtl, placeName, type Locale } from '@ucolis/shared';
import ar from './locales/ar.json';
import fr from './locales/fr.json';

export type Messages = typeof fr;
const dictionaries: Record<Locale, Messages> = { fr, ar };

const STORAGE_KEY = 'ucolis.site.locale';

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LOCALES.includes(stored as Locale)) return stored as Locale;
  } catch {
    // Stockage indisponible (navigation privée) : on se rabat sur la langue du navigateur.
  }
  return navigator.language?.startsWith('ar') ? 'ar' : DEFAULT_LOCALE;
}

/** Remplace les « {{nom}} » d'un texte par les paramètres donnés. */
export function interpolate(text: string, params: Record<string, string | number> = {}): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
}

interface I18nValue {
  locale: Locale;
  rtl: boolean;
  m: Messages;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  price: (amount: number) => string;
  place: (p: { fr: string; ar: string }) => string;
  number: (n: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtl(locale) ? 'rtl' : 'ltr';
    document.title = dictionaries[locale].meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', dictionaries[locale].meta.description);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Stockage indisponible : la langue ne sera pas mémorisée.
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      rtl: isRtl(locale),
      m: dictionaries[locale],
      setLocale,
      toggleLocale: () => setLocale(locale === 'fr' ? 'ar' : 'fr'),
      price: (amount) => formatPrice(amount, locale),
      place: (p) => placeName(p, locale),
      // Chiffres occidentaux dans les deux langues, groupés par espace fine comme les prix.
      number: (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n hors de I18nProvider');
  return ctx;
}
