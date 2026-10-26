// Formes des réponses de l'API, partagées avec le mobile et le back-office.

import type {
  AccountType,
  CarrierVerificationStatus,
  Intent,
  Locale,
  OfferStatus,
  ParcelCategory,
  ParcelStatus,
  PaymentArrangement,
  Platform,
  ProStatus,
  TimeSlot,
  UserStatus,
  VehicleType,
} from './enums';
import type {
  CommissionBreakdown,
  ParcelCommissionStatus,
  TopUpMethod,
  TopUpStatus,
  WalletTransactionType,
} from './commission';
import type { FileRef } from './schemas/common';

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface Badges {
  pro: boolean;
  identity: boolean;
}

export interface UserSummary {
  id: string;
  displayName: string;
  avatar: FileRef | null;
  accountType: AccountType;
  badges: Badges;
  rating: { average: number; count: number };
  deliveredCount: number;
}

export interface VehicleDto {
  id: string;
  type: VehicleType;
  brand: string;
  /** Chaîne vide si non précisé. */
  model: string;
  plate: string;
  /** null : non précisé. */
  capacityKg: number | null;
  volumeM3: number | null;
  photo: FileRef | null;
  isDefault?: boolean;
}

export interface PublicUser extends UserSummary {
  memberSince: string;
  wilayaCode: string;
  bio: string;
  company: {
    name: string;
    legalForm: string | null;
    wilayaCode: string | null;
    logo: FileRef | null;
  } | null;
  rating: { average: number; count: number; distribution: number[] };
  stats: {
    parcelsSent: number;
    parcelsCarried: number;
    withdrawals: number;
    successRate: number | null;
    medianReplyMinutes: number | null;
  };
  vehicles: VehicleDto[];
  /** Vrai si le visiteur connecté a eu une livraison acceptée avec ce profil (« Contacter » proposé). */
  canContact: boolean;
}

export interface Me {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  wilayaCode: string;
  commune: string;
  bio: string;
  avatar: FileRef | null;
  intent: Intent;
  accountType: AccountType;
  badges: Badges;
  pro: {
    status: ProStatus;
    companyName: string | null;
    legalForm: string | null;
    logo: FileRef | null;
    decisionReason: string | null;
  };
  carrierVerification: {
    status: CarrierVerificationStatus;
    decisionReason: string | null;
    licenseExpiresAt: string | null;
    insuranceExpiresAt: string | null;
  };
  vehicles: VehicleDto[];
  rating: { average: number; count: number; distribution: number[] };
  stats: {
    parcelsPublished: number;
    parcelsSent: number;
    parcelsCarried: number;
    withdrawals: number;
    disputesLost: number;
    successRate: number | null;
  };
  preferences: { language: Locale; notifications: Partial<Record<string, boolean>> };
  terms: { version: string | null; acceptedAt: string | null };
  status: UserStatus;
  deletionRequestedAt: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: Me;
}

export type TokenResponse = Omit<AuthResponse, 'user'>;

export interface SessionDto {
  id: string;
  deviceName: string | null;
  platform: Platform | null;
  lastActiveAt: string;
  current: boolean;
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  params: Record<string, string | number>;
  signature: string;
  maxBytes: number;
}

export interface PlaceDto {
  address: string;
  details?: string | null;
  wilayaCode: string;
  commune: string;
  location: { lat: number; lng: number };
}

export interface ParcelCardDto {
  id: string;
  reference: string;
  title: string;
  category: ParcelCategory;
  coverPhoto: FileRef | null;
  pickup: Pick<PlaceDto, 'wilayaCode' | 'commune' | 'location'>;
  dropoff: Pick<PlaceDto, 'wilayaCode' | 'commune' | 'location'>;
  distanceKm: number;
  /** null : non précisé (publication rapide), comme dimensionsCm, volumeM3 et desiredDate. */
  weightKg: number | null;
  desiredDate: string | null;
  timeSlot: TimeSlot;
  /** « HH:mm » ou null. */
  desiredTime: string | null;
  requestedPrice: number;
  offersCount: number;
  urgent: boolean;
  fragile: boolean;
  status: ParcelStatus;
  sender: UserSummary;
  createdAt: string;
  isFavorite?: boolean;
}

export type ParcelViewerRole =
  'guest' | 'sender' | 'assigned_carrier' | 'carrier_with_offer' | 'carrier_no_offer' | 'other';

export interface OfferRoundDto {
  by: 'carrier' | 'sender';
  price: number;
  at: string;
}

export interface OfferDto {
  id: string;
  parcelId: string;
  carrier: UserSummary;
  vehicle: Omit<VehicleDto, 'id' | 'isDefault'>;
  price: number;
  atAskingPrice: boolean;
  proposedPickupDate: string;
  status: OfferStatus;
  rounds: OfferRoundDto[];
  counterCount: number;
  /** Dernière contre-offre de l'expéditeur, quand l'offre est en countered. */
  counterPrice: number | null;
  finalPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParcelDto extends ParcelCardDto {
  description: string;
  photos: FileRef[];
  pickup: PlaceDto;
  dropoff: PlaceDto;
  dimensionsCm: { length: number; width: number; height: number } | null;
  volumeM3: number | null;
  vehicleTypes: VehicleType[];
  flexibleDates: boolean;
  paymentArrangement: PaymentArrangement;
  suggestedPrice: number;
  finalPrice: number | null;
  recipient: { name: string; phone: string } | null;
  assignedCarrier: UserSummary | null;
  statusHistory: {
    from: ParcelStatus | null;
    to: ParcelStatus;
    byType: 'user' | 'staff' | 'system';
    at: string;
    reason: string | null;
  }[];
  startedAt: string | null;
  declaredDeliveredAt: string | null;
  deliveredAt: string | null;
  autoConfirmAt: string | null;
  expiresAt: string | null;
  cancellation: { reason: string | null; at: string } | null;
  deliveryProof: { photo: FileRef | null; note: string | null } | null;
  deliveryCodeLocked: boolean;
  /** Ventilation de la commission, pour le transporteur retenu seulement. */
  commission: ParcelCommissionDto | null;
  viewer: {
    role: ParcelViewerRole;
    myOffer: OfferDto | null;
    /** Téléphone de l'autre partie, visible de assigned à 7 jours après delivered. */
    counterpartPhone: string | null;
    hasReviewed: boolean;
    conversationId: string | null;
    openDisputeId: string | null;
  };
}

export interface NotificationDto {
  id: string;
  type: string;
  category: string;
  titleKey: string;
  bodyKey: string;
  params: Record<string, string | number>;
  data: Partial<
    Record<
      'parcelId' | 'offerId' | 'tripId' | 'conversationId' | 'disputeId' | 'userId' | 'url',
      string | null
    >
  >;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface Counters {
  unreadMessages: number;
  unreadNotifications: number;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  authorId: string | null;
  type: 'text' | 'image' | 'system';
  text: string | null;
  image: FileRef | null;
  systemKey: string | null;
  systemParams: Record<string, string | number> | null;
  clientId: string | null;
  readBy: string[];
  deleted: boolean;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  other: UserSummary;
  parcel: { id: string; title: string; status: ParcelStatus; reference: string } | null;
  lastMessage: {
    text: string | null;
    type: string | null;
    authorId: string | null;
    at: string | null;
    /** Paramètres de traduction d'un message système (prix, etc.). */
    params: Record<string, string | number> | null;
  };
  unread: number;
  muted: boolean;
  /** Vrai si je bloque l'autre participant (le déblocage est alors proposé). */
  blockedByMe: boolean;
  /** Vrai tant qu'aucune offre n'a été acceptée entre les deux (sur ce colis, ou sur aucun pour une générale). */
  locked: boolean;
  /** Faux si la conversation est verrouillée ou si l'un des deux bloque l'autre (sans révéler qui). */
  canSend: boolean;
  updatedAt: string;
}

export interface ReviewDto {
  id: string;
  parcelId: string;
  author: UserSummary;
  targetId: string;
  direction: 'sender_to_carrier' | 'carrier_to_sender';
  rating: number;
  criteria: Partial<Record<string, number>>;
  comment: string | null;
  reply: { text: string; at: string } | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ReviewStatusDto {
  canReview: boolean;
  alreadyReviewed: boolean;
  /** L'auteur a déjà noté cette personne sur un autre colis : une seule note par personne. */
  alreadyRatedUser: boolean;
  deadline: string | null;
  direction: 'sender_to_carrier' | 'carrier_to_sender' | null;
  target: UserSummary | null;
}

export interface DisputeDto {
  id: string;
  parcelId: string;
  parcelTitle: string;
  openedBy: string;
  against: string;
  reason: string;
  description: string;
  photos: FileRef[];
  response: { text: string; photos: FileRef[]; at: string } | null;
  responseDeadline: string;
  status: 'open' | 'in_review' | 'resolved';
  outcome: 'delivered' | 'cancelled' | null;
  decisionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface TripDto {
  id: string;
  carrier: UserSummary;
  from: { wilayaCode: string; commune: string; location: { lat: number; lng: number } };
  to: { wilayaCode: string; commune: string; location: { lat: number; lng: number } };
  stops: string[];
  departureAt: string;
  vehicle: { type: VehicleType; brand: string | null; model: string | null; photo: FileRef | null };
  capacityKg: number;
  capacityM3: number;
  priceHint: { mode: 'flat' | 'per_kg'; amount: number } | null;
  recurrence: { weekdays: number[]; until: string } | null;
  seriesId: string | null;
  note: string | null;
  status: 'active' | 'full' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface SavedSearchDto {
  id: string;
  name: string;
  scope: 'parcels' | 'trips';
  filters: Record<string, unknown>;
  notify: boolean;
  createdAt: string;
}

/** Consommation Cloudinary du mois (tableau de bord du back-office). Volumes en octets. */
export interface StorageUsageDto {
  plan: string;
  updatedAt: string | null;
  /** Crédits du mois ; limit et percent à null si le plan n'en a pas. */
  credits: { used: number; limit: number | null; percent: number | null };
  storage: { bytes: number; credits: number };
  bandwidth: { bytes: number; credits: number };
  transformations: { count: number; credits: number };
  objects: number;
}

/** Commission figée sur le colis à l'acceptation, visible du seul transporteur retenu. */
export interface ParcelCommissionDto extends CommissionBreakdown {
  status: ParcelCommissionStatus;
  chargedAt: string | null;
}

export interface WalletDto {
  /** Commission activée par le super-administrateur (peut-être pas encore en vigueur). */
  enabled: boolean;
  /** Commission prélevée sur les courses acceptées maintenant. */
  active: boolean;
  effectiveFrom: string | null;
  /** Le compte peut-il transporter (et donc avoir un portefeuille) ? */
  eligible: boolean;
  balance: number;
  minBalance: number;
  blocked: boolean;
  pendingTopUp: TopUpDto | null;
}

export interface WalletTransactionDto {
  id: string;
  type: WalletTransactionType;
  /** Positif pour un crédit, négatif pour un débit. */
  amount: number;
  balanceAfter: number;
  parcel: { id: string; reference: string; title: string } | null;
  note: string | null;
  createdAt: string;
}

export interface TopUpDto {
  id: string;
  amount: number;
  creditedAmount: number | null;
  method: TopUpMethod;
  reference: string | null;
  status: TopUpStatus;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
}
