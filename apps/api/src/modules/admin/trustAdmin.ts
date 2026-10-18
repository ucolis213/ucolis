// Litiges, signalements, avis et conversations côté staff (lot 7).

import { Router, type Request } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { z } from 'zod';
import {
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  disputeDecisionSchema,
  hasPermission,
  hideSchema,
  paginationSchema,
  reasonOnlySchema,
  reportHandleSchema,
} from '@ucolis/shared';
import type { Deps } from '../../deps';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { idParam, paginate, validQuery } from '../../lib/http';
import { currentStaff, requirePermission } from '../../lib/staffAuth';
import { validate } from '../../lib/validate';
import { ConversationModel, MessageModel, type MessageLean } from '../conversations/model';
import { pairKeyOf, toMessageDto } from '../conversations/service';
import { OfferModel, type OfferLean } from '../offers/model';
import { toOfferDto } from '../offers/serializers';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { transitionParcel } from '../parcels/transitions';
import { TrackPointModel } from '../tracking/model';
import { TripModel } from '../trips/model';
import { recomputeRating } from '../trust/reviews';
import { DisputeModel, ReportModel, ReviewModel, type DisputeLean, type ReportLean, type ReviewLean } from '../trust/model';
import { toDisputeDto } from '../trust/disputes';
import { UserModel, type UserLean } from '../users/model';
import { toUserSummary } from '../users/serializers';
import type { Services } from '../../services';
import type { Claims } from './claims';

const disputesQuery = paginationSchema.extend({ status: z.enum(['open', 'in_review', 'resolved']).optional() });
const reportsQuery = paginationSchema.extend({
  status: z.enum(REPORT_STATUSES).optional(),
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
});
const reviewsQuery = paginationSchema.extend({
  hidden: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  userId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});
const conversationsQuery = paginationSchema.extend({
  reportId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  disputeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  userId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

async function summaries(ids: (Types.ObjectId | string | null | undefined)[]) {
  const users = await UserModel.find({ _id: { $in: ids.filter(Boolean) } }).lean();
  return new Map(users.map((u) => [u._id.toString(), toUserSummary(u as UserLean)]));
}

export function trustAdminRoutes(deps: Deps, services: Services, claims: Claims) {
  const r = Router();

  // --- Litiges ----------------------------------------------------------------------------------
  r.get('/disputes', requirePermission('disputes.handle'), validate(disputesQuery, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof disputesQuery>>(req);
    const filter = q.status ? { status: q.status } : { status: { $in: ['open', 'in_review'] } };
    const [total, items] = await Promise.all([
      DisputeModel.countDocuments(filter),
      DisputeModel.find(filter).sort({ createdAt: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    const parcels = await ParcelModel.find({ _id: { $in: items.map((d) => d.parcel) } }, { title: 1, reference: 1 }).lean();
    const titles = new Map(parcels.map((p) => [p._id.toString(), p]));
    const claimMap = await claims.map('dispute', items.map((d) => d._id.toString()));
    res.json(
      paginate(
        (items as DisputeLean[]).map((d) => ({
          ...toDisputeDto(d, titles.get(d.parcel.toString())?.title ?? ''),
          reference: titles.get(d.parcel.toString())?.reference ?? '',
          claim: claimMap.get(d._id.toString()) ?? null,
        })),
        q.page,
        q.limit,
        total,
      ),
    );
  });

  /** Dossier complet : colis, historique, offres, conversation et historique GPS. */
  r.get('/disputes/:id', requirePermission('disputes.handle'), async (req, res) => {
    const d = (await DisputeModel.findById(idParam(req)).lean()) as DisputeLean | null;
    if (!d) throw new AppError(404, 'NOT_FOUND', 'Litige introuvable');
    const p = (await ParcelModel.findById(d.parcel).lean()) as ParcelLean;
    const people = await summaries([d.openedBy, d.against, p.sender, p.assignedCarrier]);
    const offers = (await OfferModel.find({ parcel: p._id }).sort({ createdAt: 1 }).lean()) as OfferLean[];
    const carriers = await UserModel.find({ _id: { $in: offers.map((o) => o.carrier) } }).lean();
    const carrierById = new Map(carriers.map((c) => [c._id.toString(), c as UserLean]));
    const conversation = p.assignedCarrier
      ? await ConversationModel.findOne({ pairKey: pairKeyOf(p.sender.toString(), p.assignedCarrier.toString()), parcel: p._id }).lean()
      : null;
    const messages = conversation
      ? ((await MessageModel.find({ conversation: conversation._id }).sort({ createdAt: 1 }).limit(500).lean()) as MessageLean[])
      : [];
    const gps = await TrackPointModel.find({ parcel: p._id }).sort({ at: 1 }).lean();
    await audit(req, { action: 'dispute.view', targetType: 'dispute', targetId: d._id.toString() });
    res.json({
      dispute: toDisputeDto(d, p.title),
      people: Object.fromEntries(people),
      parcel: {
        id: p._id.toString(),
        reference: p.reference,
        title: p.title,
        status: p.status,
        finalPrice: p.finalPrice,
        statusHistory: p.statusHistory,
        pickup: p.pickup,
        dropoff: p.dropoff,
        deliveryProof: p.deliveryProof,
      },
      offers: offers.map((o) => toOfferDto(o, carrierById.get(o.carrier.toString())!, { fullPlate: true })),
      conversationId: conversation?._id.toString() ?? null,
      messages: messages.map(toMessageDto),
      gps: gps.map((pt) => ({ lat: pt.location.coordinates[1], lng: pt.location.coordinates[0], at: pt.at, speed: pt.speed })),
      claim: (await claims.map('dispute', [d._id.toString()])).get(d._id.toString()) ?? null,
    });
  });

  r.post('/disputes/:id/claim', requirePermission('disputes.handle'), async (req, res) => {
    const id = idParam(req);
    const result = await claims.claim('dispute', id, currentStaff(req).id);
    await DisputeModel.updateOne({ _id: id, status: 'open' }, { status: 'in_review', handledBy: currentStaff(req).id });
    res.json(result);
  });

  r.post('/disputes/:id/decision', requirePermission('disputes.handle'), validate(disputeDecisionSchema), async (req, res) => {
    const id = idParam(req);
    const staff = currentStaff(req);
    await claims.assertFree('dispute', id, staff.id);
    const d = (await DisputeModel.findById(id).lean()) as DisputeLean | null;
    if (!d || d.status === 'resolved') throw new AppError(409, 'INVALID_TRANSITION', 'Litige déjà tranché');
    const p = (await ParcelModel.findById(d.parcel).lean()) as ParcelLean;
    const now = deps.now();
    const outcome = req.body.outcome as 'delivered' | 'cancelled';
    if (outcome === 'delivered') {
      await services.delivery.complete(p, 'staff', null);
    } else {
      await transitionParcel({ parcel: p, to: 'cancelled', actor: 'staff', by: staff.id, reason: req.body.note, now, set: { 'deliveryCode.cipher': null } });
      // Tranché contre le transporteur : compte dans son taux de réussite.
      if (p.assignedCarrier) await UserModel.updateOne({ _id: p.assignedCarrier }, { $inc: { 'stats.disputesLost': 1 } });
      await deps.bus.emit('parcel.status_changed', { parcelId: p._id.toString(), from: 'disputed', to: 'cancelled', actorId: null });
    }
    await DisputeModel.updateOne(
      { _id: id },
      { status: 'resolved', outcome, decisionNote: req.body.note, handledBy: staff.id, resolvedAt: now },
    );
    await claims.release('dispute', id);
    await audit(req, { action: 'dispute.decide', targetType: 'dispute', targetId: id, reason: req.body.note, before: { status: 'disputed' }, after: { outcome } });
    await deps.bus.emit('dispute.resolved', { disputeId: id, parcelId: p._id.toString(), outcome, parties: [d.openedBy.toString(), d.against.toString()] });
    res.status(204).end();
  });

  // --- Signalements -----------------------------------------------------------------------------
  r.get('/reports', requirePermission('reports.handle'), validate(reportsQuery, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof reportsQuery>>(req);
    const filter: FilterQuery<ReportLean> = { status: q.status ?? 'open' };
    if (q.targetType) filter.targetType = q.targetType;
    const [total, items] = await Promise.all([
      ReportModel.countDocuments(filter),
      ReportModel.find(filter).sort({ createdAt: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    const reporters = await summaries(items.map((i) => i.reporter));
    const claimMap = await claims.map('report', items.map((i) => i._id.toString()));
    res.json(
      paginate(
        (items as ReportLean[]).map((i) => ({
          id: i._id.toString(),
          reporter: i.reporter ? (reporters.get(i.reporter.toString()) ?? null) : null,
          targetType: i.targetType,
          targetId: i.targetId.toString(),
          reason: i.reason,
          description: i.description,
          status: i.status,
          staffNote: i.staffNote,
          createdAt: i.createdAt,
          claim: claimMap.get(i._id.toString()) ?? null,
        })),
        q.page,
        q.limit,
        total,
      ),
    );
  });

  r.get('/reports/:id', requirePermission('reports.handle'), async (req, res) => {
    const rep = (await ReportModel.findById(idParam(req)).lean()) as ReportLean | null;
    if (!rep) throw new AppError(404, 'NOT_FOUND', 'Signalement introuvable');
    const id = rep.targetId;
    let target: unknown = null;
    switch (rep.targetType) {
      case 'user':
        target = (await summaries([id])).get(id.toString()) ?? null;
        break;
      case 'parcel':
        target = await ParcelModel.findById(id, { title: 1, reference: 1, status: 1, hidden: 1, sender: 1, description: 1 }).lean();
        break;
      case 'trip':
        target = await TripModel.findById(id).lean();
        break;
      case 'review':
        target = await ReviewModel.findById(id).lean();
        break;
      case 'message': {
        const m = (await MessageModel.findById(id).lean()) as MessageLean | null;
        target = m ? toMessageDto(m) : null;
        break;
      }
      case 'conversation':
        target = { conversationId: id.toString() };
        break;
    }
    const sameTarget = await ReportModel.countDocuments({ targetType: rep.targetType, targetId: rep.targetId });
    res.json({ report: { ...rep, id: rep._id.toString() }, target, sameTargetCount: sameTarget });
  });

  r.post('/reports/:id/claim', requirePermission('reports.handle'), async (req, res) => {
    res.json(await claims.claim('report', idParam(req), currentStaff(req).id));
  });

  for (const action of ['resolve', 'dismiss'] as const) {
    r.post(`/reports/:id/${action}`, requirePermission('reports.handle'), validate(reportHandleSchema), async (req, res) => {
      const id = idParam(req);
      const staff = currentStaff(req);
      await claims.assertFree('report', id, staff.id);
      const rep = await ReportModel.findOneAndUpdate(
        { _id: id, status: 'open' },
        { status: action === 'resolve' ? 'resolved' : 'dismissed', staffNote: req.body.note, handledBy: staff.id, handledAt: deps.now() },
        { new: true },
      ).lean();
      if (!rep) throw new AppError(409, 'INVALID_TRANSITION', 'Signalement déjà traité');
      await claims.release('report', id);
      await audit(req, { action: `report.${action}`, targetType: 'report', targetId: id, reason: req.body.note });
      if (rep.reporter) await deps.bus.emit('report.resolved', { reportId: id, reporterId: rep.reporter.toString() });
      res.status(204).end();
    });
  }

  // --- Avis -------------------------------------------------------------------------------------
  r.get('/reviews', requirePermission('reviews.moderate'), validate(reviewsQuery, 'query'), async (req, res) => {
    const q = validQuery<z.infer<typeof reviewsQuery>>(req);
    const filter: FilterQuery<ReviewLean> = {};
    if (q.hidden !== undefined) filter['hidden.isHidden'] = q.hidden ? true : { $ne: true };
    if (q.maxRating) filter.rating = { $lte: q.maxRating };
    if (q.userId) filter.$or = [{ author: q.userId }, { target: q.userId }];
    const [total, items] = await Promise.all([
      ReviewModel.countDocuments(filter),
      ReviewModel.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    ]);
    const dtos = await services.reviews.toDtos(items as ReviewLean[]);
    res.json(paginate(dtos.map((d, i) => ({ ...d, hidden: !!items[i]!.hidden?.isHidden })), q.page, q.limit, total));
  });

  r.post('/reviews/:id/hide', requirePermission('reviews.moderate'), validate(hideSchema), async (req, res) => {
    const review = await ReviewModel.findById(idParam(req)).lean();
    if (!review) throw new AppError(404, 'NOT_FOUND', 'Avis introuvable');
    await ReviewModel.updateOne(
      { _id: review._id },
      { hidden: { isHidden: req.body.hidden, reason: req.body.reason, by: currentStaff(req).id, at: deps.now() } },
    );
    await recomputeRating(review.target);
    await audit(req, { action: req.body.hidden ? 'review.hide' : 'review.unhide', targetType: 'review', targetId: review._id.toString(), reason: req.body.reason });
    res.status(204).end();
  });

  r.delete('/reviews/:id', requirePermission('reviews.moderate'), validate(reasonOnlySchema), async (req, res) => {
    const review = await ReviewModel.findById(idParam(req)).lean();
    if (!review) throw new AppError(404, 'NOT_FOUND', 'Avis introuvable');
    await ReviewModel.deleteOne({ _id: review._id });
    await recomputeRating(review.target);
    await audit(req, { action: 'review.delete', targetType: 'review', targetId: review._id.toString(), reason: req.body.reason, before: review });
    res.status(204).end();
  });

  // --- Conversations (lecture seule) ------------------------------------------------------------
  /**
   * view_reported : seulement via un signalement ou un litige qui cite la conversation.
   * view_all : n'importe laquelle, chaque accès étant journalisé.
   */
  async function allowedConversation(req: Request, conversationId: string) {
    const staff = currentStaff(req);
    if (hasPermission(staff, 'conversations.view_all')) return 'all';
    if (!hasPermission(staff, 'conversations.view_reported')) throw new AppError(403, 'PERMISSION_DENIED', 'Permission insuffisante');
    const { reportId, disputeId } = req.query as Record<string, string | undefined>;
    if (reportId) {
      const rep = await ReportModel.findById(reportId).lean();
      if (rep?.targetType === 'conversation' && rep.targetId.toString() === conversationId) return 'report';
      if (rep?.targetType === 'message') {
        const m = await MessageModel.findById(rep.targetId, { conversation: 1 }).lean();
        if (m?.conversation.toString() === conversationId) return 'report';
      }
    }
    if (disputeId) {
      const d = await DisputeModel.findById(disputeId).lean();
      const p = d ? await ParcelModel.findById(d.parcel, { sender: 1, assignedCarrier: 1 }).lean() : null;
      const conv = await ConversationModel.findById(conversationId, { pairKey: 1, parcel: 1 }).lean();
      if (p && conv && conv.parcel?.toString() === p._id.toString() && p.assignedCarrier && conv.pairKey === pairKeyOf(p.sender.toString(), p.assignedCarrier.toString())) {
        return 'dispute';
      }
    }
    throw new AppError(403, 'PERMISSION_DENIED', 'Conversation hors signalement ou litige');
  }

  r.get(
    '/conversations',
    requirePermission('conversations.view_all', 'conversations.view_reported'),
    validate(conversationsQuery, 'query'),
    async (req, res) => {
      const q = validQuery<z.infer<typeof conversationsQuery>>(req);
      const staff = currentStaff(req);
      const filter: FilterQuery<unknown> = {};
      if (!hasPermission(staff, 'conversations.view_all')) {
        // Liste limitée aux conversations citées par les signalements ouverts.
        const reports = await ReportModel.find({ targetType: { $in: ['conversation', 'message'] }, status: 'open' }).lean();
        const ids: Types.ObjectId[] = [];
        for (const rep of reports) {
          if (rep.targetType === 'conversation') ids.push(rep.targetId);
          else {
            const m = await MessageModel.findById(rep.targetId, { conversation: 1 }).lean();
            if (m) ids.push(m.conversation);
          }
        }
        filter._id = { $in: ids };
      }
      if (q.userId) filter.participants = new Types.ObjectId(q.userId);
      const [total, items] = await Promise.all([
        ConversationModel.countDocuments(filter),
        ConversationModel.find(filter).sort({ 'lastMessage.at': -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      ]);
      const people = await summaries(items.flatMap((c) => c.participants));
      res.json(
        paginate(
          items.map((c) => ({
            id: c._id.toString(),
            participants: c.participants.map((p) => people.get(p.toString())),
            parcelId: c.parcel?.toString() ?? null,
            lastMessage: c.lastMessage,
          })),
          q.page,
          q.limit,
          total,
        ),
      );
    },
  );

  r.get('/conversations/:id/messages', async (req, res) => {
    const id = idParam(req);
    const via = await allowedConversation(req, id);
    const [messages, conversation] = await Promise.all([
      MessageModel.find({ conversation: id }).sort({ createdAt: 1 }).limit(1000).lean() as Promise<MessageLean[]>,
      ConversationModel.findById(id, { participants: 1, parcel: 1 }).lean(),
    ]);
    const people = await summaries(conversation?.participants ?? []);
    await audit(req, { action: 'conversation.view', targetType: 'conversation', targetId: id, reason: via });
    res.json({
      items: messages.map((m) => ({ ...toMessageDto(m), text: m.text ?? null })),
      people: Object.fromEntries(people),
      parcelId: conversation?.parcel?.toString() ?? null,
    });
  });

  r.delete('/messages/:id', requirePermission('conversations.view_all', 'conversations.view_reported', 'reports.handle'), validate(reasonOnlySchema), async (req, res) => {
    const m = await MessageModel.findById(idParam(req)).lean();
    if (!m) throw new AppError(404, 'NOT_FOUND', 'Message introuvable');
    await allowedConversation(req, m.conversation.toString()).catch((err) => {
      if (!hasPermission(currentStaff(req), 'reports.handle')) throw err;
    });
    await MessageModel.updateOne({ _id: m._id }, { deletedByStaff: true });
    await audit(req, { action: 'message.delete', targetType: 'message', targetId: m._id.toString(), reason: req.body.reason, before: { text: m.text } });
    res.status(204).end();
  });

  return r;
}
