// Read-only audit of saved MCP get_all_elements results. Never contacts Webflow.
import { readFileSync } from 'node:fs';
const path = process.argv[2];
if (!path) throw new Error('Pass a saved MCP element-tree JSON file.');
const result = JSON.parse(readFileSync(path, 'utf8'));
const nodes = [];
const parents = new Map();
function walk(value) {
  if (!value || typeof value !== 'object') return;
  if (value.id?.element && value.type) nodes.push(value);
  for (const child of value.children ?? []) if (child.id) parents.set(child.id.element, value);
  for (const [key, child] of Object.entries(value)) {
    if (key === 'settings' || key === 'attributes') continue;
    if (Array.isArray(child)) child.forEach(walk);
    else if (typeof child === 'object') walk(child);
  }
}
for (const c of result.content ?? []) if (c.type === 'text') walk(JSON.parse(c.text));
const types = {};
for (const node of nodes) types[node.type] = (types[node.type] ?? 0) + 1;
if (types.HtmlEmbed || types.IFrame) throw new Error('Page embeds are not a native migration.');
console.log(JSON.stringify({ nodes: nodes.length, types }));
for (const n of nodes) {
  const a = n.attributes ?? {};
  if (a['data-blbdp-menu-slot'] || a['data-blbdp-action'] === 'prepare' || a['data-blbd-menu']
    || a['data-blbdp-field'] === 'audience' || a['data-blbdp-field'] === 'group'
    || a['data-blbdp-field'] === 'approve' || a['data-blbdp-field'] === 'display-name') {
    const p = parents.get(n.id.element);
    console.log(JSON.stringify({ id: n.id, type: n.type, attributes: a, settings: n.settings,
      parent: p ? { id: p.id, type: p.type, attributes: p.attributes } : null }));
  }
}
