import { route, readJson, toId } from '../../../lib/api.ts';
import { encrypt } from '../../../lib/crypto.ts';
import { db } from '../../../lib/db.ts';
import { listEntries, monthRange, parseEntry, resolvePerson } from '../../../lib/entries.ts';

// GET /api/entries?month=2026-11&account_id=1&category_id=2&person_id=3  (all optional)
export const GET = route(async (req) => {
  const q = new URL(req.url).searchParams;
  const [from, to] = q.get('month') ? monthRange(q.get('month')!) : [];
  const entries = await listEntries({
    from,
    to,
    account_id: q.get('account_id') ? toId(Number(q.get('account_id')), 'account_id') : undefined,
    category_id: q.get('category_id') ? toId(Number(q.get('category_id')), 'category_id') : undefined,
    person_id: q.get('person_id') ? toId(Number(q.get('person_id')), 'person_id') : undefined,
  });
  return Response.json({ entries });
});

export const POST = route(async (req) => {
  const e = await resolvePerson(parseEntry(await readJson(req)));
  const [row] = await db()`
    insert into entries (date, type, amount, account_id, to_account_id, category_id, person_id, note_enc)
    values (${e.date}, ${e.type}, ${e.amount}, ${e.account_id}, ${e.to_account_id},
            ${e.category_id}, ${e.person_id}, ${encrypt(e.note)})
    returning id`;
  return Response.json({ id: row.id }, { status: 201 });
});
