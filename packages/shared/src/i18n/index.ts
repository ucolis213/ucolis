// Ressources de traduction partagées par le mobile, le back-office et les push du serveur.

import ar from './ar.json';
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
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const resources = { fr, ar } as const;
export const DEFAULT_LOCALE: Locale = 'fr';
export const RTL_LOCALES: readonly Locale[] = ['ar'];

export const isRtl = (locale: Locale) => RTL_LOCALES.includes(locale);

type Tree = { [key: string]: string | readonly string[] | Tree };

/** Liste à plat des clés (« common.tabs.home ») ; sert au test de parité FR/AR. Un tableau compte pour une clé. */
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
