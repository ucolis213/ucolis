// Fabriques de données de test : utilisateurs vérifiés, colis, transporteurs vérifiés.

import bcrypt from 'bcryptjs';
import { deriveKey, encrypt } from '../src/lib/crypto';
import { newTotpSecret, totpAt } from '../src/lib/totp';
import { StaffModel } from '../src/modules/admin/model';
import { UserModel } from '../src/modules/users/model';
import { bearer, makeTestApp, registration } from './helpers';

export type TestApp = ReturnType<typeof makeTestApp>;

export interface TestUser {
  id: string;
  token: string;
  email: string;
  deviceId: string;
  auth: Record<string, string>;
}

/** Inscrit un utilisateur, vérifie son email et applique d'éventuels champs (set). */
export async function verifiedUser(
  ctx: TestApp,
  patch: Record<string, unknown> = {},
  set: Record<string, unknown> = {},
): Promise<TestUser> {
  const body = registration(patch);
  const res = await ctx.http().post('/api/v1/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register ${res.status} ${JSON.stringify(res.body)}`);
  await UserModel.updateOne({ _id: res.body.user.id }, { emailVerifiedAt: new Date(), ...set });
  return {
    id: res.body.user.id,
    token: res.body.accessToken,
    email: body.email,
    deviceId: body.deviceId,
    auth: bearer(res.body.accessToken),
  };
}

export const VEHICLE = {
  type: 'van',
  brand: 'Renault',
  model: 'Master',
  plate: '12345-116-19',
  capacityKg: 1200,
  volumeM3: 10,
  isDefault: true,
};

/** Transporteur à l'identité vérifiée, avec un fourgon. */
export async function verifiedCarrier(ctx: TestApp, patch: Record<string, unknown> = {}) {
  const user = await verifiedUser(ctx, { firstName: 'Karim', intent: 'carrier', ...patch }, {
    'carrierVerification.status': 'approved',
    vehicles: [VEHICLE],
  });
  const doc = await UserModel.findById(user.id).lean();
  return { ...user, vehicleId: doc!.vehicles[0]!._id.toString() };
}

const ALGER = { lat: 36.7712, lng: 3.0612 };
const ORAN = { lat: 35.6987, lng: -0.6349 };

/** Colis Alger → Oran valide, photo dans le dossier de l'utilisateur. */
export function parcelInput(userId: string, patch: Record<string, unknown> = {}) {
  return {
    pickup: { address: 'Rue Didouche Mourad', wilayaCode: '16', commune: '16001', location: ALGER },
    dropoff: { address: 'Boulevard de la Soummam', wilayaCode: '31', commune: '31001', location: ORAN },
    title: 'Cadeaux pour la famille',
    description: 'Vêtements bien emballés',
    category: 'clothing',
    weightKg: 5,
    dimensionsCm: { length: 40, width: 30, height: 30 },
    prohibitedItemsDeclared: true,
    vehicleTypes: ['car', 'van'],
    desiredDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    paymentArrangement: 'cash_on_delivery',
    requestedPrice: 3500,
    photos: [
      {
        url: 'https://res.cloudinary.com/demo/image/upload/p.jpg',
        publicId: `ucolis/parcel_photo/${userId}/p1`,
        kind: 'image',
      },
    ],
    ...patch,
  };
}

export async function createParcel(ctx: TestApp, user: { id: string; auth: Record<string, string> }, patch = {}) {
  const res = await ctx.http().post('/api/v1/parcels').set(user.auth).send(parcelInput(user.id, patch));
  if (res.status !== 201) throw new Error(`parcel ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; reference: string; status: string; suggestedPrice: number; requestedPrice: number };
}

/** Nouvelle session (après un saut d'horloge qui a fait expirer le jeton d'accès). */
export async function relogin<T extends TestUser>(ctx: TestApp, user: T): Promise<T> {
  const res = await ctx
    .http()
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'secret123', deviceId: user.deviceId, platform: 'android' });
  if (res.status !== 200) throw new Error(`login ${res.status} ${JSON.stringify(res.body)}`);
  user.token = res.body.accessToken;
  user.auth = bearer(res.body.accessToken);
  return user;
}

export const STAFF_PASSWORD = 'SuperSecret123';

/** Compte staff actif, connecté (mot de passe + TOTP). */
export async function createStaff(
  ctx: TestApp,
  role: 'super_admin' | 'moderator',
  permissions: string[] = [],
  email = `${role}-${Math.random().toString(36).slice(2, 7)}@ucolis.dz`,
) {
  const secret = newTotpSecret();
  const key = deriveKey(ctx.deps.config.deliveryCodeKey, 'staff-totp');
  const staff = await StaffModel.create({
    email,
    firstName: role === 'super_admin' ? 'Super' : 'Modo',
    lastName: 'Staff',
    role,
    permissions,
    status: 'active',
    passwordHash: await bcrypt.hash(STAFF_PASSWORD, 4),
    totpSecret: encrypt(key, secret),
  });
  const login = await ctx
    .http()
    .post('/api/v1/admin/auth/login')
    .send({ email, password: STAFF_PASSWORD, totp: totpAt(secret, ctx.clock.now().getTime()) });
  return { id: staff.id as string, email, secret, auth: bearer(login.body.accessToken), refreshToken: login.body.refreshToken as string };
}
