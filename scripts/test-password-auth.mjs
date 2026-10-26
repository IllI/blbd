import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseHTML } from 'linkedom';

const portal = 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app';
const webflow = 'https://blbd.webflow.io';
const source = readFileSync('src/app/auth/password/route.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let isolated = true, allowed = true, authCalls = [], error = null, session = { access_token: 'not-returned-to-client' }, thrown = false;
const exports = {};
const imports = {
  'next/server': { NextResponse: { redirect: (url, init) => new Response(null, { ...init, headers: { ...init.headers, Location: String(url) } }) } },
  '@/lib/env': { APP_URL: portal },
  '@/lib/admin/environment': { betaIsIsolated: () => isolated },
  '@/lib/supabase/server': { createClient: async () => ({ auth: {
    signInWithPassword: async input => { authCalls.push(['login', input]); if (thrown) throw Error('must not expose'); return { error, data: { session } }; },
    signUp: async input => { authCalls.push(['signup', input]); if (thrown) throw Error('must not expose'); return { error, data: { session: null } }; },
  } }) },
  '@/lib/redirects': { safeNext: value => value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/dashboard' },
  '@/lib/rate-limit': { clientIp: () => 'fixture', rateLimit: () => allowed },
};
vm.runInNewContext(compiled, { exports, require: key => { assert.ok(key in imports, key); return imports[key]; }, URL, URLSearchParams, Response, Buffer, Uint8Array });
const base = { mode: 'login', email: 'fixture@example.invalid', password: 'temporary-strong-password', next: '/admin/newsletter' };
const req = (fields = base, headers = {}, origin = portal, body) => new Request(origin + '/auth/password', { method: 'POST',
  headers: { Origin: webflow, 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: body ?? new URLSearchParams(fields).toString() });
const go = request => exports.POST(request);
isolated = false; assert.equal((await go(req())).status, 503); isolated = true;
for (const Origin of ['https://evil.invalid', 'null', '', portal]) assert.equal((await go(req(base, { Origin }))).status, 403);
assert.equal((await go(req(base, {}, 'https://immutable.vercel.app'))).status, 400);
assert.equal((await go(req(base, { 'Content-Type': 'application/json' }))).status, 415);
assert.equal(authCalls.length, 0, 'Rejected origins/hosts never reach Supabase');
assert.equal((await go(req(base, {}, portal, 'x='.padEnd(9000, 'x')))).status, 413);
assert.equal((await go(req(base, {}, portal, new URLSearchParams(base) + '&email=second@example.invalid'))).status, 400);
assert.equal((await go(req({ ...base, mode: 'admin' }))).status, 400);
allowed = false; assert.match((await go(req())).headers.get('location'), /rate_limited/); allowed = true;
const ok = await go(req());
assert.equal(ok.status, 303); assert.equal(ok.headers.get('location'), portal + '/admin/newsletter');
assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.equal(await ok.text(), '');
assert.equal(authCalls.at(-1)[1].password, base.password);
for (const next of ['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/\t/evil.invalid', '/x\\y']) {
  assert.equal((await go(req({ ...base, next }))).headers.get('location'), portal + '/dashboard');
}
error = { code: 'invalid_credentials', message: 'SECRET-DETAIL' };
const bad = await go(req()); assert.match(bad.headers.get('location'), /auth_status=invalid_credentials/);
assert.ok(!bad.headers.get('location').includes('fixture')); assert.ok(!bad.headers.get('location').includes('SECRET'));
error = { code: 'email_not_confirmed' }; assert.match((await go(req())).headers.get('location'), /confirm_email/);
error = null;
const signup = { ...base, mode: 'signup', name: 'Fixture Name', privacy: 'yes' };
const count = authCalls.length;
for (const patch of [{ password: 'short' }, { privacy: '' }, { name: '' }, { name: 'x'.repeat(121) }]) {
  assert.match((await go(req({ ...signup, ...patch }))).headers.get('location'), /signup_fields/);
}
assert.equal(authCalls.length, count);
const created = await go(req({ ...signup, is_admin: 'true', email_confirmed_at: 'now', tier: 'founding' }));
assert.equal(created.status, 303); assert.match(created.headers.get('location'), /check_email/);
const data = authCalls.at(-1)[1].options.data;
assert.deepEqual(Object.keys(data).sort(), ['display_name', 'marketing_consent', 'privacy_accepted']);
assert.equal(data.marketing_consent, false); assert.equal(data.privacy_accepted, true);
assert.equal(authCalls.at(-1)[1].options.emailRedirectTo, portal + '/auth/callback?next=%2Fadmin%2Fnewsletter');
await go(req({ ...signup, marketing: 'yes' })); assert.equal(authCalls.at(-1)[1].options.data.marketing_consent, true);
error = { status: 429 }; assert.match((await go(req(signup))).headers.get('location'), /rate_limited/); error = null;
thrown = true; assert.match((await go(req())).headers.get('location'), /unavailable/); thrown = false;

const controller = readFileSync('public/blbd-auth.js', 'utf8');
assert.ok(!/innerHTML\s*=|localStorage|access_token|refresh_token|fetch\(/.test(controller));
function dom(signup = false, search = '', origin = webflow) {
  const prefix = signup ? 'sign-up' : 'log-in';
  const { document, window } = parseHTML(`<html><body><div><form data-wf-user-form-type="${signup ? 'signup' : 'login'}">
    <label for="Email">Email</label><input id="wf-${prefix}-email" name="Email" type="email" required>
    <label for="Password">Password</label><input id="wf-${prefix}-password" name="Password" type="password" required>
    ${signup ? '<label for="Name">Name</label><input id="wf-sign-up-name" name=""><label><input type="checkbox" id="wf-sign-up-accept-privacy" name="Checkbox" required><a href="#">Privacy</a></label><label><input type="checkbox" id="wf-sign-up-accept-communications" name="Checkbox" required>Marketing</label>' : ''}
    <input type="submit" class="button is-small" value="Original action"><a href="/reset-password">Reset</a></form>
    <div data-wf-user-form-error style="display:none"><div class="user-form-error-msg">Designer error</div></div>
    <div data-wf-user-form-verification tabindex="-1" style="display:none">Designer verification message</div></div></body></html>`);
  let submitted = 0, valid = true;
  const form = document.querySelector('form'); form.reportValidity = () => valid;
  const context = { document, window, location: { origin, search }, URLSearchParams,
    HTMLFormElement: { prototype: { submit() { assert.equal(this, form); submitted++; } } } };
  vm.runInNewContext(controller, context);
  return { document, window, form, context, count: () => submitted, invalid: () => { valid = false; } };
}
const ui = dom(false, '?next=%2Fadmin&auth_status=invalid_credentials');
assert.equal(ui.form.getAttribute('action'), portal + '/auth/password');
assert.equal(ui.form.getAttribute('method'), 'post');
assert.equal(ui.form.querySelector('[name="mode"]').value, 'login');
assert.equal(ui.form.querySelector('[name="next"]').value, '/admin');
assert.equal(ui.form.querySelector('label').getAttribute('for'), 'wf-log-in-email');
assert.equal(ui.document.querySelector('[data-wf-user-form-error]').style.display, 'block');
vm.runInNewContext(controller, ui.context);
assert.equal(ui.form.querySelectorAll('[name="mode"]').length, 1, 'Idempotent binding');
const event = new ui.window.Event('submit', { cancelable: true, bubbles: true }); ui.form.dispatchEvent(event);
assert.equal(event.defaultPrevented, true); assert.equal(ui.count(), 1);
ui.form.dispatchEvent(new ui.window.Event('submit', { cancelable: true })); assert.equal(ui.count(), 1);
ui.window.dispatchEvent(new ui.window.Event('pageshow')); assert.equal(ui.form.querySelector('[type="submit"]').disabled, false);
const invalidUi = dom(); invalidUi.invalid(); invalidUi.form.dispatchEvent(new invalidUi.window.Event('submit', { cancelable: true })); assert.equal(invalidUi.count(), 0);
const su = dom(true, '?auth_status=check_email');
assert.equal(su.form.style.display, 'none'); assert.equal(su.document.querySelector('[data-wf-user-form-verification]').style.display, 'block');
assert.equal(su.document.getElementById('wf-sign-up-accept-communications').hasAttribute('required'), false);
assert.equal(su.document.getElementById('wf-sign-up-accept-privacy').hasAttribute('required'), true);
assert.equal(su.document.getElementById('wf-sign-up-name').getAttribute('name'), 'name');
assert.equal(su.document.querySelector('a').getAttribute('href'), '/privacy-policy');
const prod = dom(false, '', 'https://blbd.life'); assert.equal(prod.form.getAttribute('action'), null);
const safeUi = dom(false, '?next=https%3A%2F%2Fevil.invalid&auth_status=%3Cscript%3E');
assert.equal(safeUi.form.querySelector('[name="next"]').value, '/dashboard');
assert.equal(safeUi.document.querySelector('.user-form-error-msg').textContent, 'Designer error');
console.log('Password auth checks passed: isolated beta, exact Origin/host, bounded POST, safe redirects, validation, consent, errors, native forms, idempotency and submit behavior');
