import { route, readJson, bad, HttpError } from '../../../lib/api.ts';
import { checkLimit, normUsername, recordAttempt } from '../../../lib/auth.ts';
import { createToken, hashPassword } from '../../../lib/crypto.ts';
import { db } from '../../../lib/db.ts';

const CATEGORIES = [
  'Food', 'Beverages', 'Groceries', 'Transport', 'Fuel', 'Travel', 'Bills', 'Rent', 'Shopping', 'Health',
  'Personal care', 'Entertainment', 'Subscriptions', 'Education', 'Gifts', 'Family', 'EMI', 'Investments', 'Other',
];

// POST { name, username, password, code } -> { token, name }
// Sign-up needs the invite code in SIGNUP_CODE, so only people you give it to can join.
export const POST = route(async (req) => {
  const b = await readJson(req);
  await checkLimit('signup');
  const code = process.env.SIGNUP_CODE;
  if (!code || b.code !== code) {
    await recordAttempt('signup', false);
    throw new HttpError(403, 'wrong invite code');
  }

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const username = normUsername(b.username);
  if (!name || name.length > 30) bad('name must be 1-30 chars');
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) bad('username: 3-20 letters, numbers, _ or .');
  if (typeof b.password !== 'string' || b.password.length < 8) bad('password must be at least 8 characters');

  const [user] = await db()`
    insert into users (username, name, password_hash) values (${username}, ${name}, ${hashPassword(b.password)})
    on conflict (username) do nothing returning id`;
  if (!user) throw new HttpError(409, 'that username is taken');

  await db()`insert into categories (user_id, name) select ${user.id}, unnest(${CATEGORIES}::text[])`;
  await db()`insert into accounts (user_id, name) values (${user.id}, 'Cash')`;
  return Response.json({ token: createToken(user.id), name }, { status: 201 });
}, { isPublic: true });
