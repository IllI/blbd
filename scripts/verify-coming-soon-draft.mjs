// Verify exported MCP reads; this script is read-only and does not contact Webflow.
// Usage: node scripts/verify-coming-soon-draft.mjs before.json after.json styles.json
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignments, headingLevels, styles } from "../webflow/coming-soon-responsive.mjs";

function parse(path) {
  const response = JSON.parse(readFileSync(path, "utf8"));
  assert(!response.isError, `MCP request failed: ${path}`);
  const actions = response.content.filter(c => c.type === "text").map(c => JSON.parse(c.text));
  for (const action of actions) {
    assert(!action.error, `MCP action failed: ${JSON.stringify(action.error)}`);
    for (const result of action.result ?? []) {
      assert(!["error", "failed"].includes(result.status), JSON.stringify(result));
    }
  }
  return actions;
}
function flatten(node, map = new Map()) {
  map.set(node.id.element, node);
  for (const child of node.children ?? []) flatten(child, map);
  return map;
}
const text = node => (node.textContent ?? "") + (node.children ?? []).map(text).join("");
const normalize = value => value.replace(/:\s*/g, ": ").replace(/\s+/g, " ").trim();

const [beforePath, afterPath, stylesPath] = process.argv.slice(2);
assert(beforePath && afterPath && stylesPath, "Expected before, after, and style MCP exports");
const beforeRoot = parse(beforePath)[0].result[0].data;
const afterRoot = parse(afterPath)[0].result[0].data;
const before = flatten(beforeRoot);
const after = flatten(afterRoot);
assert.equal(normalize(text(afterRoot)), normalize(text(beforeRoot)), "Existing page copy changed");
for (const [id, className] of Object.entries(assignments)) {
  assert(before.has(id), `Unknown original element: ${id}`);
  assert.deepEqual(after.get(id)?.styleNames, [className], `Class attachment missing: ${className}`);
}
for (const [id, level] of Object.entries(headingLevels)) {
  assert.equal(after.get(id)?.settings.headingLevel, level, `Wrong heading level: ${id}`);
}
let preserved = 0;
for (const [id, node] of before) {
  if (!/^(Image|Form|ComponentInstance)/.test(node.type)) continue;
  assert(after.has(id), `Existing image, form, or component removed: ${id}`);
  assert.deepEqual(after.get(id).settings, node.settings, `Existing settings changed: ${id}`);
  assert.deepEqual(after.get(id).attributes, node.attributes, `Existing attributes changed: ${id}`);
  preserved++;
}
const savedStyles = parse(stylesPath).flatMap(a => a.result.flatMap(r => r.matches ?? []));
const gradientOwner = savedStyles.find(s => s.name === "Main Wrapper");
assert(gradientOwner, "Include Main Wrapper in the styles export to verify the full-page gradient");
assert.match(gradientOwner.properties.base.properties["background-image"], /^radial-gradient\(/, "Original page-wide gradient missing");
assert.deepEqual(after.get("2a4c8d09-8224-7b6f-096f-bad0a1157f26")?.styleNames, ["Main Wrapper"], "Gradient owner was replaced");
assert.equal(after.get("2a4c8d09-8224-7b6f-096f-bad0a1157f26")?.children[0]?.id.element,
  "2a4c8d09-8224-7b6f-096f-bad0a1157f78", "Page sections no longer sit inside the gradient owner");
for (const [name, variants] of Object.entries(styles)) {
  const saved = savedStyles.find(s => s.name === name);
  assert(saved, `Missing native style: ${name}`);
  for (const [variant, props] of Object.entries(variants)) {
    const values = variant === "main" ? saved.properties.base.properties
      : ["focus", "focus-visible"].includes(variant) ? saved.properties.base.pseudos?.[variant]
      : saved.properties.breakpoints?.[variant]?.properties;
    assert(values, `Missing variant: ${name} ${variant}`);
    for (const [key, value] of Object.entries(props)) {
      assert.equal(values[key], value, `Unsaved CSS: ${name} ${variant} ${key}`);
    }
  }
}
console.log(JSON.stringify({
  copyPreserved: true,
  preservedImagesFormsAndComponents: preserved,
  verifiedClassAttachments: Object.keys(assignments).length,
  verifiedNativeStyles: Object.keys(styles).length,
  verifiedHeadingLevels: Object.keys(headingLevels).length,
  fullPageGradientOwnerRetained: true,
}));
