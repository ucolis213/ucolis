import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import {
  PARCEL_CATEGORIES,
  PARCEL_STATUSES,
  PAYMENT_ARRANGEMENTS,
  TIME_SLOTS,
  VEHICLE_TYPES,
} from '@ucolis/shared';
import { fileSchema } from '../users/model';

/** GeoJSON Point [lng, lat] en base ; { lat, lng } dans l'API. */
export const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const placeSchema = new Schema(
  {
    address: { type: String, required: true },
    details: { type: String, default: null },
    wilayaCode: { type: String, required: true },
    commune: { type: String, required: true },
    location: { type: pointSchema, required: true },
  },
  { _id: false },
);

const dimensionsSchema = new Schema(
  {
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

const statusEntrySchema = new Schema(
  {
    from: { type: String, enum: [...PARCEL_STATUSES, null], default: null },
    to: { type: String, enum: PARCEL_STATUSES, required: true },
    byType: { type: String, enum: ['user', 'staff', 'system'], required: true },
    by: { type: Schema.Types.ObjectId, default: null },
    at: { type: Date, required: true },
    reason: { type: String, default: null },
  },
  { _id: false },
);

const parcelSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 80 },
    description: { type: String, default: '', maxlength: 1000 },
    category: { type: String, enum: PARCEL_CATEGORIES, required: true },
    fragile: { type: Boolean, default: false },
    // Poids, dimensions, volume et date à null : non précisés (publication rapide).
    weightKg: { type: Number, default: null, min: 0.1, max: 30_000 },
    dimensionsCm: { type: dimensionsSchema, default: null },
    volumeM3: { type: Number, default: null },
    vehicleTypes: { type: [String], enum: VEHICLE_TYPES, required: true },
    pickup: { type: placeSchema, required: true },
    dropoff: { type: placeSchema, required: true },
    distanceKm: { type: Number, required: true },
    desiredDate: { type: Date, default: null },
    timeSlot: { type: String, enum: TIME_SLOTS, default: 'any' },
    flexibleDates: { type: Boolean, default: false },
    urgent: { type: Boolean, default: false },
    recipient: {
      type: new Schema({ name: String, phone: String }, { _id: false }),
      default: null,
    },
    paymentArrangement: { type: String, enum: PAYMENT_ARRANGEMENTS, required: true },
    requestedPrice: { type: Number, required: true, min: 100 },
    suggestedPrice: { type: Number, required: true },
    finalPrice: { type: Number, default: null },
    photos: { type: [fileSchema], default: [] },
    status: { type: String, enum: PARCEL_STATUSES, default: 'open' },
    statusHistory: { type: [statusEntrySchema], default: [] },
    assignedCarrier: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedOffer: { type: Schema.Types.ObjectId, ref: 'Offer', default: null },
    deliveryCode: {
      cipher: { type: String, default: null },
      attempts: { type: Number, default: 0 },
      lockedAt: { type: Date, default: null },
    },
    deliveryProof: {
      photo: { type: fileSchema, default: null },
      note: { type: String, default: null },
    },
    startedAt: { type: Date, default: null },
    declaredDeliveredAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    autoConfirmAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    cancellation: {
      by: { type: Schema.Types.ObjectId, default: null },
      reason: { type: String, default: null },
      at: { type: Date, default: null },
    },
    hidden: {
      isHidden: { type: Boolean, default: false },
      reason: { type: String, default: null },
      by: { type: Schema.Types.ObjectId, default: null },
      at: { type: Date, default: null },
    },
    /** Transporteurs ayant reçu un rappel ou une relance, pour l'idempotence des jobs. */
    remindersSent: { type: [String], default: [] },
    offersCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    /** Titre, description, communes et wilayas sans accents ni casse (recherche). */
    searchText: { type: String, default: '' },
  },
  { timestamps: true },
);

parcelSchema.index({ 'pickup.location': '2dsphere' });
parcelSchema.index({ 'dropoff.location': '2dsphere' });
parcelSchema.index({ status: 1, createdAt: -1 });
parcelSchema.index({ sender: 1, status: 1 });
parcelSchema.index({ assignedCarrier: 1, status: 1 });
parcelSchema.index({ 'pickup.wilayaCode': 1, 'dropoff.wilayaCode': 1, status: 1 });
parcelSchema.index(
  { title: 'text', description: 'text', 'pickup.commune': 'text', 'dropoff.commune': 'text', searchText: 'text' },
  { default_language: 'none', name: 'parcel_text' },
);

export type ParcelFields = InferSchemaType<typeof parcelSchema>;
export type ParcelLean = FlattenMaps<ParcelFields> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const ParcelModel = model('Parcel', parcelSchema);

const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const CounterModel = model('Counter', counterSchema);
