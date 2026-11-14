// Usage: npm run setup
// Fills ENCRYPTION_KEY / SESSION_SECRET in .env if they are empty (existing keys are kept).
// Users sign up in the app with the invite code you put in SIGNUP_CODE.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const envPath = new URL('../.env', import.meta.url);
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const set = (name: string, value: string) => {
  const re = new RegExp(`^${name}=(.*)$`, 'm');
  const current = env.match(re)?.[1];
  if (current === undefined) env += `\n${name}=${value}\n`;
  else if (!current) env = env.replace(re, `${name}=${value}`);
};

set('ENCRYPTION_KEY', randomBytes(32).toString('base64'));
set('SESSION_SECRET', randomBytes(32).toString('base64'));
writeFileSync(envPath, env);

console.log('Saved to .env. Keep a backup of ENCRYPTION_KEY: if it is lost, encrypted notes and names cannot be recovered.');
