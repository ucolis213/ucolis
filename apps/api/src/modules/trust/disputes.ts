// Litiges (F16), côté parties : ouverture en in_transit ou delivered_pending (colis en disputed,
// validation automatique suspendue), réponse de l'autre partie sous 48 h.

import { DISPUTE_RESPONSE_HOURS, isOwnedUpload, type DisputeDto, type FileRef } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { withTransaction } from '../offers/service';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { transitionParcel } from '../parcels/transitions';
import { DisputeModel, type DisputeLean } from './model';

export function toDisputeDto(d: DisputeLean, parcelTitle: string): DisputeDto {
  return {
    id: d._id.toString(),
    parcelId: d.parcel.toString(),
    parcelTitle,
    openedBy: d.openedBy.toString(),
    against: d.against.toString(),
    reason: d.reason,
    description: d.description,
    photos: (d.photos ?? []) as FileRef[],
    response: d.response?.at
      ? { text: d.response.text ?? '', photos: (d.response.photos ?? []) as FileRef[], at: d.response.at.toISOString() }
      : null,
    responseDeadline: d.responseDeadline.toISOString(),
    status: d.status,
    outcome: d.outcome ?? null,
    decisionNote: d.decisionNote ?? null,
    resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

function assertPhotos(userId: string, photos: FileRef[]) {
  if (photos.some((p) => !isOwnedUpload(p.publicId, 'dispute_photo', userId))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Photo invalide');
  }
}

export function createDisputeService(deps: Deps) {
  async function loadFor(userId: string, id: string) {
    const d = (await DisputeModel.findById(id).lean()) as DisputeLean | null;
    if (!d || (d.openedBy.toString() !== userId && d.against.toString() !== userId)) {
      throw new AppError(404, 'NOT_FOUND', 'Litige introuvable');
    }
    return d;
  }

  return {
    async open(userId: string, parcelId: string, input: { reason: string; description: string; photos: FileRef[] }) {
      const p = (await ParcelModel.findById(parcelId).lean()) as ParcelLean | null;
      if (!p) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
      const isSender = p.sender.toString() === userId;
      const isCarrier = p.assignedCarrier?.toString() === userId;
      if (!isSender && !isCarrier) throw new AppError(403, 'FORBIDDEN', 'Réservé aux parties du colis');
      if (await DisputeModel.exists({ parcel: parcelId, status: { $in: ['open', 'in_review'] } })) {
        throw new AppError(409, 'DISPUTE_ALREADY_OPEN', 'Un litige est déjà ouvert');
      }
      assertPhotos(userId, input.photos);
      const now = deps.now();
      const against = (isSender ? p.assignedCarrier : p.sender)!.toString();
      const dispute = await withTransaction(async (session) => {
        await transitionParcel({
          parcel: p,
          to: 'disputed',
          actor: isSender ? 'sender' : 'carrier',
          by: userId,
          now,
          reason: input.reason,
          set: { autoConfirmAt: null },
          session,
        });
        try {
          const [d] = await DisputeModel.create(
            [
              {
                parcel: parcelId,
                openedBy: userId,
                against,
                reason: input.reason,
                description: input.description,
                photos: input.photos,
                responseDeadline: new Date(now.getTime() + DISPUTE_RESPONSE_HOURS * 3600_000),
                previousStatus: p.status,
              },
            ],
            { session },
          );
          return d!.toObject() as DisputeLean;
        } catch (err) {
          if ((err as { code?: number }).code === 11000) throw new AppError(409, 'DISPUTE_ALREADY_OPEN', 'Un litige est déjà ouvert');
          throw err;
        }
      });
      await deps.bus.emit('parcel.status_changed', { parcelId, from: p.status, to: 'disputed', actorId: userId });
      await deps.bus.emit('dispute.opened', { disputeId: dispute._id.toString(), parcelId, against, openedBy: userId });
      return toDisputeDto(dispute, p.title);
    },

    async get(userId: string, id: string) {
      const d = await loadFor(userId, id);
      const p = await ParcelModel.findById(d.parcel, { title: 1 }).lean();
      return toDisputeDto(d, p?.title ?? '');
    },

    async respond(userId: string, id: string, input: { text: string; photos: FileRef[] }) {
      const d = await loadFor(userId, id);
      if (d.against.toString() !== userId) throw new AppError(403, 'FORBIDDEN', 'Réservé à l’autre partie');
      if (d.status === 'resolved') throw new AppError(409, 'INVALID_TRANSITION', 'Litige tranché');
      if (d.response?.at) throw new AppError(409, 'INVALID_TRANSITION', 'Réponse déjà donnée');
      if (d.responseDeadline <= deps.now()) throw new AppError(409, 'INVALID_TRANSITION', 'Délai de réponse dépassé');
      assertPhotos(userId, input.photos);
      await DisputeModel.updateOne({ _id: id }, { response: { text: input.text, photos: input.photos, at: deps.now() } });
      return this.get(userId, id);
    },

    async openIdFor(parcelId: string) {
      const d = await DisputeModel.findOne({ parcel: parcelId, status: { $in: ['open', 'in_review'] } }, { _id: 1 }).lean();
      return d?._id.toString() ?? null;
    },
  };
}

export type DisputeService = ReturnType<typeof createDisputeService>;
