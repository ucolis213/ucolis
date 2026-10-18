// Tableau de bord : statistiques agrégées, sans donnée personnelle.

import { PARCEL_STATUSES } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { OfferModel } from '../offers/model';
import { ParcelModel } from '../parcels/model';
import { UserModel } from '../users/model';
import { queueStats } from './queues';

const DAY = 86_400_000;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export async function dashboardStats(deps: Deps) {
  const now = deps.now();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [total, active30, newThisMonth, suspended, byStatus, delivered, firstOffers] = await Promise.all([
    UserModel.countDocuments({ status: { $ne: 'deleted' } }),
    UserModel.countDocuments({ lastSeenAt: { $gte: new Date(now.getTime() - 30 * DAY) } }),
    UserModel.countDocuments({ createdAt: { $gte: monthStart } }),
    UserModel.countDocuments({ status: 'suspended' }),
    ParcelModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ParcelModel.aggregate<{ amount: number; n: number }>([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, amount: { $sum: '$finalPrice' }, n: { $sum: 1 } } },
    ]),
    // Délai avant la première offre, sur les 500 derniers colis ayant reçu une offre.
    OfferModel.aggregate<{ _id: unknown; first: Date }>([
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$parcel', first: { $first: '$createdAt' } } },
      { $sort: { first: -1 } },
      { $limit: 500 },
    ]),
  ]);
  const parcels = Object.fromEntries(PARCEL_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const row of byStatus) parcels[row._id] = row.n;
  // Taux de livraison : colis livrés parmi les colis ayant trouvé un transporteur.
  const accepted = ['assigned', 'in_transit', 'delivered_pending', 'delivered', 'disputed'].reduce(
    (sum, s) => sum + (parcels[s] ?? 0),
    0,
  );
  const created = await ParcelModel.find({ _id: { $in: firstOffers.map((f) => f._id) } }, { createdAt: 1 }).lean();
  const createdAt = new Map(created.map((p) => [p._id.toString(), p.createdAt.getTime()]));
  const delays = firstOffers
    .map((f) => {
      const c = createdAt.get(String(f._id));
      return c ? (f.first.getTime() - c) / 60_000 : null;
    })
    .filter((v): v is number => v !== null && v >= 0);
  return {
    users: { total, active30d: active30, newThisMonth, suspended },
    parcels,
    deliveredAmount: delivered[0]?.amount ?? 0,
    deliveryRate: accepted ? Math.round(((parcels.delivered ?? 0) / accepted) * 100) : null,
    medianMinutesToFirstOffer: median(delays),
    queues: await queueStats(now),
  };
}
