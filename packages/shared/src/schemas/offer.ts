import { z } from 'zod';
import { objectIdSchema } from './common';
import { priceSchema } from './parcel';
const messageSchema = z.string().trim().max(500).optional();

export const createOfferSchema = z.union([
  z.object({
    atAskingPrice: z.literal(true),
    vehicleId: objectIdSchema,
    proposedPickupDate: z.coerce.date(),
    message: messageSchema,
  }),
  z.object({
    atAskingPrice: z.literal(false).default(false),
    price: priceSchema,
    vehicleId: objectIdSchema,
    proposedPickupDate: z.coerce.date(),
    message: messageSchema,
  }),
]);

export const counterOfferSchema = z.object({ price: priceSchema, message: messageSchema });
export const reofferSchema = counterOfferSchema;

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
