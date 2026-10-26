import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import { OFFER_STATUSES, VEHICLE_TYPES } from '@ucolis/shared';
import { fileSchema } from '../users/model';

const roundSchema = new Schema(
  {
    by: { type: String, enum: ['carrier', 'sender'], required: true },
    price: { type: Number, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const offerSchema = new Schema(
  {
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
    carrier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** Copie du véhicule au moment de l'offre. */
    vehicle: {
      vehicleId: { type: Schema.Types.ObjectId, default: null },
      type: { type: String, enum: VEHICLE_TYPES, required: true },
      brand: String,
      model: String,
      plate: String,
      capacityKg: Number,
      volumeM3: Number,
      photo: { type: fileSchema, default: null },
    },
    /** Dernier prix proposé par le transporteur. */
    price: { type: Number, required: true, min: 100 },
    atAskingPrice: { type: Boolean, default: false },
    proposedPickupDate: { type: Date, required: true },
    status: { type: String, enum: OFFER_STATUSES, default: 'pending' },
    rounds: { type: [roundSchema], default: [] },
    counterCount: { type: Number, default: 0 },
    finalPrice: { type: Number, default: null },
    rejectedBecauseAccepted: { type: Boolean, default: false },
    /** Désistement après acceptation (3 en 30 jours : signalement automatique). */
    withdrawnAfterAcceptAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Une seule offre active (pending ou countered) par transporteur et par colis.
offerSchema.index(
  { parcel: 1, carrier: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'countered'] } } },
);
offerSchema.index({ carrier: 1, status: 1 });
offerSchema.index({ parcel: 1, status: 1 });

export type OfferFields = InferSchemaType<typeof offerSchema>;
export type OfferLean = FlattenMaps<OfferFields> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const OfferModel = model('Offer', offerSchema);
