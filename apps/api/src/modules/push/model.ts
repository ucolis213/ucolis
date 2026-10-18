import { Schema, model } from 'mongoose';
import { PLATFORMS } from '@ucolis/shared';

const pushTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    deviceId: { type: String, required: true },
    appVersion: { type: String, default: null },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export const PushTokenModel = model('PushToken', pushTokenSchema);
