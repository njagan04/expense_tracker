// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.SESSION_SECRET = randomBytes(32).toString('base64');

const { encrypt, decrypt, lookupHash, hashPassword, verifyPassword, createToken, verifyToken } = await import('./crypto.ts');
const { toPaise } = await import('./api.ts');
const { parseEntry, monthRange } = await import('./entries.ts');

test('encryption round-trips and is randomized', () => {
  const a = encrypt('Rahul'), b = encrypt('Rahul');
  assert.notEqual(a, b);
  assert.equal(decrypt(a), 'Rahul');
  assert.equal(lookupHash(' rahul '), lookupHash('Rahul'));
  assert.throws(() => decrypt(a!.slice(0, -4) + 'AAAA')); // tampering detected
});

test('password + token', () => {
  const h = hashPassword('correct horse battery');
  assert.ok(verifyPassword('correct horse battery', h));
  assert.ok(!verifyPassword('wrong', h));
  const t = createToken(7, 0);
  assert.equal(verifyToken(t, 1000), 7);
  assert.equal(verifyToken(t, 31 * 86_400_000), 0); // expired
  assert.equal(verifyToken(t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), 1000), 0); // forged
  assert.equal(verifyToken(t.replace(/^7/, '8'), 1000), 0); // can't switch user
  assert.equal(verifyToken('', 0), 0);
});

test('money parsing', () => {
  assert.equal(toPaise(250.5), 25050);
  assert.equal(toPaise(0.1 + 0.2), 30);
  assert.throws(() => toPaise(1.005));
  assert.throws(() => toPaise(0));
  assert.throws(() => toPaise(-5));
  assert.throws(() => toPaise('100' as any));
  assert.equal(toPaise(0, { allowZero: true }), 0);
});

test('entry validation', () => {
  const base = { date: '2026-11-03', type: 'expense', amount: 100, account_id: 1, category_id: 2 };
  assert.equal(parseEntry(base).amount, 10000);
  assert.throws(() => parseEntry({ ...base, date: '2026-02-30' }));
  assert.throws(() => parseEntry({ ...base, type: 'gift' }));
  assert.throws(() => parseEntry({ ...base, type: 'transfer' })); // no to_account
  assert.throws(() => parseEntry({ ...base, type: 'transfer', to_account_id: 1 })); // same account
  const t = parseEntry({ ...base, type: 'transfer', to_account_id: 2 });
  assert.equal(t.category_id, null);
  assert.throws(() => parseEntry({ ...base, type: 'lend' })); // no person
  assert.equal(parseEntry({ ...base, type: 'lend', person: ' Rahul ' }).person, 'Rahul');
  assert.equal(parseEntry({ ...base, person: 'Mom' }).person, 'Mom'); // "sent to" on an expense
  assert.equal(parseEntry({ ...base, type: 'transfer', to_account_id: 2, person: 'Mom' }).person, null); // never on transfers
});

test('opening balance may be negative', () => {
  assert.equal(toPaise(-25339, { allowSigned: true }), -2533900);
  assert.equal(toPaise(0, { allowSigned: true }), 0);
});

test('month range', () => {
  assert.deepEqual(monthRange('2026-12'), ['2026-12-01', '2027-01-01']);
  assert.deepEqual(monthRange('2026-02'), ['2026-02-01', '2026-03-01']);
  assert.throws(() => monthRange('2026-13'));
});
