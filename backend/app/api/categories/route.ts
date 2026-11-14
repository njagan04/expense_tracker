import { route, readJson, toId, bad } from '../../../lib/api.ts';
import { db } from '../../../lib/db.ts';

// List comes from GET /api/summary.
// POST { name }
export const POST = route(async (req) => {
  const { name } = await readJson(req);
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) bad('name must be 1-40 chars');
  const [row] = await db()`insert into categories (name) values (${name.trim()}) returning id, name`;
  return Response.json(row, { status: 201 });
});

// DELETE ?id=3  (entries keep existing, category becomes empty)
export const DELETE = route(async (req) => {
  const id = toId(Number(new URL(req.url).searchParams.get('id')), 'id');
  await db()`delete from categories where id = ${id}`;
  return new Response(null, { status: 204 });
});
