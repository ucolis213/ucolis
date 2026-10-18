import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import { LOCALES } from '@ucolis/shared';

export const CONTENT_KEYS = ['faq', 'terms', 'privacy'] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

// Une version publiée par clé et par langue, plus un brouillon en cours d'édition.
const contentSchema = new Schema(
  {
    key: { type: String, enum: CONTENT_KEYS, required: true },
    locale: { type: String, enum: LOCALES, required: true },
    body: { type: String, default: '' },
    draft: { type: String, default: null },
    version: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
  },
  { timestamps: true },
);
contentSchema.index({ key: 1, locale: 1 }, { unique: true });

export type ContentLean = FlattenMaps<InferSchemaType<typeof contentSchema>> & { _id: Types.ObjectId };
export const ContentModel = model('Content', contentSchema);

const broadcastSchema = new Schema(
  {
    title: { fr: String, ar: String },
    body: { fr: String, ar: String },
    segment: {
      kind: { type: String, enum: ['all', 'carriers', 'senders', 'pros', 'wilaya'], required: true },
      wilayaCode: { type: String, default: null },
    },
    link: { type: String, default: null },
    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    recipients: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', required: true },
  },
  { timestamps: true },
);
broadcastSchema.index({ sentAt: 1, scheduledAt: 1 });

export type BroadcastLean = FlattenMaps<InferSchemaType<typeof broadcastSchema>> & { _id: Types.ObjectId; createdAt: Date };
export const BroadcastModel = model('Broadcast', broadcastSchema);
