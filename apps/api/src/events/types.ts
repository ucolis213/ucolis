// Catalogue des événements de domaine émis par les services.

import type { ParcelStatus } from '@ucolis/shared';

interface OfferRef {
  offerId: string;
  parcelId: string;
  carrierId: string;
}

export interface DomainEvents {
  'user.registered': { userId: string };
  'user.suspended': { userId: string; reason: string };
  'user.sessions_revoked': { userId: string; deviceId?: string; reason: string };
  'carrier.verification_submitted': { userId: string };
  'parcel.created': { parcelId: string; senderId: string };
  /** Trajet, poids, dimensions ou date modifiés : les auteurs d'offres actives sont prévenus. */
  'parcel.updated': { parcelId: string; senderId: string };
  'parcel.status_changed': {
    parcelId: string;
    from: ParcelStatus;
    to: ParcelStatus;
    actorId: string | null;
    /** Utilisateurs à prévenir en plus des parties (ex. offrants d'un colis annulé). */
    notify?: string[];
  };
  'offer.created': OfferRef & { senderId: string; price: number; atAskingPrice: boolean; reoffer?: boolean };
  'offer.countered': OfferRef & { price: number };
  'offer.counter_rejected': OfferRef & { senderId: string; price: number };
  'offer.rejected': OfferRef;
  'offer.withdrawn': OfferRef & { senderId: string };
  'offer.accepted': OfferRef & {
    senderId: string;
    finalPrice: number;
    by: 'sender' | 'carrier';
    notSelected: string[];
  };
  'message.created': {
    messageId: string;
    conversationId: string;
    authorId: string | null;
    recipients: string[];
    preview: string;
    system: boolean;
  };
  'conversation.read': { conversationId: string; userId: string };
  'carrier.withdrawals_threshold': { carrierId: string; count: number };
  'carrier.verification_expired': { userId: string };
  'carrier.verification_decided': { userId: string; approved: boolean; reason: string | null };
  'carrier.document_expiring': { userId: string; days: number };
  'settings.updated': { key: string };
  'terms.published': { version: string };
  'broadcast.deliver': { userId: string; title: string; body: string; link: string | null };
  'trip.created': { tripId: string; carrierId: string };
  'trip.requested': { requestId: string; tripId: string; parcelId: string; carrierId: string; senderId: string };
  'trip.request_declined': { requestId: string; parcelId: string; senderId: string };
  'alert.matched': { userId: string; alertId: string; count: number; route: string; scope: 'parcels' | 'trips' };
  'pro.decided': { userId: string; decision: 'approved' | 'rejected' | 'revoked'; reason: string | null };
  'review.published': { reviewId: string; targetId: string; parcelId: string };
  'review.reminder': { parcelId: string; userId: string };
  'report.created': { reportId: string; targetType: string; targetId: string };
  'report.resolved': { reportId: string; reporterId: string };
  'dispute.opened': { disputeId: string; parcelId: string; against: string; openedBy: string };
  'dispute.resolved': { disputeId: string; parcelId: string; outcome: 'delivered' | 'cancelled'; parties: string[] };
  'delivery.reminder': { parcelId: string; kind: 'confirm' | 'late' };
}
