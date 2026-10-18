// Crée le super-administrateur unique au premier déploiement.
// Usage : SUPERADMIN_EMAIL=… SUPERADMIN_PASSWORD=… pnpm --filter api seed:superadmin
// Affiche le secret TOTP à scanner dans une application d'authentification.

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { loadEnv } from '../config/env';
import { deriveKey, encrypt } from '../lib/crypto';
import { newTotpSecret, otpauthUrl } from '../lib/totp';
import { StaffModel } from '../modules/admin/model';

async function main() {
  const env = loadEnv();
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD ?? '';
  const firstName = process.env.SUPERADMIN_FIRST_NAME ?? 'Super';
  const lastName = process.env.SUPERADMIN_LAST_NAME ?? 'Admin';
  if (!email || password.length < 12) {
    throw new Error('SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD (12 caractères minimum) sont obligatoires');
  }
  await mongoose.connect(env.MONGODB_URI);
  await StaffModel.init();
  if (await StaffModel.exists({ role: 'super_admin' })) {
    console.log('Un super-administrateur existe déjà : rien à faire.');
    return;
  }
  const secret = newTotpSecret();
  const key = deriveKey(Buffer.from(env.DELIVERY_CODE_KEY, 'hex'), 'staff-totp');
  await StaffModel.create({
    email,
    firstName,
    lastName,
    role: 'super_admin',
    status: 'active',
    passwordHash: await bcrypt.hash(password, 12),
    totpSecret: encrypt(key, secret),
  });
  console.log(`Super-administrateur créé : ${email}`);
  console.log(`Secret TOTP : ${secret}`);
  console.log(`Lien à scanner : ${otpauthUrl(secret, email)}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
