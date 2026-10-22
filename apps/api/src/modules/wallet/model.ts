import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import { TOPUP_METHODS, TOPUP_STATUSES, WALLET_TRANSACTION_TYPES } from '@ucolis/shared';
import { fileSchema } from '../users/model';

/** Un portefeuille par transporteur, ouvert avec le bonus de bienvenue. Le solde peut être négatif. */
const walletSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);
walletSchema.index({ balance: 1 });

/** Historique en écriture seule : chaque mouvement garde le solde qui en résulte. */
const walletTransactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: WALLET_TRANSACTION_TYPES, required: true },
    /** Positif pour un crédit, négatif pour un débit. */
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', default: null },
    topUp: { type: Schema.Types.ObjectId, ref: 'TopUpRequest', default: null },
    staff: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
    note: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, createdAt: -1 });
// Un seul bonus de bienvenue par compte.
walletTransactionSchema.index(
  { user: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'welcome_bonus' }, name: 'one_welcome_bonus' },
);

const topUpRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: TOPUP_METHODS, required: true },
    reference: { type: String, default: null, maxlength: 60 },
    proof: { type: fileSchema, required: true },
    status: { type: String, enum: TOPUP_STATUSES, default: 'pending' },
    creditedAmount: { type: Number, default: null },
    decisionReason: { type: String, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
topUpRequestSchema.index({ status: 1, createdAt: 1 });
topUpRequestSchema.index({ user: 1, createdAt: -1 });
// Une seule demande en attente par transporteur.
topUpRequestSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_topup' },
);

type Lean<T> = FlattenMaps<T> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type WalletLean = Lean<InferSchemaType<typeof walletSchema>>;
export type WalletTransactionLean = Omit<Lean<InferSchemaType<typeof walletTransactionSchema>>, 'updatedAt'>;
export type TopUpLean = Lean<InferSchemaType<typeof topUpRequestSchema>>;

export const WalletModel = model('Wallet', walletSchema);
export const WalletTransactionModel = model('WalletTransaction', walletTransactionSchema);
export const TopUpRequestModel = model('TopUpRequest', topUpRequestSchema);
