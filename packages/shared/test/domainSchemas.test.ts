import { describe, expect, it } from 'vitest';
import {
  WILAYAS,
  acceptInviteSchema,
  carrierVerificationSchema,
  changePasswordSchema,
  createDisputeSchema,
  createReviewSchema,
  deliveryCodeSchema,
  disputeDecisionSchema,
  forceStatusSchema,
  isOwnedUpload,
  isParcelCompatibleWithTrip,
  preferencesSchema,
  proApplicationSchema,
  sendMessageSchema,
  suspendUserSchema,
  trackingPositionSchema,
  tripInputSchema,
  tripRoute,
  uploadFolder,
  verificationDecisionSchema,
  vehicleInputSchema,
} from '../src';

const ID = 'a'.repeat(24);
const file = (kind: 'image' | 'pdf' = 'image') => ({ url: 'https://res.cloudinary.com/x/y.jpg', publicId: 'ucolis/pro_doc/u/1', kind });
const firstPlace = (code: string) => {
  const w = WILAYAS.find((x) => x.code === code)!;
  return { wilayaCode: code, commune: w.communes[0]!.code, location: w.center };
};
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);
const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}:${i.message}`);

describe('compatibilité colis / trajet (F9)', () => {
  const trip = {
    from: { wilayaCode: '19' },
    to: { wilayaCode: '16' },
    stops: ['34', '10'],
    capacityKg: 100,
    capacityM3: 2,
    departureAt: inDays(3),
    vehicle: { type: 'van' as const },
  };
  const parcel = {
    pickup: { wilayaCode: '19' },
    dropoff: { wilayaCode: '16' },
    weightKg: 20,
    volumeM3: 0.2,
    desiredDate: inDays(4),
    vehicleTypes: ['van', 'car'] as const,
  };

  it('accepte un colis sur l’itinéraire, y compris entre deux étapes', () => {
    expect(tripRoute(trip)).toEqual(['19', '34', '10', '16']);
    expect(isParcelCompatibleWithTrip(parcel, trip)).toBe(true);
    expect(isParcelCompatibleWithTrip({ ...parcel, pickup: { wilayaCode: '34' }, dropoff: { wilayaCode: '10' } }, trip)).toBe(true);
  });

  it('refuse le sens inverse, une wilaya hors trajet, la surcharge, le mauvais véhicule ou une date éloignée', () => {
    expect(isParcelCompatibleWithTrip({ ...parcel, pickup: { wilayaCode: '16' }, dropoff: { wilayaCode: '19' } }, trip)).toBe(false);
    expect(isParcelCompatibleWithTrip({ ...parcel, dropoff: { wilayaCode: '31' } }, trip)).toBe(false);
    expect(isParcelCompatibleWithTrip({ ...parcel, weightKg: 101 }, trip)).toBe(false);
    expect(isParcelCompatibleWithTrip({ ...parcel, volumeM3: 3 }, trip)).toBe(false);
    expect(isParcelCompatibleWithTrip({ ...parcel, vehicleTypes: ['moto'] }, trip)).toBe(false);
    expect(isParcelCompatibleWithTrip({ ...parcel, desiredDate: inDays(6) }, trip)).toBe(false);
  });

  it('accepte une publication rapide sans poids, volume ni date', () => {
    expect(isParcelCompatibleWithTrip({ ...parcel, weightKg: null, volumeM3: null, desiredDate: null }, trip)).toBe(true);
  });
});

describe('trajet', () => {
  const base = { from: firstPlace('19'), to: firstPlace('16'), departureAt: inDays(2), vehicleId: ID, capacityKg: 50, capacityM3: 1 };

  it('valide un trajet simple et applique les étapes par défaut', () => {
    const r = tripInputSchema.safeParse(base);
    expect(r.success && r.data.stops).toEqual([]);
  });

  it('limite la récurrence à 8 semaines et refuse un départ passé', () => {
    expect(issues(tripInputSchema.safeParse({ ...base, recurrence: { weekdays: [1], until: inDays(70) } }))).toContain('recurrence.until:validation.recurrence');
    expect(tripInputSchema.safeParse({ ...base, recurrence: { weekdays: [1, 4], until: inDays(30) } }).success).toBe(true);
    expect(issues(tripInputSchema.safeParse({ ...base, departureAt: inDays(-1) }))).toContain('departureAt:validation.departure');
  });

  it('exige un forfait rond, pas un tarif au kilo', () => {
    expect(issues(tripInputSchema.safeParse({ ...base, priceHint: { mode: 'flat', amount: 1505 } }))).toContain('priceHint.amount:validation.roundPrice');
    expect(tripInputSchema.safeParse({ ...base, priceHint: { mode: 'flat', amount: 1500 } }).success).toBe(true);
    expect(tripInputSchema.safeParse({ ...base, priceHint: { mode: 'per_kg', amount: 15 } }).success).toBe(true);
  });
});

describe('transporteur et professionnel', () => {
  it('vérifie véhicule et pièces, avec des dates d’expiration futures', () => {
    expect(vehicleInputSchema.safeParse({ type: 'car', brand: 'Renault', model: 'Kangoo', plate: '01234-119-16', capacityKg: 500, volumeM3: 3 }).success).toBe(true);
    expect(issues(vehicleInputSchema.safeParse({ type: 'car', brand: 'R', model: 'K', plate: '12', capacityKg: 0, volumeM3: 1 }))).toEqual(
      expect.arrayContaining(['plate:validation.plate', 'capacityKg:validation.positive']),
    );
    const documents = { idFront: file(), idBack: file(), driverLicense: file('pdf'), vehicleRegistration: file(), insurance: file() };
    expect(carrierVerificationSchema.safeParse({ documents, licenseExpiresAt: inDays(300), insuranceExpiresAt: inDays(100) }).success).toBe(true);
    expect(issues(carrierVerificationSchema.safeParse({ documents, licenseExpiresAt: inDays(-1), insuranceExpiresAt: inDays(100) }))).toContain('licenseExpiresAt:validation.expiredDocument');
  });

  it('exige un NIF à 15 chiffres et une commune de la wilaya', () => {
    const app = { companyName: 'Sétif Express', legalForm: 'sarl', rcNumber: '19/00-123456B', rcDocument: file('pdf'), nif: '123456789012345', nifDocument: file(), address: 'Cité 1000 logements', place: { wilayaCode: '19', commune: firstPlace('19').commune } };
    expect(proApplicationSchema.safeParse(app).success).toBe(true);
    expect(issues(proApplicationSchema.safeParse({ ...app, nif: '1234' }))).toContain('nif:validation.nif');
    expect(issues(proApplicationSchema.safeParse({ ...app, place: { wilayaCode: '16', commune: firstPlace('19').commune } }))).toContain('place.commune:validation.commune');
  });
});

describe('confiance et livraison', () => {
  it('borne les notes et exige une description de litige', () => {
    expect(createReviewSchema.safeParse({ rating: 5, criteria: { punctuality: 4 } }).success).toBe(true);
    expect(createReviewSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(issues(createDisputeSchema.safeParse({ reason: 'damaged', description: 'court' }))).toContain('description:validation.disputeDescription');
    expect(disputeDecisionSchema.safeParse({ outcome: 'cancelled', note: 'Photos du colis endommagé' }).success).toBe(true);
  });

  it('valide code de livraison, position GPS et message', () => {
    expect(deliveryCodeSchema.safeParse({ code: '0421' }).success).toBe(true);
    expect(deliveryCodeSchema.safeParse({ code: '421' }).success).toBe(false);
    expect(trackingPositionSchema.safeParse({ parcelId: ID, lat: 36.19, lng: 5.41, at: new Date() }).success).toBe(true);
    expect(trackingPositionSchema.safeParse({ parcelId: ID, lat: 91, lng: 5, at: new Date() }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ type: 'text', clientId: 'client-123', text: 'Salam' }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ type: 'text', clientId: 'client-123', text: '   ' }).success).toBe(false);
  });
});

describe('compte et back-office', () => {
  it('vérifie la confirmation du mot de passe et les préférences', () => {
    expect(issues(changePasswordSchema.safeParse({ currentPassword: 'x', password: 'Secret123', passwordConfirm: 'Secret124' }))).toContain('passwordConfirm:validation.passwordMismatch');
    expect(preferencesSchema.safeParse({ language: 'ar' }).success).toBe(true);
    expect(preferencesSchema.safeParse({ language: 'en' }).success).toBe(false);
  });

  it('exige un motif pour toute action du staff, sauf une validation', () => {
    expect(issues(suspendUserSchema.safeParse({ reason: 'ok' }))).toContain('reason:validation.reasonRequired');
    expect(forceStatusSchema.safeParse({ status: 'delivered', reason: 'Accord des deux parties' }).success).toBe(true);
    expect(verificationDecisionSchema.safeParse({ decision: 'approve' }).success).toBe(true);
    expect(issues(verificationDecisionSchema.safeParse({ decision: 'reject' }))).toContain('reason:validation.reasonRequired');
    expect(issues(acceptInviteSchema.safeParse({ token: 't'.repeat(32), password: 'Secret123', totp: '12' }))).toContain('totp:validation.totp');
  });

  it('reconnaît les fichiers déposés par leur propriétaire', () => {
    expect(uploadFolder('identity_doc', 'u1')).toBe('ucolis/identity_doc/u1');
    expect(isOwnedUpload('ucolis/identity_doc/u1/abc', 'identity_doc', 'u1')).toBe(true);
    expect(isOwnedUpload('ucolis/identity_doc/u10/abc', 'identity_doc', 'u1')).toBe(false);
  });
});
