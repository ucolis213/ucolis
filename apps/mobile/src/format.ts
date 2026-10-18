// Formats d'affichage : dates selon la langue, chiffres occidentaux dans les deux langues.

import { formatPrice, getCommune, getWilaya, placeName } from '@ucolis/shared';
import { currentLocale } from './i18n';

const dateLocale = () => (currentLocale() === 'ar' ? 'ar-DZ-u-nu-latn' : 'fr-DZ');

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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
}

/** « il y a 3 min », « hier », etc. */
export function formatRelative(iso: string | Date, now = new Date()) {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(currentLocale() === 'ar' ? 'ar-u-nu-latn' : 'fr', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
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
