import { bad, toId, toPaise } from './api.ts';
import { decrypt } from './crypto.ts';
import { db, personId } from './db.ts';

export const TYPES = ['expense', 'income', 'transfer', 'lend', 'repay'] as const;

export type EntryInput = {
  date: string;
  type: (typeof TYPES)[number];
  amount: number; // paise
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  person: string | null;
  note: string | null;
};

const text = (v: unknown, field: string, max: number): string | null => {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length > max) return bad(`${field} must be text up to ${max} chars`);
  return v.trim() || null;
};

export function isDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().startsWith(v);
}

// Validates the request body. The DB check constraints back this up.
export function parseEntry(b: any): EntryInput {
  if (!b || typeof b !== 'object') bad('body must be an object');
  if (!isDate(b.date)) bad('date must be YYYY-MM-DD');
  if (!TYPES.includes(b.type)) bad(`type must be one of ${TYPES.join(', ')}`);

  const isTransfer = b.type === 'transfer';
  const needsPerson = b.type === 'lend' || b.type === 'repay';
  const e: EntryInput = {
    date: b.date,
    type: b.type,
    amount: toPaise(b.amount),
    account_id: toId(b.account_id, 'account_id'),
    to_account_id: isTransfer ? toId(b.to_account_id, 'to_account_id') : null,
    category_id: isTransfer || b.category_id == null ? null : toId(b.category_id, 'category_id'),
    person: isTransfer ? null : text(b.person, 'person', 100), // optional on expense/income (e.g. "sent to Mom")
    note: text(b.note, 'note', 500),
  };
  if (isTransfer && e.to_account_id === e.account_id) bad('cannot transfer to the same account');
  if (needsPerson && !e.person) bad('person is required for lend/repay');
  return e;
}

// Entry ready for SQL: person name -> id, note encrypted by caller.
export async function resolvePerson(user: number, e: EntryInput) {
  return { ...e, person_id: await personId(user, e.person) };
}

export async function listEntries(user: number, f: { from?: string; to?: string; account_id?: number; category_id?: number; person_id?: number }) {
  const rows = await db()`
    select e.id, to_char(e.date, 'YYYY-MM-DD') as date, e.type, e.amount::float8 / 100 as amount,
           e.account_id, a.name as account, e.to_account_id, ta.name as to_account,
           e.category_id, c.name as category, p.name_enc, e.note_enc
    from entries e
    join accounts a on a.id = e.account_id
    left join accounts ta on ta.id = e.to_account_id
    left join categories c on c.id = e.category_id
    left join people p on p.id = e.person_id
    where e.user_id = ${user}
      and (${f.from ?? null}::date is null or e.date >= ${f.from ?? null}::date)
      and (${f.to ?? null}::date is null or e.date < ${f.to ?? null}::date)
      and (${f.account_id ?? null}::int is null or ${f.account_id ?? null}::int in (e.account_id, e.to_account_id))
      and (${f.category_id ?? null}::int is null or e.category_id = ${f.category_id ?? null}::int)
      and (${f.person_id ?? null}::int is null or e.person_id = ${f.person_id ?? null}::int)
    order by e.date desc, e.id desc`;
  return rows.map(({ name_enc, note_enc, ...r }) => ({ ...r, person: decrypt(name_enc), note: decrypt(note_enc) }));
}

// "2026-11" -> ["2026-11-01", "2026-12-01"]
export function monthRange(month: string): [string, string] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) bad('month must be YYYY-MM');
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return [`${month}-01`, `${next}-01`];
}
