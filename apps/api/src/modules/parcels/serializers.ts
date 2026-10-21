import type { ParcelCardDto, ParcelDto, PlaceDto } from '@ucolis/shared';
import type { UserLean } from '../users/model';
import { toUserSummary } from '../users/serializers';
import type { ParcelLean } from './model';

type Point = { coordinates: number[] } | null | undefined;

export const fromPoint = (p: Point) => ({ lat: p?.coordinates[1] ?? 0, lng: p?.coordinates[0] ?? 0 });
export const toPoint = (l: { lat: number; lng: number }) => ({ type: 'Point' as const, coordinates: [l.lng, l.lat] });

type Place = ParcelLean['pickup'];

const place = (p: Place): PlaceDto => ({
  address: p.address,
  details: p.details ?? null,
  wilayaCode: p.wilayaCode,
  commune: p.commune,
  location: fromPoint(p.location),
});

const short = (p: Place) => ({ wilayaCode: p.wilayaCode, commune: p.commune, location: fromPoint(p.location) });
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toParcelCard(p: ParcelLean, sender: UserLean, isFavorite?: boolean): ParcelCardDto {
  return {
    id: p._id.toString(),
    reference: p.reference,
    title: p.title,
    category: p.category,
    coverPhoto: p.photos?.[0] ?? null,
    pickup: short(p.pickup),
    dropoff: short(p.dropoff),
    distanceKm: p.distanceKm,
    weightKg: p.weightKg ?? null,
    desiredDate: iso(p.desiredDate),
    timeSlot: p.timeSlot,
    requestedPrice: p.requestedPrice,
    offersCount: p.offersCount,
    urgent: p.urgent,
    fragile: p.fragile,
    status: p.status,
    sender: toUserSummary(sender),
    createdAt: p.createdAt.toISOString(),
    ...(isFavorite !== undefined ? { isFavorite } : {}),
  };
}

export function toParcelDto(
  p: ParcelLean,
  ctx: {
    sender: UserLean;
    assignedCarrier: UserLean | null;
    viewer: ParcelDto['viewer'];
    showRecipient: boolean;
    isFavorite?: boolean;
  },
): ParcelDto {
  return {
    ...toParcelCard(p, ctx.sender, ctx.isFavorite),
    description: p.description,
    photos: p.photos ?? [],
    pickup: place(p.pickup),
    dropoff: place(p.dropoff),
    dimensionsCm: (p.dimensionsCm ?? null) as ParcelDto['dimensionsCm'],
    volumeM3: p.volumeM3 ?? null,
    vehicleTypes: p.vehicleTypes,
    flexibleDates: p.flexibleDates,
    paymentArrangement: p.paymentArrangement,
    suggestedPrice: p.suggestedPrice,
    finalPrice: p.finalPrice ?? null,
    recipient: ctx.showRecipient && p.recipient ? { name: p.recipient.name ?? '', phone: p.recipient.phone ?? '' } : null,
    assignedCarrier: ctx.assignedCarrier ? toUserSummary(ctx.assignedCarrier) : null,
    statusHistory: (p.statusHistory ?? []).map((h) => ({
      from: h.from ?? null,
      to: h.to,
      byType: h.byType,
      at: h.at.toISOString(),
      reason: h.reason ?? null,
    })),
    startedAt: iso(p.startedAt),
    declaredDeliveredAt: iso(p.declaredDeliveredAt),
    deliveredAt: iso(p.deliveredAt),
    autoConfirmAt: iso(p.autoConfirmAt),
    expiresAt: iso(p.expiresAt),
    cancellation: p.cancellation?.at
      ? { reason: p.cancellation.reason ?? null, at: p.cancellation.at.toISOString() }
      : null,
    deliveryProof:
      p.deliveryProof?.photo || p.deliveryProof?.note
        ? { photo: p.deliveryProof.photo ?? null, note: p.deliveryProof.note ?? null }
        : null,
    deliveryCodeLocked: !!p.deliveryCode?.lockedAt,
    viewer: ctx.viewer,
  };
}
