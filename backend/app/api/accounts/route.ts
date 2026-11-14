import { route, readJson, toId, toPaise, bad, HttpError } from '../../../lib/api.ts';
import { db } from '../../../lib/db.ts';

const name = (v: unknown) =>
  typeof v === 'string' && v.trim() && v.trim().length <= 30 ? v.trim() : bad('name must be 1-30 chars');

// POST { name, opening_balance? }  (rupees)
export const POST = route(async (req) => {
  const b = await readJson(req);
  const [row] = await db()`
    insert into accounts (name, opening_balance)
    values (${name(b.name)}, ${toPaise(b.opening_balance ?? 0, { allowSigned: true })})
    returning id`;
  return Response.json(row, { status: 201 });
});

// PATCH { id, name?, opening_balance? }
export const PATCH = route(async (req) => {
  const b = await readJson(req);
  const id = toId(b.id, 'id');
  const newName = b.name === undefined ? null : name(b.name);
  const opening = b.opening_balance === undefined ? null : toPaise(b.opening_balance, { allowSigned: true });
  const rows = await db()`
    update accounts set name = coalesce(${newName}, name), opening_balance = coalesce(${opening}::bigint, opening_balance)
    where id = ${id} returning id`;
  if (!rows.length) throw new HttpError(404, 'account not found');
  return Response.json({ id });
});

// DELETE ?id=1  (only when the account has no entries, so history is never lost)
export const DELETE = route(async (req) => {
  const id = toId(Number(new URL(req.url).searchParams.get('id')), 'id');
  const [{ n }] = await db()`select count(*)::int as n from entries where ${id} in (account_id, to_account_id)`;
  if (n > 0) throw new HttpError(409, `This account has ${n} entries. Delete or move them first.`);
  await db()`delete from accounts where id = ${id}`;
  return new Response(null, { status: 204 });
});
