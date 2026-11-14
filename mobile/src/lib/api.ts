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

const NAME_KEY = 'user_name';
const USERNAME_KEY = 'user_login';

let token: string | null = null;
let name = '';
let username = '';
let onLogout = () => {};

export const setLogoutListener = (fn: () => void) => (onLogout = fn);

// Display name of the logged-in user (shown in the greeting and settings).
export const userName = () => name;
// Username of the last login, so unlocking with the password needs only the password.
export const lastUsername = () => username;

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  name = (await SecureStore.getItemAsync(NAME_KEY)) ?? '';
  username = (await SecureStore.getItemAsync(USERNAME_KEY)) ?? '';
  return token;
}

// path: '/login' { username, password }  or  '/signup' { name, username, password, code }
export async function login(path: '/login' | '/signup', body: Record<string, string>) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `Login failed (${r.status})`);
  token = d.token as string;
  name = d.name as string;
  username = body.username.trim().toLowerCase();
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(NAME_KEY, name);
  await SecureStore.setItemAsync(USERNAME_KEY, username);
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
