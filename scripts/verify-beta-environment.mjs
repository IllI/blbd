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
// Explicit opt-in sends ONE draft preview to Resend's documented test sink,
// never to a real inbox or audience. Default integration checks send no mail.
const groupSend = process.argv.includes('--group-send');
// Reuse the same isolated fixtures and sink-only audience verification through
// the Webflow bearer transport; SSR portal requests still use cookie sessions.
const webflow = process.argv.includes('--webflow');
const webflowOrigin = 'https://blbd.webflow.io';
let accessToken;
const sinkTest = groupSend || process.argv.includes('--mail-sink');
const email = sinkTest ? `delivered+blbd-admin-${randomUUID()}@resend.dev` : `beta-qa-${randomUUID()}@example.invalid`;
const secondEmail = groupSend ? `delivered+blbd-group-${randomUUID()}@resend.dev` : null;
const jar = new Map();
const client = createServerClient(`https://${ref}.supabase.co`, key('anon'), { cookies: {
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  setAll: cookies => cookies.forEach(c => jar.set(c.name, c.value)),
} });
let userId, secondUserId, campaignId, groupId;
let checks = 0;
async function request(path, body, { cookie = true, requestOrigin = webflow && path.startsWith('/api/admin/') ? webflowOrigin : origin } = {}) {
  const bearer = webflow && path.startsWith('/api/admin/');
  const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: {
    ...(cookie && !bearer ? { Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; ') } : {}),
    ...(cookie && bearer && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(body || bearer ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  return { response, payload };
}
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`PASS: ${label}`); };
try {
  const unauth = await request('/api/admin/accounts', null, { cookie: false });
  check(unauth.response.status === (webflow ? 403 : 401), 'Beta configured and anonymous admin access denied');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Temporary beta verification' } });
  if (created.error) throw new Error('Could not create temporary beta QA identity');
  userId = created.data.user.id;
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw new Error('Could not sign in temporary beta QA identity');
  accessToken = login.data.session.access_token;
  check((await request('/api/admin/accounts')).response.status === 403, 'Verified ordinary member cannot administer accounts');
  const promoted = await admin.from('profiles').update({ is_admin: true }).eq('id', userId);
  if (promoted.error) throw promoted.error;
  const accounts = await request('/api/admin/accounts');
  check(accounts.response.status === 200 && accounts.payload.accounts.some(a => a.id === userId), 'Verified beta admin can read beta accounts');
  if (webflow) {
    check(accounts.response.headers.get('access-control-allow-origin') === webflowOrigin
      && !accounts.response.headers.has('access-control-allow-credentials'), 'Webflow bearer reads use exact-origin CORS without cookie credentials');
    const preflight = await fetch(`${origin}/api/admin/mail`, { method: 'OPTIONS', headers: {
      Origin: webflowOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type',
    } });
    check(preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === webflowOrigin, 'Beta Webflow JSON bearer preflight succeeds');
    const forged = await fetch(`${origin}/api/admin/accounts`, { headers: { Origin: webflowOrigin, Authorization: 'Bearer forged-token' } });
    check(forged.status === 401 && forged.headers.get('access-control-allow-origin') === webflowOrigin, 'Forged bearer is denied with readable CORS error');
    const otherSite = await request('/api/admin/accounts', null, { requestOrigin: 'https://other.webflow.io' });
    check(otherSite.response.status === 403 && !otherSite.response.headers.has('access-control-allow-origin'), 'Another Webflow site cannot use beta admin transport');
  }
  const csrf = await request('/api/admin/mail', { action: 'preview', audience: { kind: 'all' } }, { requestOrigin: 'https://attacker.invalid' });
  check(csrf.response.status === 403, 'Cross-origin admin mutation rejected');
  const portal = await request('/admin');
  check(portal.response.status === 200, 'Beta admin portal renders with its live beta database');
  const newsletter = await request('/admin/newsletter');
  const workspace = await newsletter.response.text();
  check(newsletter.response.status === 200 && workspace.includes('aria-label="Email workspace"') && workspace.includes('Write update') && workspace.includes('Saved emails'), 'Newsletter exposes separate interactive writing, saved-email, and contacts sections');
  const state = await request('/api/admin/mail');
  check(state.response.status === 200 && typeof state.payload.mail.canSend === 'boolean', 'Sending status is exposed to the admin workflow');
  check(typeof state.payload.mail.needsPostalAddress === 'boolean', 'Sending status identifies physical-address readiness');
  if (groupSend) {
    check(state.payload.mail.canSend && !state.payload.mail.needsPostalAddress, 'Beta audience sending is configured and explicitly activated');
    const second = await admin.auth.admin.createUser({ email: secondEmail, password: randomBytes(32).toString('base64url'), email_confirm: true, user_metadata: { display_name: 'Temporary Resend group-test recipient' } });
    if (second.error) throw new Error('Could not create second delivery-sink fixture');
    secondUserId = second.data.user.id;
  }
  const reviewed = await request('/api/admin/mail', { action: 'preview', audience: { kind: 'individuals', emails: [email] } });
  check(reviewed.response.status === 200 && reviewed.payload.count === 1, 'Individual audience resolves against beta contacts');
  let audience = { kind: 'individuals', emails: [email] };
  if (sinkTest) {
    const group = await request('/api/admin/mail', { action: 'group', name: 'Temporary delivery-sink test group', emails: secondEmail ? [email, secondEmail] : [email] });
    groupId = group.payload?.group?.id;
    check(group.response.status === 200 && !!groupId, 'Verified admin can save a group of eligible test contacts');
    audience = { kind: 'group', groupId };
  }
  const prepared = await request('/api/admin/mail', { action: 'prepare', audience, subject: 'Temporary beta verification — do not send', body: 'Synthetic integration test. No real recipient.' });
  campaignId = prepared.payload?.id;
  check(prepared.response.status === 200 && !!campaignId, 'Draft and recipient snapshot persist in beta');
  if (sinkTest) {
    check(state.payload.mail.canTest === true, 'Own-inbox test is available');
    const test = await request('/api/admin/mail', { action: 'test', id: campaignId });
    check(test.response.status === 200 && test.payload.test, 'Draft preview accepted for signed-in Resend delivery-test sink');
    const saved = await admin.from('mail_campaigns').select('tested_at,audience').eq('id', campaignId).single();
    check(!!saved.data?.tested_at && saved.data.audience.kind === 'group', 'Successful group-draft test records readiness without sending to the group');
  }
  if (groupSend) {
    // Never dispatch until the persisted snapshot has been independently checked
    // against ONLY the two exact Resend sink addresses created by this run.
    const frozen = await admin.from('mail_recipients').select('email').eq('campaign_id', campaignId);
    assert.ifError(frozen.error);
    assert.deepEqual(frozen.data.map(r => r.email).sort(), [email, secondEmail].sort());
    await new Promise(resolve => setTimeout(resolve, 1000));
    const send = await request('/api/admin/mail', { action: 'send', id: campaignId, confirmCount: 2 });
    check(send.response.status === 200 && send.payload.complete, 'Explicit saved-group dispatch completes for two test sinks');
    const recipients = await admin.from('mail_recipients').select('status,provider_id').eq('campaign_id', campaignId);
    check(!recipients.error && recipients.data.length === 2 && recipients.data.every(r => r.status === 'accepted' && r.provider_id), 'Provider acceptance is recorded separately for both group recipients');
    const retry = await request('/api/admin/mail', { action: 'send', id: campaignId, confirmCount: 2 });
    check(retry.response.status === 200 && retry.payload.complete, 'Completed campaign retry does not resend the group');
  } else if (!state.payload.mail.canSend || !sinkTest) {
    // In the default no-mail run, the draft is untested. Even when enabled,
    // server-side test enforcement must refuse sending to the fictional address.
    const send = await request('/api/admin/mail', { action: 'send', id: campaignId, confirmCount: 1 });
    check(send.response.status === (state.payload.mail.canSend ? 409 : 503), 'Audience dispatch stays blocked until setup and successful test requirements are met');
  }
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
  console.log(`Beta integration checks passed: ${checks}; ${groupSend ? 'one preview plus two group messages sent ONLY to Resend delivery-test sinks' : sinkTest ? 'one preview sent only to Resend delivery-test sink; no audience mail' : 'no email was sent'}.`);
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
  if (secondUserId) {
    const { error } = await admin.auth.admin.deleteUser(secondUserId);
    if (error) throw new Error('Second test-sink identity cleanup failed');
  }
  if (groupId) {
    const { error } = await admin.from('mail_groups').delete().eq('id', groupId);
    if (error) throw new Error('Temporary beta group cleanup failed');
  }
  const { error } = await admin.from('mail_preferences').delete().eq('email', email);
  if (error) throw new Error('Temporary beta preference cleanup failed');
  if (secondEmail) {
    const { error } = await admin.from('mail_preferences').delete().eq('email', secondEmail);
    if (error) throw new Error('Second test-sink preference cleanup failed');
  }
  console.log('Temporary beta QA identity, campaign, and preference removed.');
}
