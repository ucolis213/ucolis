// Valeurs par défaut des réglages (AppSetting). Le super-administrateur les modifie depuis le back-office.

import { z } from 'zod';
import { DEFAULT_PRICING, type PricingSettings } from './pricing';

export interface AppSettings {
  pricing: PricingSettings;
  limits: {
    activeParcelsIndividual: number;
    activeParcelsPro: number;
    activeTripsIndividual: number;
    activeTripsPro: number;
    maxCounterOffers: number;
  };
  /**
   * Transporteurs prévenus d'un nouveau colis près d'eux : rayon autour du départ, et nombre de push par
   * transporteur sur 24 h (au-delà, notification dans l'application seulement).
   */
  nearbyParcels: { radiusKm: number; dailyPushLimit: number };
  /**
   * Conservation des images (jours) : photos d'une annonce terminée (livrée, annulée, expirée), compté depuis la fin,
   * et images des messages, compté depuis l'envoi. Les photos de litige et les preuves de livraison sont gardées.
   */
  mediaRetention: { parcelPhotosDays: number; messageImagesDays: number };
  autoConfirmHours: number;
  parcelExpiryDays: number;
  reviewWindowDays: number;
  requireCarrierVerification: boolean;
  minAppVersion: string;
  maintenance: { enabled: boolean; message: { fr: string; ar: string } };
  support: { email: string; whatsapp: string };
  termsVersion: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  pricing: DEFAULT_PRICING,
  limits: {
    activeParcelsIndividual: 5,
    activeParcelsPro: 20,
    activeTripsIndividual: 3,
    activeTripsPro: 10,
    maxCounterOffers: 3,
  },
  nearbyParcels: { radiusKm: 30, dailyPushLimit: 5 },
  mediaRetention: { parcelPhotosDays: 90, messageImagesDays: 180 },
  autoConfirmHours: 72,
  parcelExpiryDays: 7,
  reviewWindowDays: 14,
  requireCarrierVerification: true,
  minAppVersion: '1.0.0',
  maintenance: { enabled: false, message: { fr: '', ar: '' } },
  support: { email: 'support@ucolis.com', whatsapp: '+213550000000' },
  termsVersion: '2026-10-01',
};

export type AppSettingKey = keyof AppSettings;
export const APP_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as AppSettingKey[];

/** Réponse de GET /app/config : seuls les réglages publics. */
export interface PublicAppConfig {
  minAppVersion: string;
  maintenance: AppSettings['maintenance'];
  termsVersion: string;
  pricing: PricingSettings;
  limits: AppSettings['limits'];
  requireCarrierVerification: boolean;
  support: AppSettings['support'];
}

export function toPublicConfig(s: AppSettings): PublicAppConfig {
  return {
    minAppVersion: s.minAppVersion,
    maintenance: s.maintenance,
    termsVersion: s.termsVersion,
    pricing: s.pricing,
    limits: s.limits,
    requireCarrierVerification: s.requireCarrierVerification,
    support: s.support,
  };
}

/** Compare deux versions semver simples (1.2.3). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

const positiveInt = z.number().int().positive();

/** Validation de chaque réglage modifiable par le super-administrateur. */
export const APP_SETTING_SCHEMAS: Record<AppSettingKey, z.ZodType> = {
  pricing: z.object({
    baseFee: z.number().min(0),
    tiers: z
      .array(z.object({ upToKm: z.number().positive().nullable(), ratePerKm: z.number().min(0) }))
      .min(1)
      .refine((t) => t[t.length - 1]?.upToKm === null, 'La dernière tranche doit être ouverte'),
    perKg: z.number().min(0),
    volumetricFactor: z.number().positive(),
    roundTo: positiveInt,
    minPrice: z.number().int().min(0),
  }),
  limits: z.object({
    activeParcelsIndividual: positiveInt,
    activeParcelsPro: positiveInt,
    activeTripsIndividual: positiveInt,
    activeTripsPro: positiveInt,
    maxCounterOffers: positiveInt,
  }),
  nearbyParcels: z.object({ radiusKm: positiveInt.max(200), dailyPushLimit: z.number().int().min(0).max(50) }),
  mediaRetention: z.object({ parcelPhotosDays: z.number().int().min(30).max(3650), messageImagesDays: z.number().int().min(30).max(3650) }),
  autoConfirmHours: positiveInt.max(24 * 30),
  parcelExpiryDays: positiveInt.max(90),
  reviewWindowDays: positiveInt.max(90),
  requireCarrierVerification: z.boolean(),
  minAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  maintenance: z.object({ enabled: z.boolean(), message: z.object({ fr: z.string().max(500), ar: z.string().max(500) }) }),
  support: z.object({ email: z.email(), whatsapp: z.string().regex(/^\+213[567]\d{8}$/) }),
  termsVersion: z.string().min(1).max(30),
};
