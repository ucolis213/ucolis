import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Deps } from './deps';
import { errorHandler, notFound } from './lib/errors';
import { httpLogger } from './lib/logger';
import { openApiDocument } from './lib/openapi';
import { globalRateLimit } from './lib/rateLimit';
import { rejectMongoOperators } from './lib/sanitize';
import { adminRoutes } from './modules/admin/routes';
import { authRoutes } from './modules/auth/routes';
import { carrierRoutes } from './modules/carrier/routes';
import { configRoutes } from './modules/config/routes';
import { contentRoutes } from './modules/content/routes';
import { conversationRoutes } from './modules/conversations/routes';
import { healthRoutes } from './modules/health/routes';
import { deliveryRoutes } from './modules/delivery/routes';
import { geoRoutes } from './modules/geo/routes';
import { meRoutes } from './modules/me/routes';
import { notificationRoutes } from './modules/notifications/routes';
import { offerRoutes } from './modules/offers/routes';
import { parcelRoutes } from './modules/parcels/routes';
import { pricingRoutes } from './modules/pricing/routes';
import { proRoutes } from './modules/pro/routes';
import { tripRoutes } from './modules/trips/routes';
import { trustRoutes } from './modules/trust/routes';
import { uploadRoutes } from './modules/uploads/routes';
import { userRoutes } from './modules/users/routes';
import { createServices, type Services } from './services';

/** Construit l'application Express sans ouvrir de port : testable avec supertest. */
export function createApp(deps: Deps, services: Services = createServices(deps)): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(httpLogger(deps.logger));
  app.use(helmet());
  app.use(cors({ origin: deps.config.corsOrigins, credentials: false }));
  // Les fichiers vont directement sur Cloudinary : 1 Mo suffit.
  app.use(express.json({ limit: '1mb' }));
  app.use(rejectMongoOperators);

  const v1 = express.Router();
  v1.use(healthRoutes(deps.health));
  v1.use(globalRateLimit(deps.limiters, deps.config.accessSecret));
  v1.use(configRoutes(deps.settings));
  v1.use(pricingRoutes(deps.settings));
  v1.use(authRoutes(deps, services.auth));
  v1.use(meRoutes(deps, services.me));
  v1.use(uploadRoutes(deps));
  v1.use(trustRoutes(deps, services));
  v1.use(proRoutes(deps, services.pro));
  v1.use(tripRoutes(deps, services.trips, services.alerts));
  v1.use(contentRoutes(deps, services.content));
  v1.use(userRoutes());
  v1.use(geoRoutes(deps, deps.geocoder));
  v1.use(parcelRoutes(deps, services.parcels));
  v1.use(carrierRoutes(deps, services.carrier));
  v1.use(offerRoutes(deps, services.offers));
  v1.use(deliveryRoutes(deps, services.delivery, services.parcels, services.tracking));
  v1.use(conversationRoutes(deps, services.conversations));
  v1.use(notificationRoutes(deps, services.notifications));
  // L'API du staff passe avant la limite globale des utilisateurs, avec sa propre limite par IP.
  const admin = adminRoutes(deps, services).router;
  if (deps.config.nodeEnv !== 'production') {
    const doc = openApiDocument([
      { prefix: '/api/v1', router: v1 },
      { prefix: '/api/v1/admin', router: admin },
    ]);
    app.get('/api/v1/docs', (_req, res) => {
      res.json(doc);
    });
  }
  app.use('/api/v1/admin', admin);
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
