import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

function load(path, imports, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    assert.ok(name in imports, name); return imports[name];
  }, ...globals });
  return exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate); if (match) return match;
  }
}

let isolated = true;
const { default: layout } = load('src/app/(portal)/layout.tsx', {
  'react/jsx-runtime': jsx,
  'next/navigation': { redirect: () => { throw Error('Unexpected redirect'); } },
  '@/lib/supabase/server': { getSessionProfile: async () => ({ user: { email: 'fixture@example.invalid' }, profile: null }) },
  '@/components/layout/PortalShell': { PortalShell: 'PortalShell' },
  '@/lib/admin/environment': { betaIsIsolated: () => isolated },
});
const beta = await layout({ children: 'Portal' });
assert.equal(beta.props.logoutHref, 'https://blbd.webflow.io/log-in');
isolated = false;
const production = await layout({ children: 'Portal' });
assert.equal(production.props.logoutHref, '/login', 'Production keeps its existing destination');

let states = [], cursor = 0, finish, authResult, calls = 0;
const navigations = [];
const { PortalShell } = load('src/components/layout/PortalShell.tsx', {
  'react/jsx-runtime': jsx,
  react: {
    useEffect: () => {}, useRef: () => ({ current: null }),
    useState: initial => {
      const index = cursor++; if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
  },
  'next/link': { default: 'a' }, 'next/navigation': { usePathname: () => '/dashboard' },
  '@/lib/tiers': { canViewDirectory: () => false },
  '@/lib/supabase/client': { createClient: () => ({ auth: { signOut: async () => {
    calls++; if (authResult) return authResult();
    return new Promise(resolve => { finish = resolve; });
  } } }) },
  '@/lib/utils': { displayNameOf: () => 'Fixture' }, '@/lib/env': { SITE_URL: 'https://blbd.webflow.io' },
  '@/components/ui/Avatar': { Avatar: 'Avatar' }, '@/components/ui/Badge': { TierBadge: 'TierBadge' },
}, { window: { location: { replace: href => navigations.push(href) } } });

const shell = PortalShell({ profile: null, email: 'fixture@example.invalid', logoutHref: beta.props.logoutHref, children: 'Portal' });
const menu = find(shell, node => typeof node.type === 'function' && node.props.logoutHref);
assert.ok(menu, 'Destination reaches the actual account menu');
states = [];
const render = () => { cursor = 0; return menu.type(menu.props); };
let tree = render();
find(tree, node => node.type === 'button' && node.props['aria-haspopup'] === 'menu').props.onClick();
const button = () => find(render(), node => node.type === 'button' && node.props.role === 'menuitem');

const pending = button().props.onClick();
assert.equal(button().props.disabled, true);
assert.equal(navigations.length, 0, 'No navigation before sign-out finishes');
finish({ error: null }); await pending;
assert.deepEqual(navigations, ['https://blbd.webflow.io/log-in']);

for (const result of [async () => ({ error: { message: 'Private provider detail' } }), async () => { throw Error('Private network detail'); }]) {
  navigations.length = 0; authResult = result;
  await button().props.onClick();
  assert.equal(navigations.length, 0, 'Failed sign-out must not pretend the session was cleared');
  assert.equal(button().props.disabled, false, 'Logout can be retried');
  const alert = find(render(), node => node.props.role === 'alert');
  assert.equal(alert.props.children, 'Unable to log out. Please try again.');
}
authResult = async () => ({ error: null });
await button().props.onClick();
assert.deepEqual(navigations, ['https://blbd.webflow.io/log-in']);
assert.equal(calls, 4);
console.log('PASS: beta/production destinations, pending sign-out, success, failure and retry');
