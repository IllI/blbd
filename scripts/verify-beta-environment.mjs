// Integration checks against the isolated beta backend; never production.
// Temporary fictional QA identities and drafts are removed in finally.
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const ref = 'hfmjvbjyectxiszutwen';
const origin = 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app';
assert.notEqual(ref, 'ihghsacsxvibtwoiyjag');
const supabaseCli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const keys = JSON.parse(execFileSync(process.execPath, [supabaseCli, 'projects', 'api-keys', '--project-ref', ref, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const key = name => keys.find(k => k.name === name)?.api_key;
for (const name of ['anon', 'service_role']) assert.equal(JSON.parse(Buffer.from(key(name).split('.')[1], 'base64url').toString()).ref, ref);
const admin = createClient(`https://${ref}.supabase.co`, key('service_role'), { auth: { persistSession: false, autoRefreshToken: false } });
const password = randomBytes(32).toString('base64url');
const email = `beta-qa-${randomUUID()}@example.invalid`;
const jar = new Map();
const client = createServerClient(`https://${ref}.supabase.co`, key('anon'), { cookies: {
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  setAll: cookies => cookies.forEach(c => jar.set(c.name, c.value)),
} });
let userId, campaignId;
let checks = 0;
async function request(path, body, { cookie = true, requestOrigin = origin } = {}) {
  const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: {
    ...(cookie ? { Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; ') } : {}),
    ...(body ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  return { response, payload };
}
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`PASS: ${label}`); };
try {
  const unauth = await request('/api/admin/accounts', null, { cookie: false });
  check(unauth.response.status === 401, 'Beta configured and anonymous admin access denied');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Temporary beta verification' } });
  if (created.error) throw new Error('Could not create temporary beta QA identity');
  userId = created.data.user.id;
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw new Error('Could not sign in temporary beta QA identity');
  check((await request('/api/admin/accounts')).response.status === 403, 'Verified ordinary member cannot administer accounts');
  const promoted = await admin.from('profiles').update({ is_admin: true }).eq('id', userId);
  if (promoted.error) throw promoted.error;
  const accounts = await request('/api/admin/accounts');
  check(accounts.response.status === 200 && accounts.payload.accounts.some(a => a.id === userId), 'Verified beta admin can read beta accounts');
  const csrf = await request('/api/admin/mail', { action: 'preview', audience: { kind: 'all' } }, { requestOrigin: 'https://attacker.invalid' });
  check(csrf.response.status === 403, 'Cross-origin admin mutation rejected');
  const portal = await request('/admin');
  check(portal.response.status === 200, 'Beta admin portal renders with its live beta database');
  const state = await request('/api/admin/mail');
  check(state.response.status === 200 && state.payload.mail.canSend === false, 'Real email sending remains disabled');
  const reviewed = await request('/api/admin/mail', { action: 'preview', audience: { kind: 'individuals', emails: [email] } });
  check(reviewed.response.status === 200 && reviewed.payload.count === 1, 'Individual audience resolves against beta contacts');
  const prepared = await request('/api/admin/mail', { action: 'prepare', audience: { kind: 'individuals', emails: [email] }, subject: 'Temporary beta verification — do not send', body: 'Synthetic integration test. No real recipient.' });
  campaignId = prepared.payload?.id;
  check(prepared.response.status === 200 && !!campaignId, 'Draft and recipient snapshot persist in beta');
  const send = await request('/api/admin/mail', { action: 'test', id: campaignId });
  check(send.response.status === 503, 'Missing email configuration blocks a send without contacting the provider');
  const pref = await admin.from('mail_preferences').select('unsubscribe_token').eq('email', email).single();
  if (pref.error) throw pref.error;
  const scanner = await request(`/api/updates/unsubscribe?token=${pref.data.unsubscribe_token}`);
  check(scanner.response.status === 307, 'Email scanner GET does not unsubscribe');
  const unsub = await fetch(`${origin}/api/updates/unsubscribe?token=${pref.data.unsubscribe_token}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  check(unsub.status === 200, 'One-click unsubscribe saves beta preference');
  const suppressed = await request('/api/admin/mail', { action: 'preview', audience: { kind: 'individuals', emails: [email] } });
  check(suppressed.payload?.count === 0, 'Unsubscribed beta contact is removed from individual audience');
  const demoted = await admin.from('profiles').update({ is_admin: false }).eq('id', userId);
  if (demoted.error) throw demoted.error;
  check((await request('/api/admin/accounts')).response.status === 403, 'Revocation blocks existing admin session immediately');
  console.log(`Beta integration checks passed: ${checks}; no email was sent.`);
} finally {
  // Exact IDs/email created above, isolated beta project only. Never broad deletes.
  if (campaignId) {
    const { error } = await admin.from('mail_campaigns').delete().eq('id', campaignId);
    if (error) throw new Error('Temporary beta campaign cleanup failed');
  }
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error('Temporary beta identity cleanup failed');
  }
  const { error } = await admin.from('mail_preferences').delete().eq('email', email);
  if (error) throw new Error('Temporary beta preference cleanup failed');
  console.log('Temporary beta QA identity, campaign, and preference removed.');
}
