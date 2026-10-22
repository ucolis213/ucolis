// Brouillon pré-rempli à partir d'une annonce (modification, ou duplication par un compte pro).

import type { ParcelDto } from '@ucolis/shared';
import type { ParcelDraft } from './parcelDraft';

export function draftFromParcel(p: Partial<ParcelDto>, keepDate = true): Partial<ParcelDraft> {
  // Sans poids, l'annonce vient d'une publication rapide : elle se modifie dans le même mode, et les valeurs
  // posées par l'API (catégorie, tous véhicules, règlement « autre ») restent à choisir si l'on complète.
  const quick = p.weightKg == null;
  return {
    mode: quick ? 'quick' : 'full',
    pickup: p.pickup ? { ...p.pickup, details: p.pickup.details ?? '' } : null,
    dropoff: p.dropoff ? { ...p.dropoff, details: p.dropoff.details ?? '' } : null,
    title: p.title ?? '',
    category: quick ? null : (p.category ?? null),
    description: p.description ?? '',
    weightKg: p.weightKg ?? null,
    dimensionsCm: p.dimensionsCm ?? { length: null, width: null, height: null },
    fragile: !!p.fragile,
    prohibitedItemsDeclared: true,
    vehicleTypes: quick ? [] : (p.vehicleTypes ?? []),
    desiredDate: keepDate ? (p.desiredDate ?? null) : null,
    timeSlot: p.timeSlot ?? 'any',
    desiredTime: keepDate ? (p.desiredTime ?? null) : null,
    flexibleDates: !!p.flexibleDates,
    urgent: !!p.urgent,
    recipientName: p.recipient?.name ?? '',
    recipientPhone: p.recipient?.phone ?? '',
    paymentArrangement: quick ? null : (p.paymentArrangement ?? null),
    requestedPrice: p.requestedPrice ?? null,
    photos: p.photos ?? [],
  };
}
