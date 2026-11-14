import { route, readJson, HttpError } from '../../../lib/api.ts';
import { createToken, verifyPassword } from '../../../lib/crypto.ts';
import { db } from '../../../lib/db.ts';

const MAX_FAILS = 5; // per 15 minutes

export const POST = route(async (req) => {
  const { password } = await readJson(req);
  const sql = db();

  const [{ fails }] = await sql`
    select count(*)::int as fails from login_attempts
    where not ok and at > now() - interval '15 minutes'`;
  if (fails >= MAX_FAILS) throw new HttpError(429, 'too many attempts, try again in 15 minutes');

  const ok = typeof password === 'string' && verifyPassword(password, process.env.APP_PASSWORD_HASH ?? '');
  await sql`insert into login_attempts (ok) values (${ok})`;
  await sql`delete from login_attempts where at < now() - interval '1 day'`;

  if (!ok) throw new HttpError(401, 'wrong password');
  return Response.json({ token: createToken() });
}, { isPublic: true });
