import { verifyToken } from './crypto.ts';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const bad = (message: string): never => {
  throw new HttpError(400, message);
};

// `user` is the logged-in user's id (0 on public routes).
type Handler<C> = (req: Request, ctx: C, user: number) => Promise<Response>;

// Wraps every route: checks the Bearer token (unless public) and turns errors into JSON.
export function route<C>(fn: Handler<C>, { isPublic = false } = {}): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      const user = verifyToken(token);
      if (!isPublic && !user) return Response.json({ error: 'unauthorized' }, { status: 401 });
      return await fn(req, ctx, user);
    } catch (e: any) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      // Postgres FK / check / unique violations = bad input, not a crash.
      if (['23503', '23514', '23505'].includes(e?.code)) return Response.json({ error: 'invalid or duplicate data' }, { status: 400 });
      console.error(e);
      return Response.json({ error: 'server error' }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return bad('invalid JSON body');
  }
}

// Rupees (number, max 2 decimals) -> paise (integer).
// allowSigned: opening balances may be zero or negative (e.g. overdrawn, or money that left before tracking began).
export function toPaise(v: unknown, { allowZero = false, allowSigned = false } = {}): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return bad('amount must be a number');
  const p = Math.round(v * 100);
  if (Math.abs(p - v * 100) > 1e-6) bad('amount can have at most 2 decimals');
  if (allowSigned ? Math.abs(p) > 1e12 : p < 0 || (p === 0 && !allowZero) || p > 1e12) bad('amount out of range');
  return p;
}

export const toId = (v: unknown, field: string): number =>
  Number.isInteger(v) && (v as number) > 0 ? (v as number) : bad(`${field} must be a positive integer`);
