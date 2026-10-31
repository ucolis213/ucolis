// Catalogue des notifications : catégorie, envoi push, clés de traduction et lien profond.

import type { Locale } from './enums';

export const NOTIFICATION_CATEGORIES = [
  'offers',
  'deliveries',
  'messages',
  'alerts_trips',
  'account',
  'announcements',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** La catégorie Compte et vérification ne se désactive pas. */
export const MANDATORY_CATEGORIES: readonly NotificationCategory[] = ['account'];

export type DeepLinkTarget =
  | 'parcel'
  | 'parcel_offers'
  | 'offer'
  | 'tracking'
  | 'review'
  | 'my_reviews'
  | 'conversation'
  | 'listings'
  | 'verification'
  | 'pro_status'
  | 'dispute'
  | 'terms'
  | 'wallet'
  | 'none';

interface NotificationDef {
  category: NotificationCategory;
  push: boolean;
  link: DeepLinkTarget;
}

const def = (
  category: NotificationCategory,
  link: DeepLinkTarget,
  push = true,
): NotificationDef => ({
  category,
  push,
  link,
});

export const NOTIFICATION_TYPES = {
  offer_received: def('offers', 'parcel_offers'),
  offer_at_asking_price: def('offers', 'parcel_offers'),
  counter_offer_received: def('offers', 'offer'),
  counter_offer_rejected: def('offers', 'parcel_offers'),
  offer_accepted: def('offers', 'parcel'),
  offer_not_selected: def('offers', 'parcel'),
  offer_rejected: def('offers', 'offer'),
  offer_withdrawn: def('offers', 'parcel_offers'),
  offer_reactivated: def('offers', 'offer'),
  parcel_updated: def('offers', 'parcel'),
  parcel_cancelled: def('deliveries', 'parcel'),
  carrier_withdrew: def('deliveries', 'parcel'),
  parcel_expired: def('deliveries', 'parcel'),
  delivery_started: def('deliveries', 'tracking'),
  delivery_declared: def('deliveries', 'parcel'),
  delivery_confirm_reminder: def('deliveries', 'parcel'),
  delivery_completed: def('deliveries', 'review'),
  delivery_late: def('deliveries', 'parcel'),
  review_reminder: def('deliveries', 'review'),
  review_published: def('account', 'my_reviews'),
  new_message: def('messages', 'conversation'),
  new_listing_match: def('alerts_trips', 'listings'),
  trip_parcel_match: def('alerts_trips', 'parcel'),
  nearby_parcel: def('alerts_trips', 'parcel'),
  trip_request_received: def('alerts_trips', 'parcel'),
  trip_request_declined: def('alerts_trips', 'parcel'),
  favorite_unavailable: def('alerts_trips', 'parcel'),
  identity_approved: def('account', 'verification'),
  identity_rejected: def('account', 'verification'),
  identity_expiring: def('account', 'verification'),
  identity_expired: def('account', 'verification'),
  pro_approved: def('account', 'pro_status'),
  pro_rejected: def('account', 'pro_status'),
  pro_revoked: def('account', 'pro_status'),
  dispute_opened: def('deliveries', 'dispute'),
  dispute_resolved: def('deliveries', 'dispute'),
  report_resolved: def('account', 'none'),
  account_suspended: def('account', 'none', false),
  terms_updated: def('account', 'terms'),
  wallet_blocked: def('account', 'wallet'),
  wallet_topup_approved: def('account', 'wallet'),
  wallet_topup_rejected: def('account', 'wallet'),
  broadcast: def('announcements', 'none'),
} as const satisfies Record<string, NotificationDef>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export const notificationKeys = (type: NotificationType) => ({
  titleKey: `notif.${type}.title`,
  bodyKey: `notif.${type}.body`,
});

export interface DeepLinkData {
  parcelId?: string;
  offerId?: string;
  conversationId?: string;
  disputeId?: string;
}

/** Lien profond ucolis:// ouvert au toucher d'une notification. */
export function deepLinkFor(type: NotificationType, data: DeepLinkData): string | null {
  const link: DeepLinkTarget = NOTIFICATION_TYPES[type].link;
  switch (link) {
    case 'parcel':
      return data.parcelId ? `ucolis://parcel/${data.parcelId}` : null;
    case 'parcel_offers':
      return data.parcelId ? `ucolis://parcel/${data.parcelId}/offers` : null;
    case 'offer':
      return data.offerId ? `ucolis://offer/${data.offerId}` : null;
    case 'tracking':
      return data.parcelId ? `ucolis://tracking/${data.parcelId}` : null;
    case 'review':
      return data.parcelId ? `ucolis://parcel/${data.parcelId}/review` : null;
    case 'conversation':
      return data.conversationId ? `ucolis://conversation/${data.conversationId}` : null;
    case 'dispute':
      return data.disputeId ? `ucolis://dispute/${data.disputeId}` : null;
    case 'my_reviews':
      return 'ucolis://me/reviews';
    case 'listings':
      return 'ucolis://listings';
    case 'verification':
      return 'ucolis://me/carrier-verification';
    case 'pro_status':
      return 'ucolis://me/pro';
    case 'wallet':
      return 'ucolis://me/wallet';
    case 'terms':
      return 'ucolis://help/content/terms';
    case 'none':
      return null;
  }
}

export function shouldPush(
  type: NotificationType,
  prefs: Partial<Record<NotificationCategory, boolean>>,
): boolean {
  const { category, push } = NOTIFICATION_TYPES[type];
  if (!push) return false;
  if (MANDATORY_CATEGORIES.includes(category)) return true;
  return prefs[category] !== false;
}

/** Paramètres prêts à insérer dans la traduction : les montants sont formatés dans la langue. */
export function formatNotificationParams(
  params: Record<string, unknown>,
  locale: Locale,
  format: (amount: number, locale: Locale) => string,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).map(([k, v]) => [
      k,
      (k === 'price' || k.endsWith('Price') || k === 'amount' || k === 'balance') && typeof v === 'number' ? format(v, locale) : (v as string | number),
    ]),
  );
}
