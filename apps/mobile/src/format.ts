// Formats d'affichage : dates selon la langue, chiffres occidentaux dans toutes les langues.

import i18n from 'i18next';
import { formatPrice, getCommune, getWilaya, placeName } from '@ucolis/shared';
import { currentLocale } from './i18n';

const DATE_LOCALES = { fr: 'fr-DZ', ar: 'ar-DZ-u-nu-latn', en: 'en-GB' } as const;
const dateLocale = () => DATE_LOCALES[currentLocale()];

/** Heures sur 24 h dans les deux langues, quel que soit le réglage 12 h de l'appareil. */
const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };

export function formatDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

export function formatDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    ...TIME,
  });
}

export function formatTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString(dateLocale(), TIME);
}

/**
 * « Il y a 3 min », « Hier », etc., pour un instant passé ; au-delà d'une semaine, la date.
 * Textes traduits : Hermes ne fournit pas Intl.RelativeTimeFormat.
 */
export function formatRelative(iso: string | Date, now = new Date()) {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return i18n.t('common:relative.justNow');
  if (seconds < 3600) return i18n.t('common:relative.minutesAgo', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return i18n.t('common:relative.hoursAgo', { count: Math.floor(seconds / 3600) });
  const days = Math.floor(seconds / 86400);
  if (days === 1) return i18n.t('common:relative.yesterday');
  if (days < 7) return i18n.t('common:relative.daysAgo', { count: days });
  return formatDate(iso, { year: undefined });
}

export const price = (amount: number) => formatPrice(amount, currentLocale());

export function wilayaName(code: string) {
  const w = getWilaya(code);
  return w ? placeName(w, currentLocale()) : code;
}

export function communeName(code: string) {
  const c = getCommune(code);
  return c ? placeName(c, currentLocale()) : code;
}

export const placeLabel = (p: { commune: string; wilayaCode: string }) =>
  `${communeName(p.commune)}, ${wilayaName(p.wilayaCode)}`;

export const weight = (kg: number) =>
  kg < 1 ? `${Math.round(kg * 1000)} g` : `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;

export const distance = (km: number) => `${Math.round(km)} km`;
