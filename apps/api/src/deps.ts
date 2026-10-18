// Dépendances injectées dans l'application : réelles au démarrage, simulées dans les tests.

import type { Logger } from 'pino';
import type { EventBus } from './events/bus';
import type { Cache } from './lib/cache';
import type { FileStore } from './lib/files';
import type { Geocoder } from './lib/geocoder';
import type { Mailer } from './lib/mailer';
import type { PushSender } from './lib/push';
import type { LimiterFactory } from './lib/rateLimit';
import type { Realtime } from './lib/realtime';
import type { HealthChecks } from './modules/health/routes';
import type { SettingsReader } from './modules/settings/service';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  accessSecret: string;
  /** Poivre des empreintes de jetons de rafraîchissement et de codes OTP. */
  refreshSecret: string;
  staffSecret: string;
  deliveryCodeKey: Buffer;
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string };
  googleMapsApiKey: string;
  expoAccessToken: string;
  adminUrl: string;
  corsOrigins: string[];
  /** 12 en production (PRD) ; abaissé dans les tests pour la vitesse. */
  bcryptCost: number;
}

export interface Deps {
  config: AppConfig;
  logger: Logger;
  mailer: Mailer;
  cache: Cache;
  geocoder: Geocoder;
  limiters: LimiterFactory;
  bus: EventBus;
  realtime: Realtime;
  push: PushSender;
  files: FileStore;
  settings: SettingsReader;
  health: HealthChecks;
  now: () => Date;
}
