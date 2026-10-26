// Valeurs par défaut des réglages (AppSetting). Le super-administrateur les modifie depuis le back-office.

import { z } from 'zod';
import { DEFAULT_COMMISSION, type CommissionSettings } from './commission';
import { DEFAULT_PRICING, type PricingSettings } from './pricing';
import { DEFAULT_PRIMARY_COLOR, isValidBrandColor } from './theme';

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
  /** Commission et portefeuille des transporteurs ; désactivée au lancement. */
  commission: CommissionSettings;
  /** Couleur de marque de l'application et du back-office (les nuances en sont dérivées). */
  branding: { primaryColor: string };
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
  requireCarrierVerification: false,
  minAppVersion: '1.0.0',
  maintenance: { enabled: false, message: { fr: '', ar: '' } },
  support: { email: 'support@ucolis.com', whatsapp: '+213550000000' },
  termsVersion: '2026-10-01',
  commission: DEFAULT_COMMISSION,
  branding: { primaryColor: DEFAULT_PRIMARY_COLOR },
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
  commission: CommissionSettings;
  branding: AppSettings['branding'];
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
    commission: s.commission,
    branding: s.branding,
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
    // Le prix suggéré doit rester rond (multiple de 10 DA), comme tout prix saisi.
    roundTo: positiveInt.refine((n) => n % 10 === 0, 'validation.roundPrice'),
    minPrice: z.number().int().min(0).refine((n) => n % 10 === 0, 'validation.roundPrice'),
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
  commission: z.object({
    enabled: z.boolean(),
    effectiveFrom: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Date ISO attendue')
      .nullable(),
    fixedFee: z.number().int().min(0).max(10_000),
    tiers: z
      .array(z.object({ upTo: positiveInt.nullable(), ratePercent: z.number().min(0).max(100) }))
      .min(1)
      .refine((t) => t[t.length - 1]?.upTo === null, 'La dernière tranche doit être ouverte')
      .refine(
        (t) => t.slice(0, -1).every((x, i) => x.upTo !== null && (i === 0 || x.upTo > (t[i - 1]!.upTo ?? 0))),
        'Bornes croissantes, seule la dernière est ouverte',
      ),
    welcomeBonus: z.number().int().min(0).max(100_000),
    minBalance: z.number().int().min(-100_000).max(100_000),
    topUp: z
      .object({
        holderName: z.string().trim().min(1).max(80),
        ccpAccount: z.string().regex(/^\d{1,12}$/),
        ccpKey: z.string().regex(/^\d{2}$/),
        baridiMobRip: z.string().regex(/^\d{20}$/),
        minAmount: positiveInt,
        maxAmount: positiveInt,
      })
      .refine((v) => v.minAmount <= v.maxAmount, 'minAmount ≤ maxAmount'),
  }),
  branding: z.object({
    primaryColor: z
      .string()
      .refine(isValidBrandColor, 'Couleur #RRGGBB assez foncée pour du texte blanc (contraste ≥ 4,5)'),
  }),
};
