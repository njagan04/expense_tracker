import { route, readJson, toId, bad } from '../../../lib/api.ts';
import { db } from '../../../lib/db.ts';

// List comes from GET /api/summary.
// POST { name }
export const POST = route(async (req, _ctx, user) => {
  const { name } = await readJson(req);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) bad('name must be 1-40 chars');
  const [row] = await db()`insert into categories (user_id, name) values (${user}, ${name.trim()}) returning id, name`;
  return Response.json(row, { status: 201 });
});

// DELETE ?id=3  (entries keep existing, category becomes empty)
export const DELETE = route(async (req, _ctx, user) => {
  const id = toId(Number(new URL(req.url).searchParams.get('id')), 'id');
  await db()`delete from categories where id = ${id} and user_id = ${user}`;
  return new Response(null, { status: 204 });
});
