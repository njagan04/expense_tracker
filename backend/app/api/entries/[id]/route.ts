import { route, readJson, toId, HttpError } from '../../../../lib/api.ts';
import { encrypt } from '../../../../lib/crypto.ts';
import { db } from '../../../../lib/db.ts';
import { parseEntry, resolvePerson } from '../../../../lib/entries.ts';

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (ctx: Ctx) => toId(Number((await ctx.params).id), 'id');

export const PUT = route(async (req, ctx: Ctx) => {
  const id = await idOf(ctx);
  const e = await resolvePerson(parseEntry(await readJson(req)));
  const rows = await db()`
    update entries set date = ${e.date}, type = ${e.type}, amount = ${e.amount},
      account_id = ${e.account_id}, to_account_id = ${e.to_account_id}, category_id = ${e.category_id},
      person_id = ${e.person_id}, note_enc = ${encrypt(e.note)}
    where id = ${id} returning id`;
  if (!rows.length) throw new HttpError(404, 'entry not found');
  return Response.json({ id });
});

export const DELETE = route(async (_req, ctx: Ctx) => {
  const rows = await db()`delete from entries where id = ${await idOf(ctx)} returning id`;
  if (!rows.length) throw new HttpError(404, 'entry not found');
  return new Response(null, { status: 204 });
});
