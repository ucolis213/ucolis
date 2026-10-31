// Valeurs d'enum partagées par l'API, le mobile et le back-office.
// Les identifiants restent en anglais ; les libellés sont des clés de traduction.

export const LOCALES = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const INTENTS = ['sender', 'carrier', 'both'] as const;
export type Intent = (typeof INTENTS)[number];
/** Comptes qui transportent : « transporteur » ou « les deux ». */
export const CARRIER_INTENTS: readonly Intent[] = ['carrier', 'both'];

export const ACCOUNT_TYPES = ['individual', 'professional'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const USER_STATUSES = ['active', 'suspended', 'pending_deletion', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PRO_STATUSES = ['none', 'pending', 'approved', 'rejected', 'revoked'] as const;
export type ProStatus = (typeof PRO_STATUSES)[number];

export const LEGAL_FORMS = [
  'auto_entrepreneur',
  'artisan',
  'eurl',
  'sarl',
  'spa',
  'snc',
  'other',
] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number];

export const CARRIER_VERIFICATION_STATUSES = [
  'not_submitted',
  'pending',
  'approved',
  'rejected',
  'expired',
] as const;
export type CarrierVerificationStatus = (typeof CARRIER_VERIFICATION_STATUSES)[number];

export const VEHICLE_TYPES = [
  'moto',
  'car',
  'station_wagon',
  'utility',
  'van',
  'truck',
  'cargo',
  'semi_trailer',
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const PARCEL_CATEGORIES = [
  'documents',
  'clothing',
  'electronics',
  'food_non_perishable',
  'furniture',
  'appliances',
  'auto_parts',
  'other',
] as const;
export type ParcelCategory = (typeof PARCEL_CATEGORIES)[number];

export const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'any'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const PAYMENT_ARRANGEMENTS = [
  'cash_on_pickup',
  'cash_on_delivery',
  'paid_by_recipient',
  'other',
] as const;
export type PaymentArrangement = (typeof PAYMENT_ARRANGEMENTS)[number];

export const PARCEL_STATUSES = [
  'open',
  'negotiating',
  'assigned',
  'in_transit',
  'delivered_pending',
  'delivered',
  'cancelled',
  'expired',
  'disputed',
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

/** Statuts qui comptent dans la limite de colis actifs. */
export const ACTIVE_PARCEL_STATUSES: readonly ParcelStatus[] = [
  'open',
  'negotiating',
  'assigned',
  'in_transit',
  'delivered_pending',
  'disputed',
];

/** Statuts visibles dans la liste publique des annonces. */
export const PUBLIC_PARCEL_STATUSES: readonly ParcelStatus[] = ['open', 'negotiating'];

/** Statuts pendant lesquels une suppression de compte est refusée. */
export const ONGOING_DELIVERY_STATUSES: readonly ParcelStatus[] = [
  'assigned',
  'in_transit',
  'delivered_pending',
  'disputed',
];

export const OFFER_STATUSES = [
  'pending',
  'countered',
  'accepted',
  'rejected',
  'withdrawn',
  'cancelled',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const ACTIVE_OFFER_STATUSES: readonly OfferStatus[] = ['pending', 'countered'];

export const TRIP_STATUSES = ['active', 'full', 'completed', 'cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_REQUEST_STATUSES = ['pending', 'offered', 'declined', 'expired'] as const;
export type TripRequestStatus = (typeof TRIP_REQUEST_STATUSES)[number];

export const MESSAGE_TYPES = ['text', 'image', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const REVIEW_DIRECTIONS = ['sender_to_carrier', 'carrier_to_sender'] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

export const REPORT_TARGET_TYPES = [
  'user',
  'parcel',
  'trip',
  'review',
  'conversation',
  'message',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'inappropriate',
  'scam',
  'fake_listing',
  'abusive_behavior',
  'spam',
  'prohibited_item',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const DISPUTE_REASONS = [
  'not_delivered',
  'damaged',
  'lost',
  'price_disagreement',
  'no_show',
  'delay',
  'other',
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const DISPUTE_STATUSES = ['open', 'in_review', 'resolved'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const STAFF_ROLES = ['super_admin', 'moderator'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_STATUSES = ['invited', 'active', 'disabled'] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const UPLOAD_PURPOSES = [
  'parcel_photo',
  'avatar',
  'message_image',
  'identity_doc',
  'pro_doc',
  'dispute_photo',
  'delivery_proof',
  'vehicle_photo',
  'topup_proof',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const FILE_KINDS = ['image', 'pdf'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const OTP_PURPOSES = ['verify_email', 'reset_password', 'change_email'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const PLATFORMS = ['ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];
