import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import {
  DISPUTE_REASONS,
  DISPUTE_STATUSES,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  REVIEW_DIRECTIONS,
} from '@ucolis/shared';
import { fileSchema } from '../users/model';

const hiddenSchema = {
  isHidden: { type: Boolean, default: false },
  reason: { type: String, default: null },
  by: { type: Schema.Types.ObjectId, default: null },
  at: { type: Date, default: null },
};

const reviewSchema = new Schema(
  {
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    direction: { type: String, enum: REVIEW_DIRECTIONS, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    criteria: { type: Schema.Types.Mixed, default: {} },
    comment: { type: String, default: null, maxlength: 500 },
    /** null tant que le double aveugle n'est pas levé. */
    publishedAt: { type: Date, default: null },
    reply: { text: { type: String, default: null }, at: { type: Date, default: null } },
    hidden: hiddenSchema,
  },
  { timestamps: true },
);
reviewSchema.index({ parcel: 1, author: 1 }, { unique: true });
reviewSchema.index({ target: 1, publishedAt: -1 });

export type ReviewLean = FlattenMaps<InferSchemaType<typeof reviewSchema>> & { _id: Types.ObjectId; createdAt: Date };
export const ReviewModel = model('Review', reviewSchema);

const reportSchema = new Schema(
  {
    /** null pour un signalement automatique (ex. 3 désistements en 30 jours). */
    reporter: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, default: null, maxlength: 1000 },
    status: { type: String, enum: REPORT_STATUSES, default: 'open' },
    staffNote: { type: String, default: null },
    handledBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true },
);
reportSchema.index(
  { reporter: 1, targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { status: 'open', reporter: { $type: 'objectId' } } },
);
reportSchema.index({ status: 1, createdAt: 1 });
reportSchema.index({ targetType: 1, targetId: 1, status: 1 });

export type ReportLean = FlattenMaps<InferSchemaType<typeof reportSchema>> & { _id: Types.ObjectId; createdAt: Date };
export const ReportModel = model('Report', reportSchema);

const disputeSchema = new Schema(
  {
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    against: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: DISPUTE_REASONS, required: true },
    description: { type: String, required: true, maxlength: 2000 },
    photos: { type: [fileSchema], default: [] },
    response: {
      text: { type: String, default: null },
      photos: { type: [fileSchema], default: [] },
      at: { type: Date, default: null },
    },
    responseDeadline: { type: Date, required: true },
    status: { type: String, enum: DISPUTE_STATUSES, default: 'open' },
    outcome: { type: String, enum: ['delivered', 'cancelled', null], default: null },
    decisionNote: { type: String, default: null },
    handledBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
    resolvedAt: { type: Date, default: null },
    previousStatus: { type: String, required: true },
  },
  { timestamps: true },
);
// Un seul litige ouvert par colis.
disputeSchema.index(
  { parcel: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'in_review'] } } },
);
disputeSchema.index({ status: 1, createdAt: 1 });

export type DisputeLean = FlattenMaps<InferSchemaType<typeof disputeSchema>> & { _id: Types.ObjectId; createdAt: Date };
export const DisputeModel = model('Dispute', disputeSchema);
