import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import ts from 'typescript';

const env = {
  RESEND_API_KEY: 're_test_only', RESEND_FROM_EMAIL: 'BLBD Beta <contact@blbd.life>',
  SUPABASE_AUTH_EMAIL_HOOK_SECRET: `v1,whsec_${crypto.randomBytes(32).toString('base64')}`,
  NEXT_PUBLIC_APP_URL: 'https://beta.example', NEXT_PUBLIC_SUPABASE_URL: 'https://beta.supabase.co',
};
let isolated = true, accepted = true, calls = [];
const exports = {};
const imports = { 'server-only': {}, 'node:crypto': crypto, standardwebhooks: { Webhook },
  '@/lib/admin/environment': { betaIsIsolated: () => isolated } };
const js = ts.transpileModule(readFileSync(new URL('../src/lib/auth-email.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(js, { exports, require: name => { assert.ok(name in imports); return imports[name]; },
  process: { env }, URL, Buffer, Response, AbortSignal, console: { error() {} },
  fetch: async (url, options) => {
    calls.push({ url, ...options });
    return Response.json(accepted ? { id: 'test-provider-id' } : { message: 'rejected' }, { status: accepted ? 200 : 403 });
  },
});
const payload = { user: { email: 'admin@example.com' }, email_data: {
  email_action_type: 'signup', token_hash: 'a'.repeat(64), redirect_to: 'https://beta.example/auth/confirm?next=%2Fadmin',
} };
const hook = new Webhook(env.SUPABASE_AUTH_EMAIL_HOOK_SECRET.replace(/^v1,/, ''));
function request(value = payload, age = 0, mutate = false) {
  const body = JSON.stringify(value), id = 'event-test', date = new Date(Date.now() - age);
  return new Request('https://beta.example/api/auth/send-email', { method: 'POST', body: mutate ? `${body} ` : body,
    headers: { 'webhook-id': id, 'webhook-timestamp': String(Math.floor(date.getTime() / 1000)),
      'webhook-signature': hook.sign(id, date, body) } });
}
assert.equal((await exports.handleAuthEmail(request(payload, 0, true))).status, 401);
assert.equal((await exports.handleAuthEmail(request(payload, 600_000))).status, 401);
assert.equal(calls.length, 0);
isolated = false;
assert.equal((await exports.handleAuthEmail(request())).status, 503);
isolated = true;
assert.equal((await exports.handleAuthEmail(request({ ...payload, email_data: { ...payload.email_data, redirect_to: 'https://attacker.example/auth/confirm' } }))).status, 400);
assert.equal(calls.length, 0);
accepted = false;
assert.equal((await exports.handleAuthEmail(request())).status, 502);
accepted = true;
assert.equal((await exports.handleAuthEmail(request())).status, 200);
const sent = JSON.parse(calls.at(-1).body);
assert.equal(sent.to, payload.user.email);
assert.equal(sent.from, env.RESEND_FROM_EMAIL);
assert.ok(sent.text.includes('https://beta.supabase.co/auth/v1/verify?token='));
assert.equal(calls.at(-1).headers['Idempotency-Key'], calls.at(-2).headers['Idempotency-Key']);
for (const type of ['signup', 'recovery', 'magiclink', 'invite']) {
  const [message] = exports.authMessages({ ...payload, email_data: { ...payload.email_data, email_action_type: type } });
  assert.ok(message.text.includes(`type=${type}`));
}
const changes = exports.authMessages({ user: { email: 'old@example.com', new_email: 'new@example.com' },
  email_data: { ...payload.email_data, email_action_type: 'email_change', token_hash_new: 'b'.repeat(64) } });
assert.equal(changes.length, 2);
assert.equal(changes[0].to, 'old@example.com');
assert.ok(changes[0].text.includes('b'.repeat(64)));
assert.equal(changes[1].to, 'new@example.com');
assert.ok(changes[1].text.includes('a'.repeat(64)));
assert.equal(exports.authMessages({ user: payload.user, email_data: { email_action_type: 'reauthentication', token: '123456' } })[0].text.includes('123456'), true);
assert.throws(() => exports.authMessages({ ...payload, email_data: { email_action_type: 'unknown' } }));
console.log('Auth email checks passed: signature, freshness, isolation, redirect, provider rejection, idempotency, and all supported auth flows');
