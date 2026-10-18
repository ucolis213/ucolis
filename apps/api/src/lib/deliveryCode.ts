// Code de remise à 4 chiffres, stocké chiffré (AES-256-GCM avec DELIVERY_CODE_KEY).

import { decrypt, encrypt, randomDigits } from './crypto';

export const DELIVERY_CODE_MAX_ATTEMPTS = 5;

export function newDeliveryCode(key: Buffer) {
  const code = randomDigits(4);
  return { code, cipher: encrypt(key, code) };
}

export const readDeliveryCode = (key: Buffer, cipher: string) => decrypt(key, cipher);
