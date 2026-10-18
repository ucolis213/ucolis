// Formats partagés : masquage des données personnelles (appliqué par l'API), téléphone, montants.

import type { Locale } from './enums';

const MASK = '•';
const NBSP = ' ';

/** amina@gmail.com → a•••@gmail.com */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return MASK.repeat(3);
  return `${email[0]}${MASK.repeat(3)}${email.slice(at)}`;
}

/** +213551234512 → +213 5•• •• •• 12 */
export function maskPhone(phone: string): string {
  const m = /^\+213(\d)(\d{8})$/.exec(phone);
  if (!m) return MASK.repeat(6);
  const rest = m[2]!;
  return `+213 ${m[1]}${MASK}${MASK} ${MASK}${MASK} ${MASK}${MASK} ${rest.slice(6)}`;
}

export const PHONE_DZ_E164 = /^\+213[567]\d{8}$/;

/** Accepte 0551234567, 551234567, +213 551 23 45 67, 00213… ; renvoie l'E.164 ou null. */
export function normalizePhoneDz(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, '');
  let national: string;
  if (digits.startsWith('+213')) national = digits.slice(4);
  else if (digits.startsWith('00213')) national = digits.slice(5);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;
  const e164 = `+213${national}`;
  return PHONE_DZ_E164.test(e164) ? e164 : null;
}

/** +213551234512 → +213 551 23 45 12 */
export function formatPhoneDz(e164: string): string {
  const m = /^\+213(\d{3})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+213 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/** 3250 → « 3 250 DA » ou « 3 250 دج », chiffres occidentaux dans les deux langues. */
export function formatPrice(amount: number, locale: Locale): string {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${grouped}${NBSP}${locale === 'ar' ? 'دج' : 'DA'}`;
}

/** Immatriculation publique : seuls les 3 derniers chiffres restent visibles. */
export function maskPlate(plate: string): string {
  const digits = plate.replace(/\D/g, '');
  return `${MASK.repeat(3)}${digits.slice(-3)}`;
}
