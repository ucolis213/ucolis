// Avis (F15) : double aveugle (publiés quand les deux parties ont noté, ou à la fin de la fenêtre),
// un avis par auteur et par colis, non modifiable, une réponse publique de la personne notée.

import { Types } from 'mongoose';
import { CARRIER_CRITERIA, SENDER_CRITERIA, type ReviewDto, type ReviewStatusDto } from '@ucolis/shared';
import type { Deps } from '../../deps';
import { AppError } from '../../lib/errors';
import { paginate } from '../../lib/http';
import { ParcelModel, type ParcelLean } from '../parcels/model';
import { UserModel, type UserLean } from '../users/model';
import { toUserSummary } from '../users/serializers';
import { ReviewModel, type ReviewLean } from './model';

const DAY = 86_400_000;

/** Moyenne, nombre et répartition : seuls les avis publiés et non masqués comptent. */
export async function recomputeRating(userId: Types.ObjectId | string) {
  const reviews = await ReviewModel.find(
    { target: userId, publishedAt: { $ne: null }, 'hidden.isHidden': { $ne: true } },
    { rating: 1 },
  ).lean();
  const distribution = [0, 0, 0, 0, 0];
  for (const r of reviews) distribution[r.rating - 1]! += 1;
  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  await UserModel.updateOne({ _id: userId }, { rating: { average, count, distribution } });
}

export function createReviewService(deps: Deps) {
  async function context(parcelId: string, userId: string) {
    const p = (await ParcelModel.findById(parcelId).lean()) as ParcelLean | null;
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Colis introuvable');
    const isSender = p.sender.toString() === userId;
    const isCarrier = p.assignedCarrier?.toString() === userId;
    if (!isSender && !isCarrier) throw new AppError(403, 'FORBIDDEN', 'Réservé aux parties du colis');
    const { reviewWindowDays } = await deps.settings.getAll();
    const deadline = p.deliveredAt ? new Date(p.deliveredAt.getTime() + reviewWindowDays * DAY) : null;
    return {
      parcel: p,
      direction: isSender ? ('sender_to_carrier' as const) : ('carrier_to_sender' as const),
      targetId: (isSender ? p.assignedCarrier : p.sender)!.toString(),
      deadline,
      open: p.status === 'delivered' && !!deadline && deadline > deps.now(),
    };
  }

  async function publish(reviewIds: Types.ObjectId[]) {
    const now = deps.now();
    const reviews = await ReviewModel.find({ _id: { $in: reviewIds }, publishedAt: null }).lean();
    if (!reviews.length) return 0;
    await ReviewModel.updateMany({ _id: { $in: reviews.map((r) => r._id) } }, { publishedAt: now });
    for (const r of reviews) {
      await recomputeRating(r.target);
      await deps.bus.emit('review.published', { reviewId: r._id.toString(), targetId: r.target.toString(), parcelId: r.parcel.toString() });
    }
    return reviews.length;
  }

  return {
    publish,

    async status(parcelId: string, userId: string): Promise<ReviewStatusDto> {
      const ctx = await context(parcelId, userId);
      const already = !!(await ReviewModel.exists({ parcel: parcelId, author: userId }));
      const target = (await UserModel.findById(ctx.targetId).lean()) as UserLean | null;
      return {
        canReview: ctx.open && !already,
        alreadyReviewed: already,
        deadline: ctx.deadline?.toISOString() ?? null,
        direction: ctx.direction,
        target: target ? toUserSummary(target) : null,
      };
    },

    async create(parcelId: string, userId: string, input: { rating: number; criteria: Record<string, number>; comment?: string }) {
      const ctx = await context(parcelId, userId);
      if (!ctx.open) throw new AppError(409, 'INVALID_TRANSITION', 'La fenêtre d’avis est fermée');
      const allowed: readonly string[] = ctx.direction === 'sender_to_carrier' ? CARRIER_CRITERIA : SENDER_CRITERIA;
      const criteria = Object.fromEntries(Object.entries(input.criteria).filter(([k]) => allowed.includes(k)));
      let review;
      try {
        review = await ReviewModel.create({
          parcel: parcelId,
          author: userId,
          target: ctx.targetId,
          direction: ctx.direction,
          rating: input.rating,
          criteria,
          comment: input.comment?.trim() || null,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw new AppError(409, 'INVALID_TRANSITION', 'Avis déjà déposé');
        throw err;
      }
      // Double aveugle : publication quand les deux parties ont noté.
      const both = await ReviewModel.find({ parcel: parcelId }, { _id: 1 }).lean();
      if (both.length === 2) await publish(both.map((r) => r._id));
      return { id: review.id as string, published: both.length === 2 };
    },

    async reply(reviewId: string, userId: string, text: string) {
      const r = await ReviewModel.findById(reviewId).lean();
      if (!r || r.target.toString() !== userId) throw new AppError(404, 'NOT_FOUND', 'Avis introuvable');
      if (!r.publishedAt) throw new AppError(409, 'INVALID_TRANSITION', 'Avis non publié');
      const res = await ReviewModel.updateOne({ _id: reviewId, 'reply.text': null }, { reply: { text, at: deps.now() } });
      if (!res.modifiedCount) throw new AppError(409, 'INVALID_TRANSITION', 'Une seule réponse possible');
    },

    async toDtos(reviews: ReviewLean[]): Promise<ReviewDto[]> {
      const authors = await UserModel.find({ _id: { $in: reviews.map((r) => r.author) } }).lean();
      const byId = new Map(authors.map((a) => [a._id.toString(), a as UserLean]));
      return reviews.map((r) => ({
        id: r._id.toString(),
        parcelId: r.parcel.toString(),
        author: toUserSummary(byId.get(r.author.toString())!),
        targetId: r.target.toString(),
        direction: r.direction,
        rating: r.rating,
        criteria: (r.criteria ?? {}) as Record<string, number>,
        comment: r.comment ?? null,
        reply: r.reply?.text ? { text: r.reply.text, at: r.reply.at!.toISOString() } : null,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
    },

    async forUser(userId: string, page = 1, limit = 20) {
      const filter = { target: userId, publishedAt: { $ne: null }, 'hidden.isHidden': { $ne: true } };
      const [total, items] = await Promise.all([
        ReviewModel.countDocuments(filter),
        ReviewModel.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ]);
      return paginate(await this.toDtos(items as ReviewLean[]), page, limit, total);
    },

    async mine(userId: string) {
      const [received, given] = await Promise.all([
        ReviewModel.find({ target: userId, publishedAt: { $ne: null }, 'hidden.isHidden': { $ne: true } }).sort({ publishedAt: -1 }).limit(100).lean(),
        ReviewModel.find({ author: userId }).sort({ createdAt: -1 }).limit(100).lean(),
      ]);
      return { received: await this.toDtos(received as ReviewLean[]), given: await this.toDtos(given as ReviewLean[]) };
    },
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;
