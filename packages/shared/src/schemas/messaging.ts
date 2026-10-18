import { z } from 'zod';
import { fileRefSchema, objectIdSchema } from './common';

export const openConversationSchema = z.object({
  userId: objectIdSchema,
  parcelId: objectIdSchema.optional(),
});

const clientId = z.string().min(8).max(64);

export const sendMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), clientId, text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal('image'), clientId, image: fileRefSchema }),
]);
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const muteSchema = z.object({ muted: z.boolean() });

export const MESSAGE_MAX_LENGTH = 2000;
export const TYPING_TIMEOUT_MS = 3000;
