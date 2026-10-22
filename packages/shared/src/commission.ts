// Commission prélevée sur le transporteur à chaque livraison réussie, et portefeuille qui la paie.
// Gratuit tant que le super-administrateur n'active pas la commission (réglage commission.enabled).
// Commission = frais fixes + taux du prix convenu ; le taux dépend de la tranche où tombe le prix entier
// (taux unique, pas de tranches marginales). Montants en dinars entiers.

export interface CommissionTier {
  /** Borne haute incluse de la tranche, en DA ; null pour la dernière tranche. */
  upTo: number | null;
  ratePercent: number;
}

export interface CommissionSettings {
  enabled: boolean;
  /** Date d'entrée en vigueur (ISO) : les courses acceptées avant ne sont pas prélevées. null : immédiat. */
  effectiveFrom: string | null;
  fixedFee: number;
  tiers: CommissionTier[];
  /** Crédité une fois par transporteur à l'ouverture de son portefeuille. */
  welcomeBonus: number;
  /** Sous ce solde, le transporteur ne peut plus faire d'offre ni accepter de course. */
  minBalance: number;
  topUp: {
    holderName: string;
    ccpAccount: string;
    ccpKey: string;
    baridiMobRip: string;
    minAmount: number;
    maxAmount: number;
  };
}

export const DEFAULT_COMMISSION: CommissionSettings = {
  enabled: false,
  effectiveFrom: null,
  fixedFee: 50,
  tiers: [
    { upTo: 999, ratePercent: 15 },
    { upTo: 3000, ratePercent: 12 },
    { upTo: 10000, ratePercent: 10 },
    { upTo: null, ratePercent: 8 },
  ],
  welcomeBonus: 1000,
  minBalance: 0,
  // Coordonnées d'exemple, à remplacer depuis le back-office avant l'activation.
  topUp: {
    holderName: 'UCOLIS SARL',
    ccpAccount: '0000000000',
    ccpKey: '00',
    baridiMobRip: '00799999000000000000',
    minAmount: 500,
    maxAmount: 100_000,
  },
};

export interface CommissionBreakdown {
  grossPrice: number;
  fixedFee: number;
  ratePercent: number;
  variableCommission: number;
  totalCommission: number;
  netEarnings: number;
}

export function commissionRate(grossPrice: number, tiers = DEFAULT_COMMISSION.tiers): number {
  const tier = tiers.find((t) => t.upTo === null || grossPrice <= t.upTo) ?? tiers[tiers.length - 1];
  return tier?.ratePercent ?? 0;
}

/** Ventilation affichée au transporteur. La commission ne dépasse jamais le prix convenu. */
export function commissionBreakdown(
  grossPrice: number,
  settings: Pick<CommissionSettings, 'fixedFee' | 'tiers'> = DEFAULT_COMMISSION,
): CommissionBreakdown {
  const gross = Math.max(0, Math.round(grossPrice));
  const ratePercent = commissionRate(gross, settings.tiers);
  const fixedFee = Math.min(settings.fixedFee, gross);
  const variableCommission = Math.min(Math.round((gross * ratePercent) / 100), gross - fixedFee);
  const totalCommission = fixedFee + variableCommission;
  return { grossPrice: gross, fixedFee, ratePercent, variableCommission, totalCommission, netEarnings: gross - totalCommission };
}

/** Commission prélevée sur une course acceptée à cette date. */
export function isCommissionActive(settings: Pick<CommissionSettings, 'enabled' | 'effectiveFrom'>, at: Date): boolean {
  if (!settings.enabled) return false;
  return !settings.effectiveFrom || at.getTime() >= new Date(settings.effectiveFrom).getTime();
}

export function isWalletBlocked(balance: number, minBalance = DEFAULT_COMMISSION.minBalance): boolean {
  return balance < minBalance;
}

/** Bornes affichées dans la grille : « < 1 000 », « 1 000 à 3 000 », « > 10 000 ». */
export function commissionTierRanges(tiers = DEFAULT_COMMISSION.tiers): { from: number | null; upTo: number | null; ratePercent: number }[] {
  return tiers.map((t, i) => ({ from: i === 0 ? null : (tiers[i - 1]!.upTo ?? 0) + 1, upTo: t.upTo, ratePercent: t.ratePercent }));
}

export const WALLET_TRANSACTION_TYPES = [
  'welcome_bonus',
  'commission_debit',
  'commission_refund',
  'topup',
  'adjustment',
] as const;
export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

export const TOPUP_METHODS = ['ccp', 'baridimob'] as const;
export type TopUpMethod = (typeof TOPUP_METHODS)[number];

export const TOPUP_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type TopUpStatus = (typeof TOPUP_STATUSES)[number];

/** Suivi de la commission figée sur le colis à l'acceptation. */
export const PARCEL_COMMISSION_STATUSES = ['pending', 'charged', 'refunded', 'waived'] as const;
export type ParcelCommissionStatus = (typeof PARCEL_COMMISSION_STATUSES)[number];
