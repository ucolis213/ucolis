// Variables d'environnement validées au démarrage. Un oubli arrête le processus avec un message clair.

import { z } from 'zod';

const optionalInDev = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'BREVO_API_KEY',
  'EXPO_ACCESS_TOKEN',
  'GOOGLE_MAPS_API_KEY',
  'SENTRY_DSN',
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    MONGODB_URI: z.string().startsWith('mongodb'),
    REDIS_URL: z.string().startsWith('redis'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    STAFF_JWT_SECRET: z.string().min(32),
    DELIVERY_CODE_KEY: z.string().regex(/^[0-9a-f]{64}$/i, '32 octets en hexadécimal'),
    CLOUDINARY_CLOUD_NAME: z.string().default(''),
    CLOUDINARY_API_KEY: z.string().default(''),
    CLOUDINARY_API_SECRET: z.string().default(''),
    BREVO_API_KEY: z.string().default(''),
    EXPO_ACCESS_TOKEN: z.string().default(''),
    GOOGLE_MAPS_API_KEY: z.string().default(''),
    SENTRY_DSN: z.string().default(''),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ADMIN_URL: z.url(),
  })
  .superRefine((env, ctx) => {
    const secrets = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET, env.STAFF_JWT_SECRET];
    if (new Set(secrets).size !== secrets.length)
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'les trois secrets de jetons doivent être distincts',
      });
    if (env.NODE_ENV !== 'production') return;
    for (const key of optionalInDev)
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'obligatoire en production' });
    if (env.CORS_ORIGINS.length === 0)
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'obligatoire en production',
      });
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuration invalide :\n${lines.join('\n')}`);
  }
  return parsed.data;
}
