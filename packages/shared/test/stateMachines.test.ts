import { describe, expect, it } from 'vitest';
import { OFFER_STATUSES, PARCEL_STATUSES } from '../src/enums';
import {
  OFFER_TRANSITIONS,
  PARCEL_TRANSITIONS,
  canForceParcelStatus,
  canTransitionOffer,
  canTransitionParcel,
  nextParcelStatuses,
  parcelActionsFor,
  type OfferActor,
  type ParcelActor,
} from '../src/stateMachines';

const PARCEL_ACTORS: ParcelActor[] = ['sender', 'carrier', 'system', 'job', 'staff'];
const OFFER_ACTORS: OfferActor[] = ['sender', 'carrier', 'system'];

// Table du PRD, écrite indépendamment de l'implémentation : « from>to:acteur ».
const EXPECTED_PARCEL = new Set([
  'open>negotiating:system',
  'negotiating>assigned:sender',
  'negotiating>assigned:carrier',
  'assigned>negotiating:carrier',
  'assigned>open:carrier',
  'open>cancelled:sender',
  'negotiating>cancelled:sender',
  'assigned>cancelled:sender',
  'open>expired:job',
  'negotiating>expired:job',
  'assigned>in_transit:carrier',
  'in_transit>delivered:carrier',
  'in_transit>delivered_pending:carrier',
  'delivered_pending>delivered:sender',
  'delivered_pending>delivered:job',
  'in_transit>disputed:sender',
  'in_transit>disputed:carrier',
  'delivered_pending>disputed:sender',
  'delivered_pending>disputed:carrier',
  'disputed>delivered:staff',
  'disputed>cancelled:staff',
]);

const EXPECTED_OFFER = new Set([
  'pending>countered:sender',
  'countered>accepted:carrier',
  'countered>pending:carrier',
  'pending>accepted:sender',
  'pending>rejected:sender',
  'countered>rejected:sender',
  'pending>rejected:system',
  'countered>rejected:system',
  'pending>withdrawn:carrier',
  'countered>withdrawn:carrier',
  'accepted>withdrawn:carrier',
  'rejected>pending:system',
  'pending>cancelled:system',
  'countered>cancelled:system',
]);

describe('machine à états du colis', () => {
  it('autorise exactement les transitions du PRD, pour chaque statut et chaque acteur', () => {
    for (const from of PARCEL_STATUSES)
      for (const to of PARCEL_STATUSES)
        for (const actor of PARCEL_ACTORS)
          expect(canTransitionParcel(from, to, actor), `${from}>${to}:${actor}`).toBe(
            EXPECTED_PARCEL.has(`${from}>${to}:${actor}`),
          );
  });

  it("n'utilise que des statuts connus", () => {
    for (const t of PARCEL_TRANSITIONS) {
      expect(PARCEL_STATUSES).toContain(t.to);
      t.from.forEach((f) => expect(PARCEL_STATUSES).toContain(f));
    }
  });

  it("refuse l'annulation par l'expéditeur une fois la livraison démarrée", () => {
    expect(canTransitionParcel('in_transit', 'cancelled', 'sender')).toBe(false);
    expect(canTransitionParcel('delivered_pending', 'cancelled', 'sender')).toBe(false);
  });

  it("ne permet jamais la validation automatique d'un colis en litige", () => {
    expect(canTransitionParcel('disputed', 'delivered', 'job')).toBe(false);
  });

  it("liste les prochains statuts d'un acteur", () => {
    expect(nextParcelStatuses('assigned', 'carrier').sort()).toEqual(
      ['in_transit', 'negotiating', 'open'].sort(),
    );
    expect(nextParcelStatuses('delivered', 'sender')).toEqual([]);
  });

  it('autorise le forçage staff sauf pendant un litige ouvert', () => {
    expect(canForceParcelStatus('in_transit', 'cancelled', false)).toBe(true);
    expect(canForceParcelStatus('disputed', 'cancelled', true)).toBe(false);
    expect(canForceParcelStatus('open', 'open', false)).toBe(false);
  });
});

describe("machine à états de l'offre", () => {
  it('autorise exactement les transitions du PRD', () => {
    for (const from of OFFER_STATUSES)
      for (const to of OFFER_STATUSES)
        for (const actor of OFFER_ACTORS)
          expect(canTransitionOffer(from, to, actor), `${from}>${to}:${actor}`).toBe(
            EXPECTED_OFFER.has(`${from}>${to}:${actor}`),
          );
    expect(OFFER_TRANSITIONS.length).toBe(9);
  });
});

describe("barre d'actions du détail de colis", () => {
  it('propose la connexion au visiteur', () => {
    expect(parcelActionsFor('guest', 'open')).toEqual(['login_to_offer']);
    expect(parcelActionsFor('guest', 'assigned')).toEqual([]);
  });

  it("n'affiche « Répondre à la contre-offre » que s'il y en a une", () => {
    expect(parcelActionsFor('carrier_with_offer', 'negotiating')).not.toContain('answer_counter');
    expect(
      parcelActionsFor('carrier_with_offer', 'negotiating', { hasCounterOffer: true }),
    ).toContain('answer_counter');
  });

  it("masque « Noter » une fois l'avis laissé", () => {
    expect(parcelActionsFor('sender', 'delivered')).toEqual(['rate', 'message']);
    expect(parcelActionsFor('sender', 'delivered', { hasReviewed: true })).toEqual(['message']);
  });

  it('donne au transporteur retenu les actions de livraison', () => {
    expect(parcelActionsFor('assigned_carrier', 'in_transit')).toContain('enter_delivery_code');
    expect(parcelActionsFor('other', 'open')).toEqual([]);
  });
});
