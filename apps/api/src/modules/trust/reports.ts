// Signalements (F16). Pas d'auto-signalement ni de doublon ouvert ; une annonce ou un trajet signalé
// par 3 utilisateurs distincts est masqué en attendant l'examen du staff.

import { AUTO_HIDE_REPORTS, type ReportReason, type ReportTargetType } from '@ucolis/shared';
import { Types } from 'mongoose';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { ConversationModel, MessageModel } from '../conversations/model';
import { ParcelModel } from '../parcels/model';
import { TripModel } from '../trips/model';
import { UserModel } from '../users/model';
import { ReportModel, ReviewModel } from './model';

/** Auteur de l'élément signalé (pour refuser l'auto-signalement) ; null si la cible est inaccessible. */
async function ownerOf(targetType: ReportTargetType, targetId: string, reporterId: string): Promise<string | null> {
  switch (targetType) {
    case 'user':
      return (await UserModel.exists({ _id: targetId })) ? targetId : null;
    case 'parcel':
      return (await ParcelModel.findById(targetId, { sender: 1 }).lean())?.sender.toString() ?? null;
    case 'trip':
      return (await TripModel.findById(targetId, { carrier: 1 }).lean())?.carrier.toString() ?? null;
    case 'review':
      return (await ReviewModel.findById(targetId, { author: 1 }).lean())?.author.toString() ?? null;
    case 'message': {
      const m = await MessageModel.findById(targetId, { author: 1, conversation: 1 }).lean();
      if (!m) return null;
      const conv = await ConversationModel.exists({ _id: m.conversation, participants: new Types.ObjectId(reporterId) });
      if (!conv) return null; // On ne signale que ce qu'on a pu lire.
      return m.author?.toString() ?? 'system';
    }
    case 'conversation': {
      const c = await ConversationModel.findById(targetId, { participants: 1 }).lean();
      if (!c || !c.participants.some((p) => p.toString() === reporterId)) return null;
      return c.participants.find((p) => p.toString() !== reporterId)!.toString();
    }
  }
}

export function createReportService(deps: Deps) {
  return {
    async create(
      reporterId: string,
      input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; description?: string },
    ) {
      const owner = await ownerOf(input.targetType, input.targetId, reporterId);
      if (!owner) throw new AppError(404, 'NOT_FOUND', 'Élément introuvable');
      if (owner === reporterId) throw new AppError(422, 'VALIDATION_ERROR', 'Impossible de se signaler soi-même');
      let report;
      try {
        report = await ReportModel.create({ reporter: reporterId, ...input, description: input.description ?? null });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw new AppError(409, 'ALREADY_REPORTED', 'Déjà signalé');
        throw err;
      }
      if (input.targetType === 'parcel' || input.targetType === 'trip') {
        const distinct = await ReportModel.distinct('reporter', {
          targetType: input.targetType,
          targetId: input.targetId,
          status: 'open',
          reporter: { $ne: null },
        });
        if (distinct.length >= AUTO_HIDE_REPORTS) {
          const hidden = { isHidden: true, reason: 'auto_reports', by: null, at: deps.now() };
          if (input.targetType === 'parcel') {
            await ParcelModel.updateOne({ _id: input.targetId, 'hidden.isHidden': { $ne: true } }, { hidden });
          } else {
            await TripModel.updateOne({ _id: input.targetId, 'hidden.isHidden': { $ne: true } }, { hidden });
          }
        }
      }
      await deps.bus.emit('report.created', { reportId: report.id, targetType: input.targetType, targetId: input.targetId });
      return { id: report.id as string };
    },

    /** Signalement automatique au staff (ex. 3 désistements en 30 jours). */
    async system(targetType: ReportTargetType, targetId: string, description: string) {
      const exists = await ReportModel.exists({ reporter: null, targetType, targetId, status: 'open' });
      if (exists) return;
      await ReportModel.create({ reporter: null, targetType, targetId, reason: 'other', description });
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
