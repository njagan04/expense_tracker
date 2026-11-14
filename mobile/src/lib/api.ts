import * as SecureStore from 'expo-secure-store';

const BASE = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'session_token';

export type EntryType = 'expense' | 'income' | 'transfer' | 'lend' | 'repay';
export type Account = { id: number; name: string; balance: number; opening_balance: number };
export type Category = { id: number; name: string };
export type Person = { id: number; name: string; owes: number; lent: number; sent: number; entries: number };
export type Summary = { accounts: Account[]; people: Person[]; categories: Category[] };
export type Entry = {
  id: number;
  date: string;
  type: EntryType;
  amount: number;
  account_id: number;
  account: string;
  to_account_id: number | null;
  to_account: string | null;
  category_id: number | null;
  category: string | null;
  person: string | null;
  note: string | null;
};

let token: string | null = null;
let onLogout = () => {};

export const setLogoutListener = (fn: () => void) => (onLogout = fn);

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

export async function login(password: string) {
  const r = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `Login failed (${r.status})`);
  token = d.token as string;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function logout() {
  token = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  onLogout();
}

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401) {
    await logout();
    throw new Error('Session expired, please log in again');
  }
  if (r.status === 204) return null as T;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d as T;
}
