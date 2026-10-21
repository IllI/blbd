import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseHTML } from 'linkedom';

function load(path, imports, globals = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; },
    URL, Response, AbortSignal, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://beta.supabase.co' } }, ...globals });
  return exports;
}
let isolated = true, google = true, yahoo = true, listingFails = false, calls = [];
const readiness = load('../src/lib/social-auth.ts', {
  'server-only': {}, '@/lib/admin/environment': { betaIsIsolated: () => isolated },
  '@/lib/env': { requireEnv: name => name === 'NEXT_PUBLIC_SUPABASE_URL' ? 'https://beta.supabase.co' : 'public-anon' },
  '@/lib/supabase/admin': { createAdminClient: () => ({ auth: { admin: { customProviders: { listProviders: async () => ({
    error: listingFails ? new Error('Failed') : null,
    data: { providers: [{ identifier: 'custom:not-yahoo', enabled: true, client_id: 'other' }, { identifier: 'custom:yahoo', enabled: yahoo, client_id: 'public-client' }] },
  }) } } } }) },
}, { fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ external: { google } }); } });
assert.deepEqual(JSON.parse(JSON.stringify(await readiness.socialReadiness())), { google: true, yahoo: true });
google = false; yahoo = false;
assert.deepEqual(JSON.parse(JSON.stringify(await readiness.socialReadiness())), { google: false, yahoo: false });
assert.equal(calls.at(-1).options.headers.apikey, 'public-anon');
isolated = false; const before = calls.length;
await assert.rejects(readiness.socialReadiness(), /isolated/); assert.equal(calls.length, before);
isolated = true; listingFails = true; await assert.rejects(readiness.socialReadiness(), /verify/); listingFails = false;

const NextResponse = { json: Response.json, redirect: url => new Response(null, { status: 307, headers: { Location: String(url) } }) };
const { safeNext } = load('../src/lib/redirects.ts', {});
let enabled = { google: true, yahoo: true }, oauthCalls = [], rateAllowed = true;
const route = load('../src/app/auth/social/route.ts', {
  'next/server': { NextResponse }, '@/lib/env': { APP_URL: 'https://beta.example' },
  '@/lib/redirects': { safeNext }, '@/lib/admin/environment': { betaIsIsolated: () => isolated },
  '@/lib/social-auth': { SOCIAL_PROVIDERS: { google: 'google', yahoo: 'custom:yahoo' }, socialReadiness: async () => enabled },
  '@/lib/rate-limit': { clientIp: () => 'fixture', rateLimit: () => rateAllowed },
  '@/lib/supabase/server': { createClient: async () => ({ auth: { signInWithOAuth: async input => {
    oauthCalls.push(input); return { error: null, data: { url: 'https://beta.supabase.co/auth/v1/authorize?provider=' + encodeURIComponent(input.provider) } };
  } } }) },
});
const req = (query, origin = 'https://beta.example') => new Request(origin + '/auth/social?' + query);
assert.equal((await route.GET(req('provider=attacker'))).status, 400);
isolated = false; assert.equal((await route.GET(req('provider=google'))).status, 503); isolated = true;
const canonical = await route.GET(req('provider=yahoo&next=%2Fadmin', 'https://immutable.example'));
assert.equal(canonical.headers.get('location'), 'https://beta.example/auth/social?provider=yahoo&next=%2Fadmin');
assert.equal(oauthCalls.length, 0, 'PKCE is never created on the wrong cookie host');
for (const provider of ['google', 'yahoo']) {
  const result = await route.GET(req('provider=' + provider + '&next=%2Fadmin%2Fnewsletter'));
  assert.equal(result.status, 307);
  assert.equal(new URL(result.headers.get('location')).hostname, 'beta.supabase.co');
  assert.equal(oauthCalls.at(-1).provider, provider === 'yahoo' ? 'custom:yahoo' : 'google');
  assert.equal(oauthCalls.at(-1).options.redirectTo, 'https://beta.example/auth/callback?next=%2Fadmin%2Fnewsletter');
  assert.equal(oauthCalls.at(-1).options.skipBrowserRedirect, true);
}
await route.GET(req('provider=google&next=https%3A%2F%2Fevil.example'));
assert.equal(oauthCalls.at(-1).options.redirectTo, 'https://beta.example/auth/callback?next=%2Fdashboard');
enabled.google = false; const beforeDisabled = oauthCalls.length;
const disabled = await route.GET(req('provider=google'));
assert.ok(disabled.headers.get('location').includes('social_setup_required'));
assert.equal(oauthCalls.length, beforeDisabled, 'Unconfigured providers never start OAuth');
rateAllowed = false;
assert.ok((await route.GET(req('provider=yahoo'))).headers.get('location').includes('social_rate_limit'));

const controller = readFileSync(new URL('../public/blbd-social.js', import.meta.url), 'utf8');
assert.ok(!/\.innerHTML\s*=|createElement\(|localStorage|access_token|refresh_token/.test(controller));
async function dom(mode, available, origin = 'https://blbd.webflow.io') {
  const native = readFileSync(new URL(`../webflow/portal-migration/social-${mode}.html`, import.meta.url), 'utf8');
  const { window, document } = parseHTML(`<html><body><form data-existing-form="unchanged"><input id="wf-${mode === 'login' ? 'log-in' : 'sign-up'}-email" /><input id="wf-sign-up-accept-privacy" type="checkbox" /><input type="submit" value="Existing password action" /><div class="w-users-userformfooter">Existing footer</div></form>${native}</body></html>`);
  let passwordSubmits = 0, requests = [];
  document.querySelector('form').addEventListener('submit', () => { passwordSubmits++; });
  vm.runInNewContext(controller, { document, location: { origin, search: '?next=%2Fadmin' }, URL, URLSearchParams,
    fetch: async (url, options) => { requests.push({ url, options }); return Response.json({ providers: available }); } });
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
  document.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  return { document, window, requests, passwordSubmits };
}
const ui = await dom('login', { google: true, yahoo: true });
assert.equal(ui.document.querySelector('[data-blbd-social]').parentNode.tagName, 'FORM');
assert.equal(ui.passwordSubmits, 1, 'Original password form submission listener is not replaced');
assert.equal(ui.document.querySelector('form').getAttribute('data-existing-form'), 'unchanged');
for (const provider of ['google', 'yahoo']) {
  const a = ui.document.querySelector(`[data-blbd-social-provider="${provider}"]`);
  assert.equal(a.className, 'button is-small');
  assert.equal(a.getAttribute('aria-disabled'), 'false');
  assert.equal(new URL(a.getAttribute('href')).searchParams.get('next'), '/admin');
}
assert.equal(ui.requests[0].options.credentials, 'omit');
const blocked = await dom('signup', { google: false, yahoo: false });
const button = blocked.document.querySelector('[data-blbd-social-provider="yahoo"]');
const click = new blocked.window.Event('click', { bubbles: true, cancelable: true }); button.dispatchEvent(click);
assert.equal(click.defaultPrevented, true);
assert.match(blocked.document.querySelector('[data-blbd-social-status]').textContent, /beta setup/);
const consent = await dom('signup', { google: true, yahoo: true });
const event = new consent.window.Event('click', { bubbles: true, cancelable: true });
consent.document.querySelector('[data-blbd-social-provider="google"]').dispatchEvent(event);
assert.equal(event.defaultPrevented, true);
assert.match(consent.document.querySelector('[data-blbd-social-status]').textContent, /privacy policy/);
const prod = await dom('login', { google: true, yahoo: true }, 'https://blbd.life');
assert.equal(prod.requests.length, 0, 'No controller behavior on production');
console.log('Social auth checks passed: beta isolation, Google/Yahoo mapping, readiness, PKCE callback/host, safe next, rate limit, native theme, consent and password form preservation');
