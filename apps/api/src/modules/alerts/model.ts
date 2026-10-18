import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';

const savedSearchSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 60 },
    scope: { type: String, enum: ['parcels', 'trips'], required: true },
    filters: { type: Schema.Types.Mixed, default: {} },
    notify: { type: Boolean, default: true },
    lastNotifiedAt: { type: Date, default: null },
    /** Annonces correspondantes pas encore notifiées (regroupement : un push par heure au plus). */
    pendingCount: { type: Number, default: 0 },
    pendingRoute: { type: String, default: null },
  },
  { timestamps: true },
);
savedSearchSchema.index({ scope: 1, notify: 1 });

export type SavedSearchLean = FlattenMaps<InferSchemaType<typeof savedSearchSchema>> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const SavedSearchModel = model('SavedSearch', savedSearchSchema);

const favoriteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
  },
  { timestamps: true },
);
favoriteSchema.index({ user: 1, parcel: 1 }, { unique: true });
favoriteSchema.index({ parcel: 1 });
export const FavoriteModel = model('Favorite', favoriteSchema);
