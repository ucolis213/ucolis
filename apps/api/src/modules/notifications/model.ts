import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES } from '@ucolis/shared';

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.keys(NOTIFICATION_TYPES), required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    titleKey: { type: String, required: true },
    bodyKey: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    data: {
      parcelId: { type: String, default: null },
      offerId: { type: String, default: null },
      tripId: { type: String, default: null },
      conversationId: { type: String, default: null },
      disputeId: { type: String, default: null },
      userId: { type: String, default: null },
      /** Lien explicite (diffusion du staff). */
      url: { type: String, default: null },
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Conservées 90 jours.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export type NotificationLean = FlattenMaps<InferSchemaType<typeof notificationSchema>> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const NotificationModel = model('Notification', notificationSchema);
