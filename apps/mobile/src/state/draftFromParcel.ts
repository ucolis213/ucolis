// Brouillon pré-rempli à partir d'une annonce (modification, ou duplication par un compte pro).

import type { ParcelDto } from '@ucolis/shared';
import type { ParcelDraft } from './parcelDraft';

export function draftFromParcel(p: Partial<ParcelDto>, keepDate = true): Partial<ParcelDraft> {
  return {
    pickup: p.pickup ? { ...p.pickup, details: p.pickup.details ?? '' } : null,
    dropoff: p.dropoff ? { ...p.dropoff, details: p.dropoff.details ?? '' } : null,
    title: p.title ?? '',
    category: p.category ?? null,
    description: p.description ?? '',
    weightKg: p.weightKg ?? null,
    dimensionsCm: p.dimensionsCm ?? { length: null, width: null, height: null },
    fragile: !!p.fragile,
    prohibitedItemsDeclared: true,
    vehicleTypes: p.vehicleTypes ?? [],
    desiredDate: keepDate ? (p.desiredDate ?? null) : null,
    timeSlot: p.timeSlot ?? 'any',
    flexibleDates: !!p.flexibleDates,
    urgent: !!p.urgent,
    recipientName: p.recipient?.name ?? '',
    recipientPhone: p.recipient?.phone ?? '',
    paymentArrangement: p.paymentArrangement ?? null,
    requestedPrice: p.requestedPrice ?? null,
    photos: p.photos ?? [],
  };
}
