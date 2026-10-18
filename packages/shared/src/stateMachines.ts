// Machines à états du colis et de l'offre, reprises telles quelles du PRD.
// L'API s'en sert pour valider (409 INVALID_TRANSITION), le mobile pour afficher les actions possibles.

import type { OfferStatus, ParcelStatus } from './enums';

export type ParcelActor = 'sender' | 'carrier' | 'system' | 'job' | 'staff';
export type OfferActor = 'sender' | 'carrier' | 'system';

export interface Transition<S extends string, A extends string> {
  from: readonly S[];
  to: S;
  by: readonly A[];
  /** Clé courte décrivant le déclencheur, utile aux logs et aux tests. */
  trigger: string;
}

export const PARCEL_TRANSITIONS: readonly Transition<ParcelStatus, ParcelActor>[] = [
  { from: ['open'], to: 'negotiating', by: ['system'], trigger: 'first_offer' },
  { from: ['negotiating'], to: 'assigned', by: ['sender', 'carrier'], trigger: 'offer_accepted' },
  { from: ['assigned'], to: 'negotiating', by: ['carrier'], trigger: 'carrier_withdrew' },
  { from: ['assigned'], to: 'open', by: ['carrier'], trigger: 'carrier_withdrew' },
  {
    from: ['open', 'negotiating', 'assigned'],
    to: 'cancelled',
    by: ['sender'],
    trigger: 'sender_cancelled',
  },
  { from: ['open', 'negotiating'], to: 'expired', by: ['job'], trigger: 'expired' },
  { from: ['assigned'], to: 'in_transit', by: ['carrier'], trigger: 'delivery_started' },
  { from: ['in_transit'], to: 'delivered', by: ['carrier'], trigger: 'delivery_code' },
  { from: ['in_transit'], to: 'delivered_pending', by: ['carrier'], trigger: 'delivery_declared' },
  {
    from: ['delivered_pending'],
    to: 'delivered',
    by: ['sender', 'job'],
    trigger: 'delivery_confirmed',
  },
  {
    from: ['in_transit', 'delivered_pending'],
    to: 'disputed',
    by: ['sender', 'carrier'],
    trigger: 'dispute_opened',
  },
  { from: ['disputed'], to: 'delivered', by: ['staff'], trigger: 'dispute_resolved' },
  { from: ['disputed'], to: 'cancelled', by: ['staff'], trigger: 'dispute_resolved' },
];

export const OFFER_TRANSITIONS: readonly Transition<OfferStatus, OfferActor>[] = [
  { from: ['pending'], to: 'countered', by: ['sender'], trigger: 'counter' },
  { from: ['countered'], to: 'accepted', by: ['carrier'], trigger: 'accept_counter' },
  { from: ['countered'], to: 'pending', by: ['carrier'], trigger: 'reject_counter_or_reoffer' },
  { from: ['pending'], to: 'accepted', by: ['sender'], trigger: 'accept' },
  { from: ['pending', 'countered'], to: 'rejected', by: ['sender', 'system'], trigger: 'reject' },
  { from: ['pending', 'countered'], to: 'withdrawn', by: ['carrier'], trigger: 'withdraw' },
  { from: ['accepted'], to: 'withdrawn', by: ['carrier'], trigger: 'carrier_withdrew' },
  { from: ['rejected'], to: 'pending', by: ['system'], trigger: 'reactivated' },
  { from: ['pending', 'countered'], to: 'cancelled', by: ['system'], trigger: 'parcel_closed' },
];

/** Statut initial d'une offre créée par un transporteur vérifié. */
export const OFFER_INITIAL_STATUS: OfferStatus = 'pending';

export function canTransitionParcel(
  from: ParcelStatus,
  to: ParcelStatus,
  actor: ParcelActor,
): boolean {
  return PARCEL_TRANSITIONS.some(
    (t) => t.to === to && t.from.includes(from) && t.by.includes(actor),
  );
}

export function canTransitionOffer(from: OfferStatus, to: OfferStatus, actor: OfferActor): boolean {
  return OFFER_TRANSITIONS.some(
    (t) => t.to === to && t.from.includes(from) && t.by.includes(actor),
  );
}

/** Forçage exceptionnel par le staff parcels.moderate : tout statut, sauf pendant un litige ouvert. */
export function canForceParcelStatus(
  from: ParcelStatus,
  to: ParcelStatus,
  hasOpenDispute: boolean,
): boolean {
  return from !== to && !hasOpenDispute;
}

export function nextParcelStatuses(from: ParcelStatus, actor: ParcelActor): ParcelStatus[] {
  return PARCEL_TRANSITIONS.filter((t) => t.from.includes(from) && t.by.includes(actor)).map(
    (t) => t.to,
  );
}

// ---------------------------------------------------------------------------
// Barre d'actions contextuelle du détail d'un colis (F7).

export type ParcelViewer =
  'guest' | 'carrier_no_offer' | 'carrier_with_offer' | 'sender' | 'assigned_carrier' | 'other';

export type ParcelAction =
  | 'login_to_offer'
  | 'accept_asking_price'
  | 'make_offer'
  | 'ask_question'
  | 'favorite'
  | 'report'
  | 'view_my_offer'
  | 'answer_counter'
  | 'withdraw_offer'
  | 'message'
  | 'view_offers'
  | 'edit'
  | 'cancel_listing'
  | 'share'
  | 'call'
  | 'view_delivery_code'
  | 'cancel_delivery'
  | 'start_delivery'
  | 'withdraw_assignment'
  | 'track'
  | 'open_dispute'
  | 'enter_delivery_code'
  | 'declare_delivery'
  | 'confirm_delivery'
  | 'rate';

const ACTIONS: Partial<Record<ParcelViewer, Partial<Record<ParcelStatus, ParcelAction[]>>>> = {
  guest: {
    open: ['login_to_offer'],
    negotiating: ['login_to_offer'],
  },
  carrier_no_offer: {
    open: ['accept_asking_price', 'make_offer', 'ask_question', 'favorite', 'report'],
    negotiating: ['accept_asking_price', 'make_offer', 'ask_question', 'favorite', 'report'],
  },
  carrier_with_offer: {
    open: ['view_my_offer', 'answer_counter', 'withdraw_offer', 'message'],
    negotiating: ['view_my_offer', 'answer_counter', 'withdraw_offer', 'message'],
  },
  sender: {
    open: ['view_offers', 'edit', 'cancel_listing', 'share'],
    negotiating: ['view_offers', 'edit', 'cancel_listing', 'share'],
    assigned: ['message', 'call', 'view_delivery_code', 'cancel_delivery'],
    in_transit: ['track', 'message', 'call', 'view_delivery_code', 'open_dispute'],
    delivered_pending: ['confirm_delivery', 'open_dispute'],
    delivered: ['rate', 'message'],
  },
  assigned_carrier: {
    assigned: ['start_delivery', 'message', 'call', 'withdraw_assignment'],
    in_transit: ['enter_delivery_code', 'declare_delivery', 'message', 'open_dispute'],
    delivered: ['rate', 'message'],
  },
};

export interface ParcelActionContext {
  /** Le transporteur a une offre en countered : la réponse à la contre-offre est proposée. */
  hasCounterOffer?: boolean;
  /** L'utilisateur a déjà noté ce colis. */
  hasReviewed?: boolean;
}

export function parcelActionsFor(
  viewer: ParcelViewer,
  status: ParcelStatus,
  ctx: ParcelActionContext = {},
): ParcelAction[] {
  const actions = ACTIONS[viewer]?.[status] ?? [];
  return actions.filter((a) => {
    if (a === 'answer_counter') return Boolean(ctx.hasCounterOffer);
    if (a === 'rate') return !ctx.hasReviewed;
    return true;
  });
}
