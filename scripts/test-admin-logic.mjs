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
class MockAdminError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const auth = load('../src/lib/admin/auth.ts', {
  'server-only': {}, 'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
  './environment': { betaIsIsolated: () => true },
  '@/lib/supabase/server': { createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: fakeUser }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_admin: fakeAdmin }, error: null }) }) }) }),
  }) },
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
const disabledMail = load('../src/lib/admin/mail.ts', {
  'server-only': {}, 'node:crypto': {}, './environment': { betaIsIsolated: () => false }, './auth': { AdminError: MockAdminError },
  '@/lib/supabase/admin': {}, '@/lib/resend': { fromAddress: () => 'BLBD <contact@blbd.life>' },
});
assert.equal(disabledMail.mailConfiguration().canSend, false);
assert.throws(() => disabledMail.requireMail(), /Mail is disabled/);
console.log('Admin authorization and provider-failure checks passed');
