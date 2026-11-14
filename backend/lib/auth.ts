import { HttpError } from './api.ts';
import { db } from './db.ts';

const MAX_FAILS = 5; // per key, per 15 minutes

// Throws 429 after too many recent failures for this key (a username, or 'signup').
export async function checkLimit(key: string) {
  const [{ fails }] = await db()`
    select count(*)::int as fails from login_attempts
    where username = ${key} and not ok and at > now() - interval '15 minutes'`;
  if (fails >= MAX_FAILS) throw new HttpError(429, 'too many attempts, try again in 15 minutes');
}

export async function recordAttempt(key: string, ok: boolean) {
  await db()`insert into login_attempts (username, ok) values (${key}, ${ok})`;
  await db()`delete from login_attempts where at < now() - interval '1 day'`;
}

export const normUsername = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
