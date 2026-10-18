// Suivi GPS (F12). Dernière position dans Redis (24 h, survit aux redémarrages de l'API),
// un point par minute historisé dans TrackPoint. Aucune position acceptée hors in_transit.

import { TRACKING_MIN_INTERVAL_MS, type TrackingPosition } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { ParcelModel } from '../parcels/model';
import { TrackPointModel } from './model';

export const trackingRoom = (parcelId: string) => `tracking:${parcelId}`;
const lastKey = (parcelId: string) => `tracking:${parcelId}`;
const historyKey = (parcelId: string) => `tracking:hist:${parcelId}`;
const LAST_TTL_S = 24 * 3600;
const HISTORY_EVERY_MS = 60_000;

export interface LastPosition {
  parcelId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  at: string;
  receivedAt: string;
}

export function createTrackingService(deps: Deps) {
  async function parties(parcelId: string) {
    const p = await ParcelModel.findById(parcelId, { sender: 1, assignedCarrier: 1, status: 1 }).lean();
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
    return p;
  }

  return {
    /** Expéditeur et transporteur retenu ; le staff passe par l'API d'administration. */
    async assertCanFollow(userId: string, parcelId: string) {
      const p = await parties(parcelId);
      if (p.sender.toString() !== userId && p.assignedCarrier?.toString() !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'Suivi réservé aux parties');
      }
      return p;
    },

    async record(carrierId: string, input: TrackingPosition): Promise<LastPosition | null> {
      const p = await parties(input.parcelId);
      if (p.assignedCarrier?.toString() !== carrierId) throw new AppError(403, 'FORBIDDEN', 'Transporteur non retenu');
      if (p.status !== 'in_transit') throw new AppError(409, 'INVALID_TRANSITION', 'Suivi actif seulement en livraison');
      const now = deps.now();
      const previous = await deps.cache.get<LastPosition>(lastKey(input.parcelId));
      if (previous && now.getTime() - new Date(previous.receivedAt).getTime() < TRACKING_MIN_INTERVAL_MS) {
        return null; // Limite : 1 message toutes les 5 s.
      }
      const last: LastPosition = {
        parcelId: input.parcelId,
        lat: input.lat,
        lng: input.lng,
        accuracy: input.accuracy ?? null,
        heading: input.heading ?? null,
        speed: input.speed ?? null,
        at: input.at.toISOString(),
        receivedAt: now.toISOString(),
      };
      await deps.cache.set(lastKey(input.parcelId), last, LAST_TTL_S);
      const lastHistory = await deps.cache.get<number>(historyKey(input.parcelId));
      if (!lastHistory || now.getTime() - lastHistory >= HISTORY_EVERY_MS) {
        await TrackPointModel.create({
          parcel: input.parcelId,
          carrier: carrierId,
          location: { type: 'Point', coordinates: [input.lng, input.lat] },
          accuracy: last.accuracy,
          heading: last.heading,
          speed: last.speed,
          at: input.at,
        });
        await deps.cache.set(historyKey(input.parcelId), now.getTime(), LAST_TTL_S);
      }
      deps.realtime.toRoom(trackingRoom(input.parcelId), 'tracking:update', last);
      return last;
    },

    last: (parcelId: string) => deps.cache.get<LastPosition>(lastKey(parcelId)),

    async history(parcelId: string) {
      const points = await TrackPointModel.find({ parcel: parcelId }).sort({ at: 1 }).lean();
      return points.map((pt) => ({
        lat: pt.location.coordinates[1],
        lng: pt.location.coordinates[0],
        at: pt.at.toISOString(),
        speed: pt.speed,
      }));
    },

    /** Fin du partage : prévient les clients du suivi que la livraison est terminée. */
    stop(parcelId: string, status: string) {
      deps.realtime.toRoom(trackingRoom(parcelId), 'tracking:stopped', { parcelId, status });
    },
  };
}

export type TrackingService = ReturnType<typeof createTrackingService>;
