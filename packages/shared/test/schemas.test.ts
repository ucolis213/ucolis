import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { counterOfferSchema, createOfferSchema } from '../src/schemas/offer';
import {
  createParcelSchema,
  isWithinPublishWindow,
  parcelDetailsSchema,
  pricingSuggestSchema,
  suggestedVehicleTypes,
  updateParcelSchema,
} from '../src/schemas/parcel';
import {
  loginSchema,
  registerAccountSchema,
  registerSchema,
  resetPasswordSchema,
} from '../src/schemas/auth';
import { emailSchema, paginationSchema, placeSchema } from '../src/schemas/common';

const account = {
  firstName: 'Amina',
  lastName: 'Benali',
  email: ' Amina@Gmail.com ',
  phone: '0551234567',
  password: 'secret123',
  passwordConfirm: 'secret123',
};

const messages = (r: z.ZodSafeParseResult<unknown>) =>
  r.success ? [] : r.error.issues.map((i) => i.message);

describe('schémas auth', () => {
  it('normalise email et téléphone', () => {
    const r = registerAccountSchema.parse(account);
    expect(r.email).toBe('amina@gmail.com');
    expect(r.phone).toBe('+213551234567');
  });

  it('refuse un mot de passe faible, non confirmé, ou un téléphone invalide', () => {
    const weak = { ...account, password: 'abcdefgh', passwordConfirm: 'abcdefgh' };
    expect(messages(registerAccountSchema.safeParse(weak))).toContain('validation.passwordRules');
    expect(
      messages(registerAccountSchema.safeParse({ ...account, passwordConfirm: 'other123' })),
    ).toContain('validation.passwordMismatch');
    expect(messages(registerAccountSchema.safeParse({ ...account, phone: '0451234567' }))).toContain(
      'validation.phone',
    );
  });

  it("valide l'inscription complète avec wilaya et commune cohérentes", () => {
    const base = { ...account, intent: 'both', acceptTerms: true, termsVersion: '1' };
    const alger = { wilayaCode: '16', commune: '16001' };
    expect(registerSchema.safeParse({ ...base, place: alger }).success).toBe(true);
    expect(
      messages(registerSchema.safeParse({ ...base, place: { wilayaCode: '31', commune: '16001' } })),
    ).toContain('validation.commune');
    expect(registerSchema.safeParse({ ...base, acceptTerms: false, place: alger }).success).toBe(
      false,
    );
  });

  it('login et réinitialisation', () => {
    const login = { email: 'a@b.dz', password: 'x', deviceId: 'device-123', platform: 'android' };
    expect(loginSchema.safeParse(login).success).toBe(true);
    const reset = {
      email: 'a@b.dz',
      code: '12345',
      password: 'secret123',
      passwordConfirm: 'secret123',
    };
    expect(messages(resetPasswordSchema.safeParse(reset))).toContain('validation.otp');
  });

  it('email, lieu et pagination', () => {
    expect(emailSchema.safeParse('pas-un-email').success).toBe(false);
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationSchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(placeSchema.safeParse({ wilayaCode: '99', commune: 'x' }).success).toBe(false);
  });
});

describe('schémas colis', () => {
  const now = new Date();
  const point = (wilayaCode: string, commune: string, lat: number, lng: number) => ({
    address: 'Rue Didouche Mourad',
    wilayaCode,
    commune,
    location: { lat, lng },
  });
  const parcel = {
    pickup: point('16', '16001', 36.77, 3.06),
    dropoff: point('31', '31001', 35.7, -0.63),
    title: 'Cadeaux pour la famille',
    category: 'clothing',
    weightKg: 5,
    dimensionsCm: { length: 40, width: 30, height: 30 },
    prohibitedItemsDeclared: true,
    vehicleTypes: ['car'],
    desiredDate: now.toISOString(),
    paymentArrangement: 'cash_on_delivery',
    requestedPrice: 3250,
    photos: [{ url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'a', kind: 'image' }],
    suggestedPrice: 1,
  };

  it('accepte un colis complet et ignore le prix suggéré du client', () => {
    const r = createParcelSchema.parse(parcel);
    expect(r).not.toHaveProperty('suggestedPrice');
    expect(r.mode).toBe('full');
    if (r.mode !== 'full') throw new Error('mode');
    expect(r.timeSlot).toBe('any');
    expect(r.fragile).toBe(false);
  });

  it('accepte une publication rapide : trajet, titre, prix, photos facultatives', () => {
    const quick = {
      mode: 'quick',
      pickup: parcel.pickup,
      dropoff: parcel.dropoff,
      title: parcel.title,
      requestedPrice: 1500,
      prohibitedItemsDeclared: true,
    };
    const r = createParcelSchema.parse(quick);
    expect(r).toMatchObject({ mode: 'quick', description: '', photos: [] });
    expect(r).not.toHaveProperty('weightKg');
    const fails = (patch: object) => messages(createParcelSchema.safeParse({ ...quick, ...patch }));
    expect(fails({ title: 'abc' })).toContain('validation.titleLength');
    expect(fails({ requestedPrice: 50 })).toContain('validation.minPrice');
    expect(fails({ prohibitedItemsDeclared: false })).toContain('validation.prohibitedDeclaration');
    expect(fails({ photos: Array(6).fill(parcel.photos[0]) })).toContain('validation.photosCount');
  });

  it('autorise une modification qui retire toutes les photos', () => {
    expect(updateParcelSchema.safeParse({ photos: [] }).success).toBe(true);
    expect(updateParcelSchema.parse({ title: 'Cadeaux pour la famille' })).not.toHaveProperty('photos');
  });

  it('applique les règles du PRD', () => {
    const fails = (patch: object) => messages(createParcelSchema.safeParse({ ...parcel, ...patch }));
    expect(fails({ requestedPrice: 99 })).toContain('validation.minPrice');
    expect(createParcelSchema.safeParse({ ...parcel, photos: [] }).success).toBe(true);
    expect(fails({ photos: Array(6).fill(parcel.photos[0]) })).toContain('validation.photosCount');
    expect(fails({ vehicleTypes: [] })).toContain('validation.vehicleTypes');
    expect(fails({ dropoff: point('31', '16001', 35.7, -0.63) })).toContain('validation.commune');
    expect(
      messages(parcelDetailsSchema.safeParse({ ...parcel, prohibitedItemsDeclared: false })),
    ).toContain('validation.prohibitedDeclaration');
  });

  it("limite la date souhaitée à aujourd'hui + 60 jours", () => {
    const day = 86_400_000;
    expect(isWithinPublishWindow(new Date(now.getTime() + 60 * day), now)).toBe(true);
    expect(isWithinPublishWindow(new Date(now.getTime() + 61 * day), now)).toBe(false);
    expect(isWithinPublishWindow(new Date(now.getTime() - day), now)).toBe(false);
  });

  it('valide une demande de prix suggéré', () => {
    const input = {
      pickup: { lat: 36.77, lng: 3.06 },
      dropoff: { lat: 35.7, lng: -0.63 },
      weightKg: 5,
      dimensionsCm: { length: 40, width: 30, height: 30 },
    };
    expect(pricingSuggestSchema.safeParse(input).success).toBe(true);
    expect(pricingSuggestSchema.safeParse({ ...input, weightKg: 0 }).success).toBe(false);
  });

  it('valide une demande de prix suggéré', () => {
    const input = {
      pickup: { lat: 36.77, lng: 3.06 },
      dropoff: { lat: 35.7, lng: -0.63 },
      weightKg: 5,
      dimensionsCm: { length: 40, width: 30, height: 30 },
    };
    expect(pricingSuggestSchema.safeParse(input).success).toBe(true);
    expect(pricingSuggestSchema.safeParse({ ...input, weightKg: 0 }).success).toBe(false);
  });

  it('pré-coche les véhicules selon le gabarit', () => {
    expect(suggestedVehicleTypes(2, 0.01)).toContain('moto');
    expect(suggestedVehicleTypes(50, 0.2)).toContain('van');
    expect(suggestedVehicleTypes(800, 4)).toContain('truck');
    expect(suggestedVehicleTypes(20_000, 60)).toContain('semi_trailer');
  });
});

describe('schémas offre', () => {
  const base = { vehicleId: 'a'.repeat(24), proposedPickupDate: new Date().toISOString() };
  it('accepte une offre au prix demandé ou un prix proposé', () => {
    expect(createOfferSchema.safeParse({ ...base, atAskingPrice: true }).success).toBe(true);
    expect(createOfferSchema.safeParse({ ...base, price: 3000 }).success).toBe(true);
    expect(createOfferSchema.safeParse({ ...base, price: 50 }).success).toBe(false);
  });

  it('contre-offre à 100 DA minimum', () => {
    expect(counterOfferSchema.safeParse({ price: 100 }).success).toBe(true);
    expect(counterOfferSchema.safeParse({ price: 99 }).success).toBe(false);
  });
});
