import { route, readJson, HttpError } from '../../../lib/api.ts';
import { checkLimit, normUsername, recordAttempt } from '../../../lib/auth.ts';
import { createToken, verifyPassword } from '../../../lib/crypto.ts';
import { db } from '../../../lib/db.ts';

// POST { username, password } -> { token, name }
export const POST = route(async (req) => {
  const b = await readJson(req);
  const username = normUsername(b.username);
  await checkLimit(username);

  const [user] = await db()`select id, name, password_hash from users where username = ${username}`;
  const ok = !!user && typeof b.password === 'string' && verifyPassword(b.password, user.password_hash);
  await recordAttempt(username, ok);

  if (!ok) throw new HttpError(401, 'wrong username or password');
  return Response.json({ token: createToken(user.id), name: user.name });
}, { isPublic: true });
