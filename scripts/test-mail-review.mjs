// Render the actual presentation component without a browser, credentials, or mail.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const exports = {};
function Button({ children, disabled, onClick }) { return React.createElement('button', { disabled, onClick }, children); }
const js = ts.transpileModule(readFileSync(new URL('../src/components/admin/CampaignReview.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(js, { exports, require: name => {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === '@/components/ui/Button') return { Button };
  throw new Error(`Unexpected import: ${name}`);
} });
const campaign = { id: 'draft', subject: 'Test <script>subject</script>', body: '<script>not executable</script>',
  audience: { kind: 'individuals', emails: ['test@example.com'] }, recipient_count: 1, tested_at: '2026-10-21',
  status: 'draft', accepted: 0, skipped: 0, pending: 1 };
const mail = { canTest: true, canSend: false, needsPostalAddress: true, enabled: false,
  testBlockers: [], sendBlockers: ['Postal address missing', 'Sending disabled'] };
const base = { campaign, mail, audienceName: 'Everyone in beta', busy: false, sending: false, approved: false,
  onApprove() {}, onTest() {}, onSend() {}, onCopy() {}, onPause() {} };
const render = props => renderToStaticMarkup(React.createElement(exports.CampaignReview, { ...base, ...props }));
const blocked = render({});
assert.ok(blocked.includes('✓ Test email sent'));
assert.ok(blocked.includes('Mailing address needed before sending to everyone'));
assert.ok(blocked.indexOf('physical mailing address') < blocked.indexOf('<details>'));
assert.ok(blocked.includes('https://github.com/IllI/blbd/issues/6'));
assert.ok(!blocked.includes('Resolve the setup requirements at the top'));
assert.ok(!blocked.includes('Send to 1 recipient</button>'));
assert.ok(blocked.includes('<button>Send another test to myself</button>'));
assert.ok(!blocked.includes('<script>'));
assert.ok(blocked.includes('&lt;script&gt;not executable&lt;/script&gt;'));
const ready = { ...mail, needsPostalAddress: false, enabled: true, canSend: true, sendBlockers: [] };
const untested = render({ mail: ready, campaign: { ...campaign, tested_at: null } });
assert.ok(untested.includes('Send a test first'));
assert.ok(!untested.includes('Send to 1 recipient</button>'));
assert.ok(render({ mail: ready }).includes('<button disabled="">Send to 1 recipient</button>'));
assert.ok(render({ mail: ready, approved: true }).includes('<button>Send to 1 recipient</button>'));
const complete = render({ campaign: { ...campaign, status: 'complete', accepted: 1 } });
assert.ok(complete.includes('Send complete'));
assert.ok(!complete.includes('Send another test'));
assert.ok(!complete.includes('Mailing address needed'));
console.log('Newsletter review rendering checks passed: inline blocker, real task link, test success, approval gates, completed state, and escaping');
