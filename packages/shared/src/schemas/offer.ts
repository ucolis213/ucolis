import { z } from 'zod';
import { objectIdSchema } from './common';
import { priceSchema } from './parcel';
// Une offre ne porte que le prix : aucun texte libre avant l'acceptation (pas d'échange de coordonnées).

export const createOfferSchema = z.union([
  z.object({
    atAskingPrice: z.literal(true),
    vehicleId: objectIdSchema,
    proposedPickupDate: z.coerce.date(),
  }),
  z.object({
    atAskingPrice: z.literal(false).default(false),
    price: priceSchema,
    vehicleId: objectIdSchema,
    proposedPickupDate: z.coerce.date(),
  }),
]);

export const counterOfferSchema = z.object({ price: priceSchema });
export const reofferSchema = counterOfferSchema;

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;
