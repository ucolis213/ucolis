import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import { TRIP_REQUEST_STATUSES, TRIP_STATUSES, VEHICLE_TYPES } from '@ucolis/shared';
import { pointSchema } from '../parcels/model';
import { fileSchema } from '../users/model';

const endpointSchema = new Schema(
  {
    wilayaCode: { type: String, required: true },
    commune: { type: String, required: true },
    location: { type: pointSchema, required: true },
  },
  { _id: false },
);

const tripSchema = new Schema(
  {
    carrier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    from: { type: endpointSchema, required: true },
    to: { type: endpointSchema, required: true },
    /** Wilayas étapes, dans l'ordre (5 au maximum). */
    stops: { type: [String], default: [] },
    departureAt: { type: Date, required: true },
    vehicle: {
      vehicleId: { type: Schema.Types.ObjectId, default: null },
      type: { type: String, enum: VEHICLE_TYPES, required: true },
      brand: String,
      model: String,
      photo: { type: fileSchema, default: null },
    },
    capacityKg: { type: Number, required: true, min: 1 },
    capacityM3: { type: Number, required: true, min: 0.01 },
    priceHint: {
      mode: { type: String, enum: ['flat', 'per_kg', null], default: null },
      amount: { type: Number, default: null },
    },
    recurrence: {
      weekdays: { type: [Number], default: [] },
      until: { type: Date, default: null },
    },
    /** Trajet généré par une récurrence : identifiant de la série. */
    seriesId: { type: String, default: null },
    note: { type: String, default: null, maxlength: 300 },
    status: { type: String, enum: TRIP_STATUSES, default: 'active' },
    hidden: {
      isHidden: { type: Boolean, default: false },
      reason: { type: String, default: null },
      by: { type: Schema.Types.ObjectId, default: null },
      at: { type: Date, default: null },
    },
    /** Dernière notification de correspondance (au plus une par heure). */
    lastMatchNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
tripSchema.index({ 'from.wilayaCode': 1, 'to.wilayaCode': 1, departureAt: 1 });
tripSchema.index({ carrier: 1, status: 1 });
tripSchema.index({ status: 1, departureAt: 1 });

export type TripLean = FlattenMaps<InferSchemaType<typeof tripSchema>> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const TripModel = model('Trip', tripSchema);

const tripRequestSchema = new Schema(
  {
    trip: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: TRIP_REQUEST_STATUSES, default: 'pending' },
  },
  { timestamps: true },
);
tripRequestSchema.index({ trip: 1, parcel: 1 }, { unique: true });
tripRequestSchema.index({ sender: 1, createdAt: -1 });

export type TripRequestLean = FlattenMaps<InferSchemaType<typeof tripRequestSchema>> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const TripRequestModel = model('TripRequest', tripRequestSchema);
