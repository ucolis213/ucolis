// Alertes (F10) et favoris (F7). Une nouvelle annonce qui correspond à une alerte déclenche au plus
// un push par alerte et par heure ; les correspondances suivantes sont regroupées (« 3 nouveaux colis »).

import type { Types } from 'mongoose';
import {
  CARRIER_INTENTS,
  MAX_SAVED_SEARCHES,
  POSITION_MAX_AGE_HOURS,
  communesWithinKm,
  getCommune,
  getWilaya,
  haversineKm,
  parcelListQuerySchema,
  tripListQuerySchema,
  type SavedSearchDto,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { NotificationModel } from '../notifications/model';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { fromPoint } from '../parcels/serializers';
import type { ParcelService } from '../parcels/service';
import { normalizeSearch } from '../parcels/service';
import type { TripLean } from '../trips/model';
import { UserModel, type UserLean } from '../users/model';
import { FavoriteModel, SavedSearchModel, type SavedSearchLean } from './model';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const EARTH_RADIUS_KM = 6371;

const toDto = (s: SavedSearchLean): SavedSearchDto => ({
  id: s._id.toString(),
  name: s.name,
  scope: s.scope,
  filters: (s.filters ?? {}) as Record<string, unknown>,
  notify: s.notify,
  createdAt: s.createdAt.toISOString(),
});

/** Même sémantique que les filtres de GET /parcels, appliquée à une annonce en mémoire. */
export function parcelMatches(p: ParcelLean, raw: Record<string, unknown>): boolean {
  const parsed = parcelListQuerySchema.safeParse(raw);
  if (!parsed.success) return false;
  const f = parsed.data;
  if (f.fromWilaya && p.pickup.wilayaCode !== f.fromWilaya) return false;
  if (f.toWilaya && p.dropoff.wilayaCode !== f.toWilaya) return false;
  if (f.maxWeight && (p.weightKg == null || p.weightKg > f.maxWeight)) return false;
  if (f.vehicleType && !p.vehicleTypes.includes(f.vehicleType)) return false;
  if (f.urgent && !p.urgent) return false;
  if (f.priceMin !== undefined && p.requestedPrice < f.priceMin) return false;
  if (f.priceMax !== undefined && p.requestedPrice > f.priceMax) return false;
  if (f.dateFrom && p.desiredDate && p.desiredDate < f.dateFrom) return false;
  if (f.dateTo && p.desiredDate && p.desiredDate > f.dateTo) return false;
  if (f.q && !(p.searchText ?? '').includes(normalizeSearch(f.q))) return false;
  if (f.lat !== undefined && f.lng !== undefined && f.radiusKm) {
    if (haversineKm({ lat: f.lat, lng: f.lng }, fromPoint(p.pickup.location)) > f.radiusKm) return false;
  }
  return true;
}

export function tripMatches(t: TripLean, raw: Record<string, unknown>): boolean {
  const parsed = tripListQuerySchema.safeParse(raw);
  if (!parsed.success) return false;
  const f = parsed.data;
  if (f.fromWilaya && t.from.wilayaCode !== f.fromWilaya) return false;
  if (f.toWilaya && t.to.wilayaCode !== f.toWilaya && !(t.stops ?? []).includes(f.toWilaya)) return false;
  if (f.vehicleType && t.vehicle?.type !== f.vehicleType) return false;
  return true;
}

const routeLabel = (from: string, to: string) => `${getWilaya(from)?.fr ?? from} → ${getWilaya(to)?.fr ?? to}`;

export function createAlertService(deps: Deps, parcels: ParcelService) {
  /** Regroupement : notifie tout de suite si l'alerte n'a rien envoyé depuis 1 h, sinon accumule. */
  async function hit(alert: SavedSearchLean, route: string) {
    const now = deps.now();
    const canSend = !alert.lastNotifiedAt || now.getTime() - alert.lastNotifiedAt.getTime() >= HOUR;
    if (canSend) {
      const count = (alert.pendingCount ?? 0) + 1;
      await SavedSearchModel.updateOne({ _id: alert._id }, { lastNotifiedAt: now, pendingCount: 0, pendingRoute: null });
      await deps.bus.emit('alert.matched', { userId: alert.user.toString(), alertId: alert._id.toString(), count, route, scope: alert.scope });
    } else {
      await SavedSearchModel.updateOne({ _id: alert._id }, { $inc: { pendingCount: 1 }, pendingRoute: route });
    }
  }

  return {
    async list(userId: string) {
      const items = (await SavedSearchModel.find({ user: userId }).sort({ createdAt: -1 }).lean()) as SavedSearchLean[];
      return { items: items.map(toDto) };
    },

    async create(userId: string, input: { name: string; scope: 'parcels' | 'trips'; filters: Record<string, unknown>; notify: boolean }) {
      if ((await SavedSearchModel.countDocuments({ user: userId })) >= MAX_SAVED_SEARCHES) {
        throw new AppError(422, 'VALIDATION_ERROR', '10 alertes au maximum');
      }
      const schema = input.scope === 'parcels' ? parcelListQuerySchema : tripListQuerySchema;
      if (!schema.safeParse(input.filters).success) throw new AppError(400, 'VALIDATION_ERROR', 'Filtres invalides');
      const doc = await SavedSearchModel.create({ ...input, user: userId });
      return toDto(doc.toObject() as SavedSearchLean);
    },

    async update(userId: string, id: string, patch: Partial<{ name: string; filters: Record<string, unknown>; notify: boolean }>) {
      const doc = await SavedSearchModel.findOneAndUpdate({ _id: id, user: userId }, { $set: patch }, { new: true }).lean();
      if (!doc) throw new AppError(404, 'NOT_FOUND', 'Alerte introuvable');
      return toDto(doc as SavedSearchLean);
    },

    async remove(userId: string, id: string) {
      const res = await SavedSearchModel.deleteOne({ _id: id, user: userId });
      if (!res.deletedCount) throw new AppError(404, 'NOT_FOUND', 'Alerte introuvable');
    },

    async onParcel(p: ParcelLean) {
      const alerts = (await SavedSearchModel.find({ scope: 'parcels', notify: true, user: { $ne: p.sender } }).lean()) as SavedSearchLean[];
      for (const a of alerts) {
        if (parcelMatches(p, a.filters as Record<string, unknown>)) await hit(a, routeLabel(p.pickup.wilayaCode, p.dropoff.wilayaCode));
      }
    },

    /**
     * Transporteurs proches du départ d'un nouveau colis : position de moins de 24 h dans le rayon, sinon commune
     * du profil dans le rayon. Distance à vol d'oiseau pour le message ; au-delà de dailyPushLimit notifications
     * sur 24 h, plus de push (notification dans l'application seulement).
     */
    async nearbyCarriers(p: ParcelLean, exclude: ReadonlySet<string> = new Set()) {
      const { nearbyParcels } = await deps.settings.getAll();
      const now = deps.now();
      const fresh = new Date(now.getTime() - POSITION_MAX_AGE_HOURS * HOUR);
      const origin = fromPoint(p.pickup.location);
      const sender = await UserModel.findById(p.sender, { blockedUsers: 1 }).lean();
      // Ni l'expéditeur, ni ceux qu'il bloque, ni ceux qui le bloquent.
      const base = {
        _id: { $nin: [p.sender, ...((sender?.blockedUsers as Types.ObjectId[] | undefined) ?? [])] },
        blockedUsers: { $ne: p.sender },
        intent: { $in: CARRIER_INTENTS },
        status: 'active',
      };
      const projection = { _id: 1, commune: 1, lastPosition: 1 };
      const [located, byCommune] = (await Promise.all([
        UserModel.find(
          {
            ...base,
            'lastPosition.at': { $gte: fresh },
            'lastPosition.location': {
              $geoWithin: { $centerSphere: [[origin.lng, origin.lat], nearbyParcels.radiusKm / EARTH_RADIUS_KM] },
            },
          },
          projection,
        ).lean(),
        UserModel.find(
          {
            ...base,
            commune: { $in: communesWithinKm(origin, nearbyParcels.radiusKm) },
            $or: [{ lastPosition: null }, { 'lastPosition.at': { $lt: fresh } }],
          },
          projection,
        ).lean(),
      ])) as [UserLean[], UserLean[]];

      const since = new Date(now.getTime() - DAY);
      const out: { userId: string; km: number; skipPush: boolean }[] = [];
      for (const u of [...located, ...byCommune]) {
        const id = u._id.toString();
        if (exclude.has(id)) continue;
        const from =
          u.lastPosition && u.lastPosition.at >= fresh ? fromPoint(u.lastPosition.location) : getCommune(u.commune)?.center;
        if (!from) continue;
        const sent = await NotificationModel.countDocuments({ recipient: u._id, type: 'nearby_parcel', createdAt: { $gte: since } });
        out.push({
          userId: id,
          km: Math.max(1, Math.round(haversineKm(origin, from))),
          skipPush: sent >= nearbyParcels.dailyPushLimit,
        });
      }
      return out;
    },

    async onTrip(t: TripLean) {
      const alerts = (await SavedSearchModel.find({ scope: 'trips', notify: true, user: { $ne: t.carrier } }).lean()) as SavedSearchLean[];
      for (const a of alerts) {
        if (tripMatches(t, a.filters as Record<string, unknown>)) await hit(a, routeLabel(t.from.wilayaCode, t.to.wilayaCode));
      }
    },

    /** Balayage horaire : envoie les correspondances accumulées, regroupées. */
    async flush() {
      const due = (await SavedSearchModel.find({
        pendingCount: { $gt: 0 },
        lastNotifiedAt: { $lte: new Date(deps.now().getTime() - HOUR) },
      }).lean()) as SavedSearchLean[];
      for (const a of due) {
        await SavedSearchModel.updateOne({ _id: a._id }, { lastNotifiedAt: deps.now(), pendingCount: 0, pendingRoute: null });
        await deps.bus.emit('alert.matched', { userId: a.user.toString(), alertId: a._id.toString(), count: a.pendingCount, route: a.pendingRoute ?? '', scope: a.scope });
      }
      return due.length;
    },

    // --- Favoris ---------------------------------------------------------------------------------

    async favorites(userId: string) {
      const favs = await FavoriteModel.find({ user: userId }).sort({ createdAt: -1 }).limit(200).lean();
      const list = (await ParcelModel.find({ _id: { $in: favs.map((f) => f.parcel) } }).lean()) as ParcelLean[];
      const order = new Map(favs.map((f, i) => [f.parcel.toString(), i]));
      list.sort((a, b) => order.get(a._id.toString())! - order.get(b._id.toString())!);
      return { items: (await parcels.cards(list)).map((c) => ({ ...c, isFavorite: true })) };
    },

    async addFavorite(userId: string, parcelId: string) {
      if (!(await ParcelModel.exists({ _id: parcelId }))) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
      await FavoriteModel.updateOne({ user: userId, parcel: parcelId }, { $setOnInsert: { user: userId, parcel: parcelId } }, { upsert: true });
    },

    async removeFavorite(userId: string, parcelId: string) {
      await FavoriteModel.deleteOne({ user: userId, parcel: parcelId });
    },
  };
}

export type AlertService = ReturnType<typeof createAlertService>;
