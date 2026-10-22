import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_TYPES,
  deepLinkFor,
  notificationKeys,
  shouldPush,
  type NotificationType,
} from '../src/notifications';
import { translate } from '../src/i18n';

const types = Object.keys(NOTIFICATION_TYPES) as NotificationType[];

describe('catalogue des notifications', () => {
  it('a un titre et un corps traduits en FR et en AR pour chaque type', () => {
    for (const type of types) {
      const { titleKey, bodyKey } = notificationKeys(type);
      for (const locale of ['fr', 'ar'] as const) {
        expect(translate(locale, titleKey)).not.toBe(titleKey);
        expect(translate(locale, bodyKey)).not.toBe(bodyKey);
      }
    }
  });

  it('construit les liens profonds ucolis://', () => {
    expect(deepLinkFor('offer_received', { parcelId: 'p1' })).toBe('ucolis://parcel/p1/offers');
    expect(deepLinkFor('delivery_started', { parcelId: 'p1' })).toBe('ucolis://tracking/p1');
    expect(deepLinkFor('new_message', { conversationId: 'c1' })).toBe('ucolis://conversation/c1');
    expect(deepLinkFor('counter_offer_received', { offerId: 'o1' })).toBe('ucolis://offer/o1');
    expect(deepLinkFor('offer_accepted', {})).toBeNull();
    expect(deepLinkFor('report_resolved', {})).toBeNull();
    expect(deepLinkFor('wallet_topup_approved', {})).toBe('ucolis://me/wallet');
    const full = { parcelId: 'p', offerId: 'o', conversationId: 'c', disputeId: 'd' };
    for (const type of types) {
      const link = deepLinkFor(type, full);
      if (link) expect(link.startsWith('ucolis://')).toBe(true);
    }
    for (const type of types) {
      if (NOTIFICATION_TYPES[type].link !== 'none') {
        const empty = deepLinkFor(type, {});
        expect(empty === null || empty.startsWith('ucolis://')).toBe(true);
      }
    }
  });

  it('respecte les préférences sauf pour la catégorie Compte', () => {
    expect(shouldPush('offer_received', { offers: false })).toBe(false);
    expect(shouldPush('offer_received', {})).toBe(true);
    expect(shouldPush('pro_approved', { account: false })).toBe(true);
    expect(shouldPush('account_suspended', {})).toBe(false);
  });
});
