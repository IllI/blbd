// Execute the shipped vanilla controller against real DOM templates, not a
// second implementation. No network, credentials or email provider is used.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const controller = readFileSync(new URL('../public/blbd-portal.js', import.meta.url), 'utf8');
assert.ok(!/\.innerHTML\s*=|insertAdjacentHTML|createElement\(/.test(controller), 'Runtime must not generate page markup');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
async function mount(name, serviceRequest, extra = {}) {
  const html = readFileSync(new URL(`../webflow/portal-migration/${name}.html`, import.meta.url), 'utf8');
  const { window, document } = parseHTML('<html><body>' + html + '</body></html>');
  // The audited WHTML importer maps Webflow Buttons to anchors. Exercise that
  // actual output shape, including keyboard/disabled semantics, not only <button>.
  for (const button of document.querySelectorAll('button[data-blbdp-action]')) {
    const link = document.createElement('a');
    for (const { name, value } of button.attributes) link.setAttribute(name, value);
    link.setAttribute('href', '#');
    while (button.firstChild) link.appendChild(button.firstChild);
    button.replaceWith(link);
  }
  window.confirm = () => true;
  window.BLBD = { ready: Promise.resolve(), isLoggedIn: () => true, profile: { is_admin: true },
    session: { user: { id: 'fixture' } }, serviceRequest, ...extra };
  vm.runInNewContext(controller, { window, document, Set, Promise, console });
  await flush();
  const query = selector => document.querySelector(selector);
  const field = name => query(`[data-blbdp-field="${name}"]`);
  const click = async (name, node = document) => {
    node.querySelector(`[data-blbdp-action="${name}"]`).dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
    await flush();
  };
  const change = async node => { node.dispatchEvent(new window.Event('change', { bubbles: true })); await flush(); };
  return { window, document, query, field, click, change };
}
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let calls = [];
let state = { contacts: [{ email: 'sink@example.invalid', member: true, subscriber: false, opted_out: false },
  { email: 'out@example.invalid', member: false, subscriber: true, opted_out: true }], groups: [], campaigns: [{
    id: 'draft', subject: '<img src=x onerror=evil()>', body: '<script>evil()</script>', audience: { kind: 'individuals', emails: ['sink@example.invalid'] },
    recipient_count: 1, status: 'draft', tested_at: null, created_at: '2026-10-21', accepted: 0, pending: 1, skipped: 0,
  }], mail: { canTest: true, canSend: true, sendBlockers: [], testBlockers: [] } };
let releaseBatch;
const ui = await mount('newsletter', async (path, options) => {
  calls.push({ path, ...options });
  if (!options.body) return response(state);
  const input = options.body;
  if (input.action === 'preview') return response({ count: 1 });
  if (input.action === 'prepare') {
    state.campaigns.unshift({ ...state.campaigns[0], id: 'new-draft', subject: input.subject, body: input.body, audience: input.audience, tested_at: null });
    return response({ id: 'new-draft' });
  }
  if (input.action === 'test') { state.campaigns.find(c => c.id === input.id).tested_at = '2026-10-21'; return response({ test: true }); }
  if (input.action === 'send') {
    assert.equal(input.confirmCount, 1); assert.equal(input.id, 'draft');
    await new Promise(resolve => { releaseBatch = resolve; });
    state.campaigns.find(c => c.id === input.id).status = 'sending';
    return response({ complete: false });
  }
  return response({ error: 'Unsupported fixture operation' }, 400);
});
assert.equal(ui.query('[data-blbdp-private]').hidden, false);
assert.equal(ui.query('[data-blbdp-bind="review-subject"]').textContent, '<img src=x onerror=evil()>');
assert.equal(ui.query('img, script'), null, 'Untrusted message content stays plain text');
assert.equal(ui.query('[data-blbdp-action="send"]').disabled, true);
assert.equal(ui.document.querySelectorAll('[data-blbdp-instance="campaign"]').length, 1);
await ui.click('send');
assert.equal(calls.filter(c => c.body?.action === 'send').length, 0, 'No test or approval means no send');
await ui.click('test');
assert.equal(calls.filter(c => c.body?.action === 'test').length, 1);
assert.equal(ui.query('[data-blbdp-action="send"]').disabled, true, 'Successful test still requires explicit approval');
ui.field('approve').checked = true; await ui.change(ui.field('approve'));
assert.equal(ui.query('[data-blbdp-action="send"]').disabled, false);
assert.equal(ui.query('[data-blbdp-action="send"]').getAttribute('aria-disabled'), 'false');
assert.equal(ui.query('[data-blbdp-action="send"]').getAttribute('tabindex'), '0');
const sending = ui.click('send'); await flush();
assert.equal(calls.filter(c => c.body?.action === 'send').length, 1);
await ui.click('pause'); releaseBatch(); await sending; await flush();
assert.match(ui.query('[data-blbdp-status]').textContent, /Paused after the current batch/);
assert.equal(calls.filter(c => c.body?.action === 'send').length, 1, 'Pause never schedules another batch');
assert.equal(ui.field('approve').checked, false, 'Resume requires fresh approval');
assert.equal(ui.query('[data-blbdp-action="send"]').disabled, true);
await ui.click('compose');
ui.field('subject').value = 'New message'; ui.field('body').value = 'Plain text';
const members = ui.query('[data-blbdp-value="members"]'); members.checked = true; await ui.change(members);
await ui.click('prepare');
assert.equal(state.campaigns[0].audience.kind, 'members');
assert.equal(state.campaigns[0].tested_at, null, 'New copy cannot inherit test approval');
assert.equal(ui.document.querySelectorAll('[data-blbdp-instance="campaign"]').length, 2, 'Refresh clones native templates without duplicates');
await ui.click('contacts');
const optedOut = ui.document.querySelectorAll('[data-blbdp-field="contact"]')[1];
assert.equal(optedOut.disabled, true);
const contact = ui.field('contact'); contact.checked = true; await ui.change(contact);
await ui.click('use-contacts');
assert.equal(ui.query('[data-blbdp-value="individuals"]').checked, true);
assert.equal(ui.query('[data-blbdp-bind="selected-count"]').textContent, '1 contacts selected');

let patch;
const accounts = await mount('accounts', async (path, options) => {
  if (options.method === 'PATCH') { patch = options.body; return response({ success: true }); }
  return response({ page: 1, hasMore: false, accounts: [{ id: 'user', email: 'member@example.invalid', display_name: 'Name', verified: false, membership_tier: 'free', is_admin: false }] });
});
assert.equal(accounts.field('is-admin').disabled, true, 'Unverified admin-grant checkbox is disabled');
accounts.field('display-name').value = 'Edited';
await accounts.click('save-account');
assert.equal(patch.id, 'user'); assert.equal(patch.display_name, 'Edited'); assert.equal(patch.is_admin, false);
assert.equal(accounts.query('[data-blbdp-action="accounts-previous"]').disabled, true);
assert.equal(accounts.query('[data-blbdp-action="accounts-next"]').disabled, true);
const denied = await mount('accounts', async () => response({ error: 'Admins only.' }, 403));
assert.equal(denied.query('[data-blbdp-private]').hidden, true);
assert.match(denied.query('[data-blbdp-status]').textContent, /Admins only/);
assert.equal(denied.document.querySelectorAll('[data-blbdp-instance="account"]').length, 0);

// Exercise the real membership SDK boot, not just the controller's fake SDK.
const sdkSource = readFileSync(new URL('../public/blbd.js', import.meta.url), 'utf8');
async function sdkFixture(native, loggedIn = true, expired = false) {
  const { window, document } = parseHTML('<html><head></head><body><span data-blbd-field="display_name"></span><script src="https://beta.example/blbd.js" data-supabase-url="https://beta.supabase.co" data-supabase-key="public-anon" data-app-url="https://beta.example" data-native-portal="' + native + '" data-login-path="/log-in" data-member-paths="/members/dashboard"></script></body></html>');
  document.readyState = 'complete';
  const redirects = [], requests = [];
  const location = { pathname: '/members/dashboard', search: '', hash: '', origin: 'https://blbd.webflow.io', href: 'https://blbd.webflow.io/members/dashboard', replace: path => redirects.push(path) };
  window.location = location;
  window.history = { replaceState() {} };
  const store = new Map(loggedIn ? [['blbd.session', JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_at: expired ? 1 : Math.floor(Date.now() / 1000) + 3600, user: { id: 'user', email: 'test@example.invalid' } })]] : []);
  const localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  vm.runInNewContext(sdkSource, { window, document, location, localStorage, URL, URLSearchParams, CustomEvent: window.CustomEvent,
    setTimeout, clearTimeout, console, fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (url.includes('grant_type=refresh_token')) return response({ access_token: 'refreshed', refresh_token: 'next', expires_in: 3600, user: { id: 'user', email: 'test@example.invalid' } });
      return response(url.includes('/profiles?') ? [{ display_name: 'Beta member', membership_tier: 'free', is_admin: false }] : {});
    },
  });
  await window.BLBD.ready;
  return { sdk: window.BLBD, document, requests, redirects };
}
const nativeSdk = await sdkFixture(true, true, true);
assert.equal(nativeSdk.document.querySelector('[data-blbd-field="display_name"]').textContent, 'Beta member');
assert.equal(nativeSdk.document.querySelector('#blbd-sidebar, #blbd-nav-account'), null, 'Native portal does not inject generated chrome');
assert.equal(nativeSdk.sdk.session.access_token, 'refreshed');
await nativeSdk.sdk.serviceRequest('/api/admin/accounts');
assert.equal(nativeSdk.requests.at(-1).credentials, 'omit');
assert.equal(nativeSdk.requests.at(-1).headers.Authorization, 'Bearer refreshed');
assert.equal(nativeSdk.requests.at(-1).url, 'https://beta.example/api/admin/accounts');
await assert.rejects(nativeSdk.sdk.serviceRequest('https://attacker.invalid/'), /Unsupported service/);
await assert.rejects(nativeSdk.sdk.request('/auth/v1/admin/users'), /Unsupported data/);
const legacySdk = await sdkFixture(false);
assert.ok(legacySdk.document.querySelector('#blbd-sidebar'), 'Existing sites retain generated member navigation by default');
const guestSdk = await sdkFixture(true, false);
assert.equal(guestSdk.redirects[0], '/log-in?next=%2Fmembers%2Fdashboard');
console.log('Native Webflow template, plain-text safety, account, test/approval, pause and audience-binding checks passed');
