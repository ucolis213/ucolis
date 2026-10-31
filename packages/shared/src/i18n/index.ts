// Ressources de traduction partagées par le mobile, le back-office et les push du serveur.

import ar from './ar.json';
import en from './en.json';
import fr from './fr.json';
import type { Locale } from '../enums';

export const NAMESPACES = [
  'common',
  'auth',
  'parcel',
  'offer',
  'trip',
  'chat',
  'notif',
  'errors',
  'profile',
  'wallet',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const resources = { fr, ar, en } as const;
export const DEFAULT_LOCALE: Locale = 'fr';
export const RTL_LOCALES: readonly Locale[] = ['ar'];

export const isRtl = (locale: Locale) => RTL_LOCALES.includes(locale);

/**
 * Langues des contenus saisis au back-office (FAQ, CGU, confidentialité, maintenance, annonces) et des noms
 * de lieux : le français et l'arabe. L'anglais, propre à l'interface, y reprend le français.
 */
export const CONTENT_LOCALES = ['fr', 'ar'] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
export const contentLocale = (locale: Locale): ContentLocale => (locale === 'ar' ? 'ar' : 'fr');
export const isContentLocale = (v: unknown): v is ContentLocale => CONTENT_LOCALES.includes(v as ContentLocale);

type Tree = { [key: string]: string | readonly string[] | Tree };

/** Liste à plat des clés (« common.tabs.home ») ; sert au test de parité des langues. Un tableau compte pour une clé. */
export function flattenKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' || Array.isArray(v) ? [`${prefix}${k}`] : flattenKeys(v as Tree, `${prefix}${k}.`),
  );
}

/** Traduction minimale côté serveur (push), sans dépendre d'i18next. */
export function translate(
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], resources[locale]);
  if (typeof value !== 'string') return key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, p: string) => String(params[p] ?? ''));
}
