import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

function secret(name: string): Buffer {
  const v = Buffer.from(process.env[name] ?? '', 'base64');
  if (v.length !== 32) throw new Error(`${name} must be 32 random bytes, base64 encoded (run: npm run setup)`);
  return v;
}

// --- Field encryption (AES-256-GCM): "iv.tag.ciphertext", all base64 ---

export function encrypt(text: string | null): string | null {
  if (!text) return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secret('ENCRYPTION_KEY'), iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(blob: string | null): string | null {
  if (!blob) return null;
  const [iv, tag, data] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', secret('ENCRYPTION_KEY'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

// Deterministic lookup key for an encrypted value (same name -> same hash).
export function lookupHash(text: string): string {
  return createHmac('sha256', secret('ENCRYPTION_KEY')).update('lookup:' + text.trim().toLowerCase()).digest('base64url');
}

// --- Password (scrypt): "scrypt:salt:hash" ---

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return ['scrypt', salt.toString('base64'), scryptSync(password, salt, 64).toString('base64')].join(':');
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split(':');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

// --- Session token: "expiry.hmac". Rotate SESSION_SECRET to log out every device. ---

const TOKEN_DAYS = 30;

const sign = (exp: string) => createHmac('sha256', secret('SESSION_SECRET')).update(exp).digest('base64url');

export function createToken(now = Date.now()): string {
  const exp = String(now + TOKEN_DAYS * 86_400_000);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token: string, now = Date.now()): boolean {
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !(Number(exp) > now)) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}
