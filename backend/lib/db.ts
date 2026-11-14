import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { encrypt, lookupHash } from './crypto.ts';

let _sql: NeonQueryFunction<false, false> | undefined;

// Lazy so `next build` works without DATABASE_URL.
export const db = () => (_sql ??= neon(process.env.DATABASE_URL!));

export async function personId(user: number, name: string | null): Promise<number | null> {
  if (!name) return null;
  const [row] = await db()`
    insert into people (user_id, name_hash, name_enc) values (${user}, ${lookupHash(name)}, ${encrypt(name)})
    on conflict (user_id, name_hash) do update set name_hash = excluded.name_hash
    returning id`;
  return row.id;
}
