import { route } from '../../../lib/api.ts';
import { decrypt } from '../../../lib/crypto.ts';
import { db } from '../../../lib/db.ts';

// Home screen data: account balances + who owes you.
export const GET = route(async (_req, _ctx, user) => {
  const sql = db();
  const [accounts, people, categories] = await Promise.all([
    sql`
      select a.id, a.name, a.opening_balance::float8 / 100 as opening_balance,
        (a.opening_balance + coalesce(sum(
          case
            when e.to_account_id = a.id then e.amount                -- transfer in
            when e.type in ('income', 'repay') then e.amount
            else -e.amount                                           -- expense, lend, transfer out
          end), 0))::float8 / 100 as balance
      from accounts a
      left join entries e on a.id in (e.account_id, e.to_account_id)
      where a.user_id = ${user}
      group by a.id order by a.id`,
    // Left join: people added by hand show up before they have any entries.
    sql`
      select p.id, p.name_enc,
        coalesce(sum(case e.type when 'lend' then e.amount when 'repay' then -e.amount else 0 end), 0)::float8 / 100 as owes,
        coalesce(sum(case e.type when 'lend' then e.amount else 0 end), 0)::float8 / 100 as lent,
        coalesce(sum(case e.type when 'expense' then e.amount else 0 end), 0)::float8 / 100 as sent,
        count(e.id)::int as entries
      from people p left join entries e on e.person_id = p.id
      where p.user_id = ${user}
      group by p.id`,
    sql`select id, name from categories where user_id = ${user} order by name`,
  ]);
  return Response.json({
    accounts,
    people: people
      .map((p) => ({
        id: p.id as number, name: decrypt(p.name_enc)!,
        owes: p.owes as number, lent: p.lent as number, sent: p.sent as number, entries: p.entries as number,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories,
  });
});
