import { Schema, model, type InferSchemaType } from 'mongoose';
import { APP_SETTING_KEYS } from '@ucolis/shared';

const appSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, enum: APP_SETTING_KEYS },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'StaffAccount', default: null },
  },
  { timestamps: true },
);

export type AppSettingDoc = InferSchemaType<typeof appSettingSchema>;
export const AppSettingModel = model('AppSetting', appSettingSchema);
