// Assemblage des services métier à partir des dépendances (une seule fois par processus).

import type { Deps } from './deps';
import { createAuthService } from './modules/auth/service';
import { createMeService } from './modules/me/service';
import { registerSubscribers } from './events/subscribers';
import { createCarrierService } from './modules/carrier/service';
import { createConversationService } from './modules/conversations/service';
import { createDeliveryService } from './modules/delivery/service';
import { createNotificationService } from './modules/notifications/service';
import { createOfferService } from './modules/offers/service';
import { createParcelService } from './modules/parcels/service';
import { createProService } from './modules/pro/service';
import { createAlertService } from './modules/alerts/service';
import { createContentService } from './modules/content/service';
import { createTripService } from './modules/trips/service';
import { createTrackingService } from './modules/tracking/service';
import { createDisputeService } from './modules/trust/disputes';
import { createReportService } from './modules/trust/reports';
import { createReviewService } from './modules/trust/reviews';
import { createWalletService } from './modules/wallet/service';

export function createServices(deps: Deps) {
  const auth = createAuthService(deps);
  const me = createMeService(deps, auth.otp, auth.sessions);
  const parcels = createParcelService(deps);
  const carrier = createCarrierService(deps);
  const offers = createOfferService(deps);
  const notifications = createNotificationService(deps);
  const conversations = createConversationService(deps);
  const delivery = createDeliveryService(deps);
  const tracking = createTrackingService(deps);
  const reviews = createReviewService(deps);
  const reports = createReportService(deps);
  const disputes = createDisputeService(deps);
  const pro = createProService(deps);
  const trips = createTripService(deps, parcels);
  const alerts = createAlertService(deps, parcels);
  const content = createContentService(deps);
  const wallet = createWalletService(deps);
  registerSubscribers(deps, { notifications, conversations, tracking, reports, trips, alerts, wallet });
  return {
    auth,
    me,
    parcels,
    carrier,
    offers,
    notifications,
    conversations,
    delivery,
    tracking,
    reviews,
    reports,
    disputes,
    pro,
    trips,
    alerts,
    content,
    wallet,
  };
}

export type Services = ReturnType<typeof createServices>;
