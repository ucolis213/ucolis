import {
  Schema,
  model,
  type FlattenMaps,
  type HydratedDocument,
  type InferSchemaType,
  type Types,
} from 'mongoose';
import {
  CARRIER_VERIFICATION_STATUSES,
  INTENTS,
  LEGAL_FORMS,
  LOCALES,
  PRO_STATUSES,
  USER_STATUSES,
  VEHICLE_TYPES,
} from '@ucolis/shared';

export const fileSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    kind: { type: String, enum: ['image', 'pdf'], required: true },
  },
  { _id: false },
);

const vehicleSchema = new Schema({
  type: { type: String, enum: VEHICLE_TYPES, required: true },
  brand: { type: String, required: true, trim: true, maxlength: 50 },
  model: { type: String, trim: true, maxlength: 50, default: '' },
  plate: { type: String, required: true, trim: true, maxlength: 20 },
  capacityKg: { type: Number, min: 1, default: null },
  volumeM3: { type: Number, min: 0.01, default: null },
  photo: { type: fileSchema, default: null },
  isDefault: { type: Boolean, default: false },
});

const reviewDecision = {
  submittedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
  decisionReason: { type: String, default: null },
};

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerifiedAt: { type: Date, default: null },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    wilayaCode: { type: String, required: true },
    commune: { type: String, required: true },
    bio: { type: String, default: '', maxlength: 500 },
    avatar: { type: fileSchema, default: null },
    intent: { type: String, enum: INTENTS, required: true },
    pro: {
      status: { type: String, enum: PRO_STATUSES, default: 'none' },
      companyName: { type: String, default: null },
      legalForm: { type: String, enum: [...LEGAL_FORMS, null], default: null },
      rcNumber: { type: String, default: null },
      nif: { type: String, default: null },
      nis: { type: String, default: null },
      address: { type: String, default: null },
      wilayaCode: { type: String, default: null },
      commune: { type: String, default: null },
      logo: { type: fileSchema, default: null },
      documents: [{ _id: false, kind: String, file: fileSchema }],
      /** Nouveau dossier d'un compte déjà validé : le statut reste approved jusqu'à la décision. */
      pendingApplication: { type: Schema.Types.Mixed, default: null },
      ...reviewDecision,
    },
    carrierVerification: {
      status: { type: String, enum: CARRIER_VERIFICATION_STATUSES, default: 'not_submitted' },
      documents: {
        idFront: { type: fileSchema, default: null },
        idBack: { type: fileSchema, default: null },
        driverLicense: { type: fileSchema, default: null },
        vehicleRegistration: { type: fileSchema, default: null },
        insurance: { type: fileSchema, default: null },
      },
      licenseExpiresAt: { type: Date, default: null },
      insuranceExpiresAt: { type: Date, default: null },
      remindersSent: { type: [String], default: [] },
      ...reviewDecision,
    },
    vehicles: { type: [vehicleSchema], default: [] },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
      distribution: { type: [Number], default: [0, 0, 0, 0, 0] },
    },
    stats: {
      parcelsPublished: { type: Number, default: 0 },
      parcelsSent: { type: Number, default: 0 },
      parcelsCarried: { type: Number, default: 0 },
      withdrawals: { type: Number, default: 0 },
      disputesLost: { type: Number, default: 0 },
      medianReplyMinutes: { type: Number, default: null },
    },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    suspension: {
      reason: { type: String, default: null },
      until: { type: Date, default: null },
      by: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
      at: { type: Date, default: null },
    },
    deletionRequestedAt: { type: Date, default: null },
    preferences: {
      language: { type: String, enum: LOCALES, default: 'fr' },
      notifications: { type: Map, of: Boolean, default: {} },
    },
    blockedUsers: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    terms: {
      version: { type: String, default: null },
      acceptedAt: { type: Date, default: null },
    },
    lastSeenAt: { type: Date, default: null },
    /**
     * Dernière position d'un transporteur (GeoJSON Point [lng, lat]), envoyée à l'ouverture de l'application.
     * Sert seulement aux notifications de colis proches ; jamais exposée par l'API.
     */
    lastPosition: {
      type: new Schema(
        {
          location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], required: true },
          },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ status: 1 });
userSchema.index({ 'pro.status': 1 });
userSchema.index({ 'carrierVerification.status': 1 });
userSchema.index({ wilayaCode: 1 });
userSchema.index({ commune: 1 });
userSchema.index({ 'lastPosition.location': '2dsphere' }, { sparse: true });

/** Calculé, jamais stocké ni écrit par une route : professionnel seulement si le dossier est validé. */
userSchema.virtual('accountType').get(function () {
  return this.pro?.status === 'approved' ? 'professional' : 'individual';
});

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields> & { accountType: 'individual' | 'professional' };
export type UserLean = FlattenMaps<UserFields> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const UserModel = model('User', userSchema);

export const accountTypeOf = (u: { pro?: { status?: string | null } | null }) =>
  u.pro?.status === 'approved' ? ('professional' as const) : ('individual' as const);
