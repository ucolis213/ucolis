import { Schema, model } from 'mongoose';
import { pointSchema } from '../parcels/model';

// Un point par minute, conservé 30 jours pour l'instruction des litiges.
const trackPointSchema = new Schema({
  parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
  carrier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  location: { type: pointSchema, required: true },
  accuracy: { type: Number, default: null },
  heading: { type: Number, default: null },
  speed: { type: Number, default: null },
  at: { type: Date, required: true },
});
trackPointSchema.index({ parcel: 1, at: 1 });
trackPointSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export const TrackPointModel = model('TrackPoint', trackPointSchema);
