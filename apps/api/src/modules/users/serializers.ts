// Formes renvoyées par l'API. Le profil public n'expose jamais email, téléphone ni nom complet.

import { maskPlate } from '@ucolis/shared';
import { accountTypeOf, type UserLean } from './model';

type AnyUser = Omit<UserLean, 'passwordHash'> & { passwordHash?: string };

const id = (u: { _id: { toString(): string } }) => u._id.toString();

export function badgesOf(u: AnyUser) {
  return {
    pro: u.pro?.status === 'approved',
    identity: u.carrierVerification?.status === 'approved',
  };
}

/** Taux de réussite : livrés / (livrés + désistements + litiges perdus). */
export function successRate(stats: AnyUser['stats']): number | null {
  const delivered = stats?.parcelsCarried ?? 0;
  const total = delivered + (stats?.withdrawals ?? 0) + (stats?.disputesLost ?? 0);
  return total === 0 ? null : Math.round((delivered / total) * 100);
}

/** Nom affiché : raison sociale pour un pro, prénom et initiale du nom pour un particulier. */
export function displayName(u: AnyUser): string {
  if (u.status === 'deleted') return 'Utilisateur supprimé';
  if (accountTypeOf(u) === 'professional' && u.pro?.companyName) return u.pro.companyName;
  return `${u.firstName} ${u.lastName.charAt(0)}.`;
}

/** Carte compacte (annonces, offres, conversations). */
export function toUserSummary(u: AnyUser) {
  const pro = accountTypeOf(u) === 'professional';
  return {
    id: id(u),
    displayName: displayName(u),
    avatar: pro && u.pro?.logo ? u.pro.logo : (u.avatar ?? null),
    accountType: accountTypeOf(u),
    badges: badgesOf(u),
    rating: { average: u.rating?.average ?? 0, count: u.rating?.count ?? 0 },
    deliveredCount: u.stats?.parcelsCarried ?? 0,
  };
}

export function toPublicUser(u: AnyUser) {
  const pro = accountTypeOf(u) === 'professional';
  return {
    ...toUserSummary(u),
    memberSince: u.createdAt,
    wilayaCode: u.wilayaCode,
    bio: u.status === 'deleted' ? '' : u.bio,
    company: pro
      ? {
          name: u.pro?.companyName,
          legalForm: u.pro?.legalForm,
          wilayaCode: u.pro?.wilayaCode,
          logo: u.pro?.logo ?? null,
        }
      : null,
    rating: {
      average: u.rating?.average ?? 0,
      count: u.rating?.count ?? 0,
      distribution: u.rating?.distribution ?? [0, 0, 0, 0, 0],
    },
    stats: {
      parcelsSent: u.stats?.parcelsSent ?? 0,
      parcelsCarried: u.stats?.parcelsCarried ?? 0,
      withdrawals: u.stats?.withdrawals ?? 0,
      successRate: successRate(u.stats),
      medianReplyMinutes: u.stats?.medianReplyMinutes ?? null,
    },
    vehicles: (u.vehicles ?? []).map((v) => ({
      id: id(v as never),
      type: v.type,
      brand: v.brand,
      model: v.model,
      plate: maskPlate(v.plate),
      capacityKg: v.capacityKg,
      volumeM3: v.volumeM3,
      photo: v.photo ?? null,
    })),
  };
}

/** Profil complet de l'utilisateur connecté (GET /me). */
export function toMe(u: AnyUser) {
  const notifications = u.preferences?.notifications;
  return {
    id: id(u),
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    emailVerified: !!u.emailVerifiedAt,
    phone: u.phone,
    wilayaCode: u.wilayaCode,
    commune: u.commune,
    bio: u.bio,
    avatar: u.avatar ?? null,
    intent: u.intent,
    accountType: accountTypeOf(u),
    badges: badgesOf(u),
    pro: {
      status: u.pro?.status ?? 'none',
      companyName: u.pro?.companyName ?? null,
      legalForm: u.pro?.legalForm ?? null,
      logo: u.pro?.logo ?? null,
      decisionReason: u.pro?.decisionReason ?? null,
    },
    carrierVerification: {
      status: u.carrierVerification?.status ?? 'not_submitted',
      decisionReason: u.carrierVerification?.decisionReason ?? null,
      licenseExpiresAt: u.carrierVerification?.licenseExpiresAt ?? null,
      insuranceExpiresAt: u.carrierVerification?.insuranceExpiresAt ?? null,
    },
    vehicles: (u.vehicles ?? []).map((v) => ({ ...v, id: id(v as never), _id: undefined })),
    rating: u.rating,
    stats: { ...u.stats, successRate: successRate(u.stats) },
    preferences: {
      language: u.preferences?.language ?? 'fr',
      notifications:
        notifications instanceof Map ? Object.fromEntries(notifications) : (notifications ?? {}),
    },
    terms: u.terms,
    status: u.status,
    deletionRequestedAt: u.deletionRequestedAt ?? null,
    createdAt: u.createdAt,
  };
}

export type MeDto = ReturnType<typeof toMe>;
export type UserSummaryDto = ReturnType<typeof toUserSummary>;
