// Isolated beta only. Never uses production, real users or a real audience.
// --mail-sink explicitly exercises signup email to Resend's delivery-test sink.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ref = 'hfmjvbjyectxiszutwen';
const portal = 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app';
const webflow = 'https://blbd.webflow.io';
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const keys = JSON.parse(execFileSync(process.execPath, [cli, 'projects', 'api-keys', '--project-ref', ref, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const key = name => keys.find(k => k.name === name)?.api_key;
for (const name of ['anon', 'service_role']) assert.equal(JSON.parse(Buffer.from(key(name).split('.')[1], 'base64url')).ref, ref);
const admin = createClient(`https://${ref}.supabase.co`, key('service_role'), { auth: { persistSession: false } });
const runId = randomUUID(), password = randomBytes(32).toString('base64url');
const email = `native-auth-${runId}@example.invalid`;
const signupEmail = `delivered+blbd-native-${runId}@resend.dev`;
const sink = process.argv.includes('--mail-sink');
let fixture, signupFixture;
const cookies = response => response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
const post = (fields, origin = webflow) => fetch(portal + '/auth/password', { method: 'POST', redirect: 'manual',
  headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), signal: AbortSignal.timeout(20000) });
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; console.log('PASS: ' + label); }
try {
  check((await post({ mode: 'login', email, password }, 'https://evil.invalid')).status === 403, 'Hostile login CSRF origin rejected');
  check((await post({ mode: 'login', email, password }, 'null')).status === 403, 'Opaque form origin rejected');
  const malformed = await post({ mode: 'signup', email: 'invalid', password });
  check(malformed.status === 303 && new URL(malformed.headers.get('location')).searchParams.get('auth_status') === 'invalid_fields', 'Native invalid field error redirects without form secrets');
  const consent = await post({ mode: 'signup', email, password, name: 'QA fixture' });
  check(new URL(consent.headers.get('location')).searchParams.get('auth_status') === 'signup_fields', 'Server enforces signup privacy acknowledgement');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Temporary native auth check' } });
  assert.ok(!created.error, 'Temporary fixture creation failed'); fixture = created.data.user.id;
  const initial = await admin.from('profiles').select('is_admin,tier,avatar_url,display_name').eq('id', fixture).single();
  assert.ok(!initial.error);
  const invalid = await post({ mode: 'login', email, password: 'incorrect-fixture-password' });
  check(new URL(invalid.headers.get('location')).searchParams.get('auth_status') === 'invalid_credentials' && !cookies(invalid), 'Wrong password never creates a session');
  const login = await post({ mode: 'login', email, password, next: '/dashboard', is_admin: 'true' });
  check(login.status === 303 && login.headers.get('location') === portal + '/dashboard', 'Native login uses first-party POST and safe dashboard redirect');
  const jar = cookies(login);
  check(jar.includes('sb-' + ref + '-auth-token='), 'Login creates beta portal session cookies');
  const dashboard = await fetch(portal + '/dashboard', { headers: { Cookie: jar }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  check(dashboard.status === 200, 'Portal accepts session created by the migrated native form');
  const denied = await fetch(portal + '/api/admin/accounts', { headers: { Cookie: jar }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  check(denied.status === 403, 'Form fields cannot elevate an ordinary account to administrator');
  const after = await admin.from('profiles').select('is_admin,tier,avatar_url,display_name').eq('id', fixture).single();
  check(JSON.stringify(after.data) === JSON.stringify(initial.data), 'Login preserves profile name, image, tier and role');
  if (sink) {
    assert.match(signupEmail, /^delivered\+blbd-native-[a-f0-9-]+@resend\.dev$/);
    const signup = await post({ mode: 'signup', email: signupEmail, password, name: 'Temporary native signup', privacy: 'yes', is_admin: 'true' });
    // Capture fixture even when a mail-hook error aborts the assertions.
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.ok(!users.error);
    const user = users.data.users.find(u => u.email === signupEmail); signupFixture = user?.id;
    check(signup.status === 303 && new URL(signup.headers.get('location')).searchParams.get('auth_status') === 'check_email', 'Signup hook accepted a confirmation email sent ONLY to a generated Resend test sink');
    check(user && !user.email_confirmed_at && user.user_metadata.marketing_consent === false, 'New account remains unverified and marketing is not silently opted in');
    const unconfirmed = await post({ mode: 'login', email: signupEmail, password });
    check(new URL(unconfirmed.headers.get('location')).searchParams.get('auth_status') === 'confirm_email' && !cookies(unconfirmed), 'Unverified native signup cannot sign in');
  }
  console.log(`Native auth live verification passed: ${checks} checks${sink ? ', one signup email to Resend test sink only' : ', no email sent'}.`);
} finally {
  for (const id of [signupFixture, fixture].filter(Boolean)) {
    const deleted = await admin.auth.admin.deleteUser(id);
    assert.ok(!deleted.error, 'Could not remove temporary beta auth fixture');
  }
  console.log('Temporary beta auth fixtures removed.');
}
