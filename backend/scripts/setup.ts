// Usage: npm run setup
// Asks for your app password and writes its hash into .env.
// Also fills ENCRYPTION_KEY / SESSION_SECRET in .env if they are empty (existing keys are kept).
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../lib/crypto.ts';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Choose your app password (min 12 chars): ');
rl.close();
if (password.length < 12) throw new Error('Password must be at least 12 characters');

const envPath = new URL('../.env', import.meta.url);
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const key = () => randomBytes(32).toString('base64');
const set = (name: string, value: string, overwrite: boolean) => {
  const re = new RegExp(`^${name}=(.*)$`, 'm');
  const current = env.match(re)?.[1];
  if (current === undefined) env += `\n${name}=${value}\n`;
  else if (overwrite || !current) env = env.replace(re, `${name}=${value}`);
};

set('APP_PASSWORD_HASH', hashPassword(password), true);
set('ENCRYPTION_KEY', key(), false);
set('SESSION_SECRET', key(), false);
writeFileSync(envPath, env);

console.log('\nSaved to .env. Restart `npm run dev` if it is running.');
console.log('Keep a backup of ENCRYPTION_KEY: if it is lost, encrypted notes and names cannot be recovered.');
