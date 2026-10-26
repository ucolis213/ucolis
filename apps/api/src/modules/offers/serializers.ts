import { maskPlate, type OfferDto } from '@ucolis/shared';
import type { UserLean } from '../users/model';
import { toUserSummary } from '../users/serializers';
import type { OfferLean } from './model';

export function toOfferDto(o: OfferLean, carrier: UserLean, opts: { fullPlate?: boolean } = {}): OfferDto {
  const rounds = (o.rounds ?? []).map((r) => ({
    by: r.by,
    price: r.price,
    at: r.at.toISOString(),
  }));
  const lastSender = [...rounds].reverse().find((r) => r.by === 'sender');
  const v = o.vehicle ?? { type: 'car' as const };
  return {
    id: o._id.toString(),
    parcelId: o.parcel.toString(),
    carrier: toUserSummary(carrier),
    vehicle: {
      type: v.type,
      brand: v.brand ?? '',
      model: v.model ?? '',
      plate: opts.fullPlate ? (v.plate ?? '') : maskPlate(v.plate ?? ''),
      capacityKg: v.capacityKg ?? null,
      volumeM3: v.volumeM3 ?? null,
      photo: v.photo ?? null,
    },
    price: o.price,
    atAskingPrice: o.atAskingPrice,
    proposedPickupDate: o.proposedPickupDate.toISOString(),
    status: o.status,
    rounds,
    counterCount: o.counterCount,
    counterPrice: o.status === 'countered' && lastSender ? lastSender.price : null,
    finalPrice: o.finalPrice ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
