import { Schema, model } from 'mongoose';
import { OTP_PURPOSES, PLATFORMS } from '@ucolis/shared';

const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: null },
    platform: { type: String, enum: PLATFORMS, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: Schema.Types.ObjectId, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1 });
refreshTokenSchema.index({ familyId: 1 });

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);

const otpCodeSchema = new Schema(
  {
    email: { type: String, required: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    /** Pour change_email : utilisateur à l'origine de la demande. */
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    sentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpCodeSchema.index({ email: 1, purpose: 1 });

export const OtpCodeModel = model('OtpCode', otpCodeSchema);
