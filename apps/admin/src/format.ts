// Formats d'affichage du back-office (français, chiffres occidentaux).

import { formatPrice, getWilaya, getCommune, translate } from '@ucolis/shared';

export const t = (key: string, params?: Record<string, string | number>) => translate('fr', key, params);

/** Libellé traduit d'une valeur d'énumération, ou la valeur brute si la clé manque. */
export const label = (prefix: string, value: string | null | undefined) => {
  if (!value) return '—';
  const text = t(`${prefix}.${value}`);
  return text === `${prefix}.${value}` ? value : text;
};

export function date(v: string | Date | null | undefined) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function dateTime(v: string | Date | null | undefined) {
  if (!v) return '—';
  return new Date(v).toLocaleString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const price = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatPrice(v, 'fr'));

export const wilaya = (code: string | null | undefined) => {
  if (!code) return '—';
  const w = getWilaya(code);
  return w ? `${code} · ${w.fr}` : code;
};

export const commune = (code: string | null | undefined) => (code ? (getCommune(code)?.fr ?? code) : '—');

export const hours = (h: number | null | undefined) => (h === null || h === undefined ? '—' : h < 48 ? `${h} h` : `${Math.round(h / 24)} j`);

export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  pending_deletion: 'Suppression demandée',
  deleted: 'Supprimé',
};

export const INTENT_LABELS: Record<string, string> = { sender: 'Expéditeur', carrier: 'Transporteur', both: 'Les deux' };
