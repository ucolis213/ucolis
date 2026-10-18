import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export const randomToken = (bytes = 48) => randomBytes(bytes).toString('base64url');

/** Code numérique à n chiffres, zéros en tête compris. */
export const randomDigits = (n: number) =>
  Array.from({ length: n }, () => randomInt(0, 10)).join('');

export const hmac = (secret: string | Buffer, value: string) =>
  createHmac('sha256', secret).update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Sous-clé dérivée (HKDF) d'une clé maîtresse, pour ne pas réutiliser la même clé à deux usages. */
export const deriveKey = (master: Buffer, label: string) =>
  Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), label, 32));

/** AES-256-GCM : renvoie « iv.tag.chiffré » en base64url. */
export function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(key: Buffer, payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('payload chiffré invalide');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
