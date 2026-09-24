import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sdk = readFileSync(new URL('../public/blbd.js', import.meta.url), 'utf8');
const start = sdk.indexOf('  function applyState() {');
const end = sdk.indexOf('\n  // -----', start);
assert.ok(start >= 0 && end > start);
const applyState = sdk.slice(start, end);

function element(attributes = {}) {
  return {
    attributes: { ...attributes }, visible: true,
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

for (const [loggedIn, tier] of [[false, 'free'], [true, 'free'], [true, 'supporter'], [true, 'member']]) {
  test(`root stays visible: loggedIn=${loggedIn}, tier=${tier}`, () => {
    const root = element();
    const free = element({ 'data-blbd-tier': 'free' });
    const paid = element({ 'data-blbd-tier': 'supporter' });
    const member = element({ 'data-blbd': 'member-only' });
    const guest = element({ 'data-blbd': 'anon-only' });
    const tiers = { free: 0, supporter: 1, member: 2, founding: 3 };
    const context = vm.createContext({
      document: {
        documentElement: root,
        querySelectorAll(selector) {
          if (selector === '[data-blbd-tier]') return [root, free, paid];
          if (selector === '[data-blbd]') return [member, guest];
          return [];
        },
      },
      BLBD: { isLoggedIn: () => loggedIn, tier: () => tier },
      TIER_RANK: tiers,
      show: (el, visible) => { el.visible = visible; },
      mountNavAccount: () => {},
    });
    vm.runInContext(applyState + '\napplyState(); applyState();', context);
    assert.equal(root.visible, true);
    assert.equal(root.attributes['data-blbd-auth'], loggedIn ? 'member' : 'guest');
    assert.equal(root.attributes['data-blbd-tier'], tier);
    assert.equal(free.visible, loggedIn);
    assert.equal(paid.visible, loggedIn && tiers[tier] >= tiers.supporter);
    assert.equal(member.visible, loggedIn);
    assert.equal(guest.visible, !loggedIn);
  });
}
