import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import { PERMISSIONS, STAFF_ROLES, STAFF_STATUSES } from '@ucolis/shared';

const staffSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    passwordHash: { type: String, default: null, select: false },
    role: { type: String, enum: STAFF_ROLES, required: true },
    permissions: { type: [String], enum: PERMISSIONS, default: [] },
    status: { type: String, enum: STAFF_STATUSES, default: 'invited' },
    /** Secret TOTP chiffré (AES-256-GCM). */
    totpSecret: { type: String, default: null, select: false },
    inviteTokenHash: { type: String, default: null },
    inviteExpiresAt: { type: Date, default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// Un seul super-administrateur.
staffSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: 'super_admin' } });

export type StaffLean = FlattenMaps<InferSchemaType<typeof staffSchema>> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const StaffModel = model('StaffAccount', staffSchema);

const staffSessionSchema = new Schema(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'StaffAccount', required: true },
    tokenHash: { type: String, required: true, unique: true },
    /** Fenêtre glissante : la session expire après 30 min d'inactivité. */
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);
staffSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const StaffSessionModel = model('StaffSession', staffSessionSchema);

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'StaffAccount', required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, default: null },
    reason: { type: String, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ createdAt: -1 });
auditSchema.index({ actor: 1, createdAt: -1 });
auditSchema.index({ targetType: 1, targetId: 1 });
// Ajout seul : aucune modification ni suppression.
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  auditSchema.pre(op, function () {
    throw new Error('Le journal d’audit est en ajout seul');
  });
}
export type AuditLean = FlattenMaps<InferSchemaType<typeof auditSchema>> & { _id: Types.ObjectId; createdAt: Date };
export const AuditLogModel = model('AuditLog', auditSchema);

/** Prise en charge d'un dossier : réservé 30 min à un membre du staff. */
const claimSchema = new Schema(
  {
    kind: { type: String, required: true },
    targetId: { type: String, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'StaffAccount', required: true },
    until: { type: Date, required: true },
  },
  { timestamps: true },
);
claimSchema.index({ kind: 1, targetId: 1 }, { unique: true });
claimSchema.index({ until: 1 }, { expireAfterSeconds: 0 });
export const ClaimModel = model('Claim', claimSchema);
