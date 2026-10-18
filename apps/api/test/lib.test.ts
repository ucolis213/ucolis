import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';
import { hasMongoOperator } from '../src/lib/sanitize';

const base = {
  MONGODB_URI: 'mongodb://localhost:27017/ucolis',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  STAFF_JWT_SECRET: 'c'.repeat(32),
  DELIVERY_CODE_KEY: '0'.repeat(64),
  ADMIN_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173, http://localhost:8081',
};

describe('loadEnv', () => {
  it('accepte une configuration de développement minimale', () => {
    const env = loadEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:8081']);
  });

  it('liste les variables manquantes', () => {
    expect(() => loadEnv({ ...base, MONGODB_URI: undefined })).toThrow(/MONGODB_URI/);
    expect(() => loadEnv({ ...base, DELIVERY_CODE_KEY: 'court' })).toThrow(/DELIVERY_CODE_KEY/);
  });

  it('exige des secrets de jetons distincts', () => {
    expect(() => loadEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });

  it('exige les clés des services externes en production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/CLOUDINARY_CLOUD_NAME/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: '' })).toThrow(
      /CORS_ORIGINS/,
    );
  });
});

describe('hasMongoOperator', () => {
  it('détecte les opérateurs, y compris en profondeur', () => {
    expect(hasMongoOperator({ email: { $ne: null } })).toBe(true);
    expect(hasMongoOperator({ a: [{ 'b.c': 1 }] })).toBe(true);
    expect(hasMongoOperator({ email: 'a@b.dz', tags: ['x'] })).toBe(false);
    expect(hasMongoOperator('texte')).toBe(false);
    expect(hasMongoOperator(null)).toBe(false);
  });
});
