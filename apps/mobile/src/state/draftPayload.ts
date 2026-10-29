// Conversion du brouillon vers le corps de POST /parcels, validé par les schémas de shared étape par étape.

import {
  parcelDetailsSchema,
  parcelOptionsSchema,
  parcelPhotosSchema,
  parcelRouteSchema,
  quickParcelSchema,
  volumeM3FromCm,
} from '@ucolis/shared';
import type { ParcelDraft } from './parcelDraft';

/**
 * Prix à appliquer quand la suggestion change, ou null pour garder celui du brouillon.
 * Le prix suit la suggestion tant que l'expéditeur ne l'a pas retouché : vide, pré-rempli par la suggestion,
 * ou égal à la suggestion sur la seule distance (annonce rapide, même publiée, que l'on complète). Un prix
 * saisi à la main n'est jamais écrasé.
 */
export function priceToApply(
  d: Pick<ParcelDraft, 'requestedPrice' | 'priceIsSuggested'>,
  suggested: number | null,
  distanceOnly: number | null,
): number | null {
  if (suggested === null || d.requestedPrice === suggested) return null;
  const followsSuggestion = d.requestedPrice === null || d.priceIsSuggested || d.requestedPrice === distanceOnly;
  return followsSuggestion ? suggested : null;
}

export const routePayload = (d: ParcelDraft) => ({
  pickup: d.pickup ? { ...d.pickup, details: d.pickup.details || undefined } : undefined,
  dropoff: d.dropoff ? { ...d.dropoff, details: d.dropoff.details || undefined } : undefined,
});

export const detailsPayload = (d: ParcelDraft) => ({
  title: d.title,
  category: d.category ?? undefined,
  description: d.description,
  weightKg: d.weightKg ?? undefined,
  dimensionsCm: {
    length: d.dimensionsCm.length ?? undefined,
    width: d.dimensionsCm.width ?? undefined,
    height: d.dimensionsCm.height ?? undefined,
  },
  fragile: d.fragile,
  prohibitedItemsDeclared: d.prohibitedItemsDeclared,
});

export const optionsPayload = (d: ParcelDraft) => ({
  vehicleTypes: d.vehicleTypes,
  desiredDate: d.desiredDate ?? undefined,
  timeSlot: d.timeSlot,
  // Brouillon enregistré avant l'ajout de l'heure : champ absent.
  desiredTime: d.desiredTime ?? null,
  flexibleDates: d.flexibleDates,
  urgent: d.urgent,
  recipient: d.recipientName || d.recipientPhone ? { name: d.recipientName, phone: d.recipientPhone } : undefined,
  paymentArrangement: d.paymentArrangement ?? undefined,
  requestedPrice: d.requestedPrice ?? undefined,
});

/** Publication rapide : trajet, titre, description, prix, déclaration et photos facultatives. */
export const quickPayload = (d: ParcelDraft) => ({
  mode: 'quick' as const,
  ...routePayload(d),
  title: d.title,
  description: d.description,
  requestedPrice: d.requestedPrice ?? undefined,
  prohibitedItemsDeclared: d.prohibitedItemsDeclared,
  photos: d.photos,
});

export const fullPayload = (d: ParcelDraft) => ({
  mode: 'full' as const,
  ...routePayload(d),
  ...detailsPayload(d),
  ...optionsPayload(d),
  photos: d.photos,
});

export const draftVolume = (d: ParcelDraft) => {
  const { length, width, height } = d.dimensionsCm;
  return length && width && height ? volumeM3FromCm(length, width, height) : 0;
};

/** Erreurs zod de l'étape, indexées par chemin (« pickup », « dimensionsCm.length »…). */
export function stepErrors(step: 'quick' | 'route' | 'details' | 'options' | 'photos', d: ParcelDraft): Record<string, string> {
  const result =
    step === 'quick'
      ? quickParcelSchema.safeParse(quickPayload(d))
      : step === 'route'
      ? parcelRouteSchema.safeParse(routePayload(d))
      : step === 'details'
        ? parcelDetailsSchema.safeParse(detailsPayload(d))
        : step === 'options'
          ? parcelOptionsSchema.safeParse(optionsPayload(d))
          : parcelPhotosSchema.safeParse({ photos: d.photos });
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_';
    out[path] ??= issue.code === 'invalid_type' ? 'validation.required' : issue.message;
  }
  return out;
}

/** Étape à laquelle renvoyer quand l'API refuse un champ. */
export function stepOfField(path: string): 'route' | 'details' | 'options' | 'photos' {
  if (path.startsWith('pickup') || path.startsWith('dropoff')) return 'route';
  if (/^(title|category|description|weightKg|dimensionsCm|fragile|prohibited)/.test(path)) return 'details';
  if (path.startsWith('photos')) return 'photos';
  return 'options';
}
