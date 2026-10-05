// Read-only verification of original tree, corrected tree, corrected styles, original style exports.
// Usage: node scripts/verify-coming-soon-draft.mjs before-tree after-tree after-styles original-styles...
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignments, styles, createActions, responsiveActions } from "../webflow/coming-soon-responsive.mjs";
function parse(path) {
  const response = JSON.parse(readFileSync(path, "utf8"));
  assert(!response.isError, `MCP request failed: ${path}`);
  const actions = response.content.filter(c => c.type === "text").map(c => JSON.parse(c.text));
  for (const a of actions) {
    assert(!a.error, JSON.stringify(a.error));
    for (const r of a.result ?? []) assert(!["error", "failed"].includes(r.status), JSON.stringify(r));
  }
  return actions;
}
function flatten(node, map = new Map()) {
  map.set(node.id.element, node);
  for (const child of node.children ?? []) flatten(child, map);
  return map;
}
const text = n => (n.textContent ?? "") + (n.children ?? []).map(text).join("");
const semantic = n => ({ type: n.type, textContent: n.textContent, children: (n.children ?? []).map(semantic) });
const savedStyles = path => parse(path).flatMap(a => a.result.flatMap(r => r.matches ?? (r.id ? [r] : [])));
const [beforePath, afterPath, stylesPath, ...baselinePaths] = process.argv.slice(2);
assert(beforePath && afterPath && stylesPath && baselinePaths.length, "Expected trees, final styles, and original style exports");
const beforeRoot = parse(beforePath)[0].result[0].data;
const afterRoot = parse(afterPath)[0].result[0].data;
const before = flatten(beforeRoot), after = flatten(afterRoot);
assert.equal(text(afterRoot), text(beforeRoot), "Original copy must match exactly, including punctuation");
assert.deepEqual(semantic(afterRoot), semantic(beforeRoot), "Original tag/text/inline-bold structure changed");
let preserved = 0;
for (const [id, n] of before) {
  // Only the accidentally replaced Story title's Strong/String IDs require new nodes.
  if (["c250fde5-3f6a-5027-b42a-6d0d6b81c62c", "c250fde5-3f6a-5027-b42a-6d0d6b81c62d"].includes(id)) continue;
  const current = after.get(id);
  assert(current, `Original node missing: ${id}`);
  assert.deepEqual(current.settings, n.settings, `Original settings changed: ${id}`);
  assert.deepEqual(current.attributes, n.attributes, `Original attributes changed: ${id}`);
  const expected = [...(n.styleNames ?? []), ...(assignments[id] ? [assignments[id]] : [])];
  assert.deepEqual(current.styleNames ?? [], expected, `Original class chain not preserved: ${id}`);
  preserved++;
}
const finalStyles = savedStyles(stylesPath);
let originalStylesChecked = 0;
for (const path of baselinePaths) for (const saved of savedStyles(path)) {
  const current = finalStyles.find(s => s.id === saved.id);
  assert(current, `Original style missing: ${saved.name}`);
  assert.deepEqual(current.properties.base, saved.properties.base, `Original desktop CSS modified: ${saved.selector}`);
  for (const [bp, v] of Object.entries(saved.properties.breakpoints ?? {})) {
    assert.deepEqual(current.properties.breakpoints?.[bp] ?? {}, v, `Original breakpoint CSS modified: ${saved.selector} ${bp}`);
  }
  originalStylesChecked++;
}
for (const [name, v] of Object.entries(styles)) {
  const saved = finalStyles.find(s => s.name === name);
  assert(saved, `Missing mobile style: ${name}`);
  assert.deepEqual(saved.properties.base.properties ?? {}, {}, `Desktop declarations forbidden: ${name}`);
  for (const bp of ["main", "medium", "large", "xl", "xxl"]) {
    assert.deepEqual(saved.properties.breakpoints?.[bp]?.properties ?? {}, {}, `Non-mobile declarations forbidden: ${name} ${bp}`);
  }
  for (const bp of ["small", "tiny"]) for (const [key, value] of Object.entries(v[bp] ?? {})) {
    assert.equal(saved.properties.breakpoints?.[bp]?.properties?.[key], value, `Missing mobile CSS: ${name} ${bp} ${key}`);
  }
}
assert(createActions().every(a => a.create_style.properties.length === 0));
assert(responsiveActions().every(a => ["small", "tiny"].includes(a.update_style.breakpoint_id)));
console.log(JSON.stringify({ exactCopyAndInlineFormattingPreserved: true, originalNodesPreserved: preserved, originalStylesChecked, mobileOnlyStyles: Object.keys(styles).length, originalClassChainsRetained: true, desktopTabletDeclarationsUntouched: true }));
