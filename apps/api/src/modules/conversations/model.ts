import { Schema, model, type FlattenMaps, type InferSchemaType, type Types } from 'mongoose';
import { MESSAGE_TYPES } from '@ucolis/shared';
import { fileSchema } from '../users/model';

const conversationSchema = new Schema(
  {
    participants: { type: [Schema.Types.ObjectId], ref: 'User', required: true },
    parcel: { type: Schema.Types.ObjectId, ref: 'Parcel', default: null },
    /** Identifiants des deux participants, triés et concaténés. */
    pairKey: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    lastMessage: {
      text: { type: String, default: null },
      type: { type: String, enum: MESSAGE_TYPES, default: null },
      author: { type: Schema.Types.ObjectId, default: null },
      params: { type: Schema.Types.Mixed, default: null },
      at: { type: Date, default: null },
    },
    unread: { type: Map, of: Number, default: {} },
    mutedBy: { type: [Schema.Types.ObjectId], default: [] },
    deletedFor: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true },
);
conversationSchema.index({ pairKey: 1, parcel: 1 }, { unique: true });
conversationSchema.index({ participants: 1, 'lastMessage.at': -1 });

export type ConversationLean = FlattenMaps<InferSchemaType<typeof conversationSchema>> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const ConversationModel = model('Conversation', conversationSchema);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    /** null pour un message système. */
    author: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: MESSAGE_TYPES, required: true },
    text: { type: String, default: null, maxlength: 2000 },
    image: { type: fileSchema, default: null },
    systemKey: { type: String, default: null },
    systemParams: { type: Schema.Types.Mixed, default: null },
    clientId: { type: String, default: undefined },
    readBy: [{ _id: false, user: Schema.Types.ObjectId, at: Date }],
    deletedByStaff: { type: Boolean, default: false },
  },
  { timestamps: true },
);
messageSchema.index({ conversation: 1, createdAt: -1 });
// Dédoublonnage de l'envoi optimiste : un clientId par conversation.
messageSchema.index(
  { conversation: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
);

export type MessageLean = FlattenMaps<InferSchemaType<typeof messageSchema>> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const MessageModel = model('Message', messageSchema);
