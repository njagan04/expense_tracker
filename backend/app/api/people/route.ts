import { route, readJson, toId, bad, HttpError } from '../../../lib/api.ts';
import { db, personId } from '../../../lib/db.ts';

// POST { name }  -> adds a person you can tag later (same name = same person).
export const POST = route(async (req) => {
  const { name } = await readJson(req);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) bad('name must be 1-100 chars');
  return Response.json({ id: await personId(name.trim()) }, { status: 201 });
});

// DELETE ?id=3  (only people with no entries, so history is never lost)
export const DELETE = route(async (req) => {
  const id = toId(Number(new URL(req.url).searchParams.get('id')), 'id');
  const [{ n }] = await db()`select count(*)::int as n from entries where person_id = ${id}`;
  if (n > 0) throw new HttpError(409, `This person is on ${n} entries, so they can't be removed.`);
  await db()`delete from people where id = ${id}`;
  return new Response(null, { status: 204 });
});
