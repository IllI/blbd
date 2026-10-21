import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports = {}, env = {}, globals = {}) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => { if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name]; }, process: { env }, URL, Set, ...globals });
  return exports;
}
const validation = load('../src/lib/admin/validation.ts');
const { betaIsIsolated } = load('../src/lib/admin/environment.ts');
assert.equal(betaIsIsolated({}), false);
assert.equal(betaIsIsolated({ BLBD_ADMIN_ENVIRONMENT: 'beta', BLBD_BETA_SUPABASE_PROJECT_REF: 'ihghsacsxvibtwoiyjag', NEXT_PUBLIC_SUPABASE_URL: 'https://ihghsacsxvibtwoiyjag.supabase.co' }), false);
assert.equal(betaIsIsolated({ BLBD_ADMIN_ENVIRONMENT: 'beta', BLBD_BETA_SUPABASE_PROJECT_REF: 'isolatedbeta', NEXT_PUBLIC_SUPABASE_URL: 'https://isolatedbeta.supabase.co' }), true);
assert.equal(betaIsIsolated({ BLBD_ADMIN_ENVIRONMENT: 'beta', BLBD_BETA_SUPABASE_PROJECT_REF: 'isolatedbeta', NEXT_PUBLIC_SUPABASE_URL: 'https://production.supabase.co' }), false);
for (const kind of ['all', 'members', 'subscribers']) assert.equal(validation.parseAudience({ kind }).kind, kind);
assert.equal(validation.parseAudience({ kind: 'individuals', emails: [' A@EXAMPLE.COM ', 'a@example.com'] }).emails.length, 1);
for (const a of [null, {}, { kind: 'group', groupId: 'bad' }, { kind: 'individuals', emails: [] }, { kind: 'individuals', emails: ['bad'] }, { kind: 'everyone' }]) assert.throws(() => validation.parseAudience(a));
assert.throws(() => validation.parseMessage({ subject: 'x'.repeat(201), body: 'ok', audience: { kind: 'all' } }));
assert.throws(() => validation.parseMessage({ subject: 'ok', body: 'x'.repeat(50001), audience: { kind: 'all' } }));
assert.equal(validation.parseMessage({ subject: ' Hello ', body: ' Body ', audience: { kind: 'members' } }).subject, 'Hello');
console.log('Admin validation and beta isolation checks passed');

// Server authorization behavior: no service-key calls, network, or real login.
let fakeUser = { id: 'admin-id', email: 'admin@blbd.life', email_confirmed_at: '2026-10-01' };
let fakeAdmin = true;
let cookieCalls = 0, bearerCalls = 0;
const transportEnv = { BLBD_WEBFLOW_ADMIN_ORIGIN: 'https://blbd.webflow.io' };
const transport = load('../src/lib/admin/transport.ts', {
  'server-only': {}, 'next/server': { NextResponse: Response },
  './environment': { betaIsIsolated: () => true },
}, transportEnv);
const fakeDb = token => ({
  auth: { getUser: async passedToken => {
    assert.equal(passedToken, token);
    return { data: { user: token && token !== 'valid-token' ? null : fakeUser }, error: null };
  } },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_admin: fakeAdmin }, error: null }) }) }) }),
});
class MockAdminError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const auth = load('../src/lib/admin/auth.ts', {
  'server-only': {}, 'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
  './environment': { betaIsIsolated: () => true },
  './transport': transport,
  '@/lib/env': { requireEnv: name => name },
  '@supabase/supabase-js': { createClient: (url, key, options) => {
    bearerCalls++;
    assert.equal(key, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'); // No service-role authentication.
    assert.equal(options.auth.persistSession, false);
    return fakeDb(options.global.headers.Authorization.slice(7));
  } },
  '@/lib/supabase/server': { createClient: async () => { cookieCalls++; return fakeDb(); } },
});
await assert.rejects(auth.requireAdmin(new Request('https://beta.example/api/admin', { method: 'POST', headers: { origin: 'https://attacker.example' } })), /admin portal/);
fakeUser = null;
await assert.rejects(auth.requireAdmin(), /Sign in/);
fakeUser = { id: 'admin-id', email: 'admin@blbd.life' };
await assert.rejects(auth.requireAdmin(), /Verify/);
fakeUser.email_confirmed_at = '2026-10-01'; fakeAdmin = false;
await assert.rejects(auth.requireAdmin(), /Admins only/);
fakeAdmin = true;
assert.equal((await auth.requireAdmin()).user.id, 'admin-id');

// Cross-origin admin requests are an explicit beta-only bearer transport.
const webflowRequest = (headers = {}, method = 'GET') => new Request('https://beta.example/api/admin/accounts', {
  method, headers: { origin: 'https://blbd.webflow.io', authorization: 'Bearer valid-token', ...headers },
});
const beforeCookies = cookieCalls;
assert.equal((await auth.requireAdmin(webflowRequest())).user.id, 'admin-id');
assert.equal((await auth.requireAdmin(webflowRequest({}, 'PATCH'))).user.id, 'admin-id');
await assert.rejects(auth.requireAdmin(webflowRequest({ authorization: 'Bearer forged' })), /Sign in/);
await assert.rejects(auth.requireAdmin(webflowRequest({ authorization: 'Basic fake' })), /Sign in/);
for (const origin of ['https://evil.webflow.io', 'https://blbd.life', 'https://blbd.webflow.io.evil.example', 'null', '']) {
  await assert.rejects(auth.requireAdmin(webflowRequest({ origin })), /admin portal/);
}
fakeUser.email_confirmed_at = null;
await assert.rejects(auth.requireAdmin(webflowRequest()), /Verify/);
fakeUser.email_confirmed_at = '2026-10-01'; fakeAdmin = false;
await assert.rejects(auth.requireAdmin(webflowRequest()), /Admins only/);
fakeAdmin = true;
assert.equal(cookieCalls, beforeCookies, 'Bearer failures never fall back to cookies');
assert.ok(bearerCalls >= 5);
await assert.rejects(auth.requireAdmin(new Request('https://beta.example/api/admin/accounts', { headers: { origin: 'https://blbd.webflow.io' } })), /admin portal/);
transportEnv.BLBD_WEBFLOW_ADMIN_ORIGIN = '';
await assert.rejects(auth.requireAdmin(webflowRequest()), /admin portal/);
transportEnv.BLBD_WEBFLOW_ADMIN_ORIGIN = 'https://blbd.webflow.io';
const productionTransport = load('../src/lib/admin/transport.ts', {
  'server-only': {}, 'next/server': { NextResponse: Response }, './environment': { betaIsIsolated: () => false },
}, transportEnv);
assert.equal(productionTransport.isBetaWebflowRequest(webflowRequest()), false);
const preflight = (headers = {}) => new Request('https://beta.example/api/admin/accounts', {
  method: 'OPTIONS', headers: { origin: 'https://blbd.webflow.io', 'access-control-request-method': 'PATCH',
    'access-control-request-headers': 'authorization, content-type', ...headers },
});
const allowed = transport.adminPreflight(preflight(), ['GET', 'PATCH']);
assert.equal(allowed.status, 204);
assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://blbd.webflow.io');
assert.equal(allowed.headers.get('access-control-allow-credentials'), null);
for (const headers of [{ origin: 'https://evil.webflow.io' }, { 'access-control-request-method': 'DELETE' },
  { 'access-control-request-headers': 'content-type' }, { 'access-control-request-headers': 'authorization, cookie' }]) {
  const denied = transport.adminPreflight(preflight(headers), ['GET', 'PATCH']);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
}
for (const status of [200, 401, 403, 409, 500]) {
  const result = await transport.adminRoute(async () => new Response(null, { status }))(webflowRequest());
  assert.equal(result.status, status);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('access-control-allow-origin'), 'https://blbd.webflow.io');
}
console.log('Exact-origin beta bearer, cookie CSRF, preflight, revocation and CORS error checks passed');

// Test-send rejection must not record a successful test. The worker uses the
// same explicit provider-error check for audience messages.
let rejected = true, recorded = 0;
const mail = load('../src/lib/admin/mail.ts', {
  'server-only': {}, 'node:crypto': { createHash: () => {}, randomUUID: () => 'lease' },
  './environment': { betaIsIsolated: () => true }, './auth': { AdminError: MockAdminError },
  '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ update: () => ({ eq: async () => { recorded++; return { error: null }; } }) }) }) },
  '@/lib/resend': {
    getResend: () => ({ emails: { send: async () => rejected ? { error: { message: 'Rejected' }, data: null } : { error: null, data: { id: 'provider-id' } } } }),
    fromAddress: () => 'BLBD <contact@blbd.life>', emailShell: value => value,
    escapeHtml: value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
  },
}, { RESEND_API_KEY: 're_valid_test_key', NEXT_PUBLIC_APP_URL: 'https://beta.example', BLBD_MAIL_POSTAL_ADDRESS: 'Test postal address', BLBD_ADMIN_MAIL_ENABLED: 'true' });
await assert.rejects(mail.testCampaign({ id: 'campaign', subject: 'Test', body: '<script>not markup</script>' }, 'admin@blbd.life'), /provider rejected/);
assert.equal(recorded, 0);
rejected = false;
await mail.testCampaign({ id: 'campaign', subject: 'Test', body: 'Body' }, 'admin@blbd.life');
assert.equal(recorded, 1);
// A self-addressed preview is safe while group sending is paused. Postal setup
// and the bulk switch must still block the actual audience worker.
const pausedEnv = { RESEND_API_KEY: 're_valid_test_key', NEXT_PUBLIC_APP_URL: 'https://beta.example', BLBD_ADMIN_MAIL_ENABLED: 'false' };
const pausedMail = load('../src/lib/admin/mail.ts', {
  'server-only': {}, 'node:crypto': {}, './environment': { betaIsIsolated: () => true }, './auth': { AdminError: MockAdminError },
  '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) }) },
  '@/lib/resend': { fromAddress: () => 'BLBD Beta <contact@blbd.life>', emailShell: x => x, escapeHtml: x => x,
    getResend: () => ({ emails: { send: async message => {
      assert.equal(message.to, 'verified-admin@example.com');
      assert.ok(!message.text.includes('undefined'));
      return { data: { id: 'test-only' }, error: null };
    } } }),
  },
}, pausedEnv);
assert.equal(pausedMail.mailConfiguration().canTest, true);
assert.equal(pausedMail.mailConfiguration().canSend, false);
assert.equal(pausedMail.mailConfiguration().sendBlockers.length, 2);
assert.throws(() => pausedMail.requireMail(), /Mail is disabled/);
await pausedMail.testCampaign({ id: 'draft', subject: 'Test', body: 'Safe test' }, 'verified-admin@example.com');
const disabledMail = load('../src/lib/admin/mail.ts', {
  'server-only': {}, 'node:crypto': {}, './environment': { betaIsIsolated: () => false }, './auth': { AdminError: MockAdminError },
  '@/lib/supabase/admin': {}, '@/lib/resend': { fromAddress: () => 'BLBD <contact@blbd.life>' },
});
assert.equal(disabledMail.mailConfiguration().canSend, false);
assert.throws(() => disabledMail.requireMail(), /Mail is disabled/);
console.log('Admin authorization and provider-failure checks passed');
