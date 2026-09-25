// Transfer missing blog/category content through the installed Webflow CLI.
// Default is a plan. --apply creates drafts only; existing items are never edited.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, '.secrets', 'webflow-migration');
const cli = process.env.WEBFLOW_CLI_ENTRY || path.join(
  path.dirname(process.execPath), 'node_modules', '@webflow', 'webflow-cli', 'dist', 'index.js',
);
const TARGET = '69b9ae3792be3b49ef7eab96';
const groups = [
  { source: '693b4fcb8a599c12cbf30ef3', target: '69d93290cb9b177142e60b61',
    categories: '693b4fcb8a599c12cbf30f0a', name: 'Blog Categories', slug: 'blog-categories' },
  { source: '693b4fcb8a599c12cbf30f37', target: '69e70443ace388a797f94854',
    categories: '693b4fcb8a599c12cbf30f24', name: 'Blog Categories Premia', slug: 'blog-categories-premium' },
];
// Apparent newer versions already in BLBD BETA. Preserve both source records
// in the private snapshot for editorial comparison; do not duplicate or overwrite.
const overlaps = new Map([
  ['your-life-your-death-how-to-plan-for-freedom-connection-and-a-future-without-regrets', 'your-life-your-death-legacy-planning'],
  ['better-living-is-the-ultimate-act-of-rebellion', 'better-living-act-of-rebellion'],
]);

export async function webflow(args) {
  let stdout;
  try {
    ({ stdout } = await run(process.execPath,
      [cli, ...args, '--json', '--skip-update-check', '--no-input'],
      { cwd: path.dirname(root), windowsHide: true, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 },
    ));
  } catch (error) {
    // Do not dump the entire --data article payload in a child-process error.
    throw new Error(`webflow ${args.slice(0, 3).join(' ')} failed: ${String(error.stderr || error.code).slice(0, 1600)}`);
  }
  const clean = stdout.replace(/\x1b\[[0-9;]*m/g, '').trim();
  if (args.slice(0, 3).join(' ') === 'cms items list' && clean === 'No items found.') return [];
  return JSON.parse(clean);
}

async function items(collection) {
  // CLI 2.2.0 mishandles explicit numeric pagination flags. Its default page
  // is 100; fail closed if any of these small collections ever outgrows it.
  const data = await webflow(['cms', 'items', 'list', '--collection', collection]);
  const page = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(page)) throw new Error('Unexpected CLI item response');
  if (page.length >= 100 || data.total > page.length) throw new Error('Collection needs pagination support');
  return page;
}

const imageHashes = new Map();
async function imageHash(url) {
  if (!imageHashes.has(url)) imageHashes.set(url, (async () => {
    if (new URL(url).protocol !== 'https:') throw new Error('Expected HTTPS image');
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`Verify CMS image: HTTP ${r.status}`);
    return createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
  })());
  return imageHashes.get(url);
}

export async function sameFields(actual, expected, fingerprint = imageHash) {
  // Webflow copies images (including rich-text images) into CMS-owned storage.
  // Compare bytes while retaining exact checks on text, markup, and alt text.
  async function normalizedHtml(html) {
    const pattern = /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi;
    let result = '', end = 0;
    for (const match of html.matchAll(pattern)) {
      result += html.slice(end, match.index) + match[1] + match[2] + await fingerprint(match[3]) + match[2];
      end = match.index + match[0].length;
    }
    return result + html.slice(end);
  }
  for (const [key, value] of Object.entries(expected)) {
    if (value && typeof value === 'object' && value.fileId) {
      if (!actual[key]?.url || (actual[key].alt || '') !== (value.alt || '')) return false;
      if (await fingerprint(actual[key].url) !== await fingerprint(value.url)) return false;
    } else if (key === 'post-body') {
      if (typeof actual[key] !== 'string' || await normalizedHtml(actual[key]) !== await normalizedHtml(value)) return false;
    } else if (JSON.stringify(actual[key]) !== JSON.stringify(value)) return false;
  }
  return true;
}

export function remapImage(value, assets) {
  if (!value) return value;
  const match = assets[value.fileId] || Object.values(assets).find(a => {
    try { return decodeURIComponent(new URL(a.sourceUrl).pathname).split('/').pop()
      === decodeURIComponent(new URL(value.url).pathname).split('/').pop(); }
    catch { return false; }
  });
  if (match?.status !== 'verified') throw new Error(`Unmapped source image: ${value.fileId || value.url}`);
  return { fileId: match.targetId, url: match.targetUrl, alt: value.alt || '' };
}

export function postFields(source, categoryMap, assets) {
  const fields = {};
  for (const key of ['name', 'slug', 'post-body', 'post-summary', 'featured']) {
    if (source[key] != null) fields[key] = source[key];
  }
  if (source['featured-image']) fields['main-image'] = remapImage(source['featured-image'], assets);
  if (source['thumbnail-image']) fields['thumbnail-image'] = remapImage(source['thumbnail-image'], assets);
  if (source.category) {
    fields.category = categoryMap[source.category];
    if (!fields.category) throw new Error(`Unmapped category ${source.category}`);
  }
  // Preserve rich text verbatim except URLs of assets with verified target copies.
  if (fields['post-body']) {
    for (const entry of Object.values(assets).filter(a => a.status === 'verified')) {
      fields['post-body'] = fields['post-body'].split(entry.sourceUrl).join(entry.targetUrl);
    }
  }
  return fields;
}

async function addReference(collection, categories) {
  // CLI fields create has no metadata/collectionId option. This is the only
  // direct API operation; collection/item reads and writes remain CLI commands.
  const authPath = process.env.WEBFLOW_CLI_AUTH_FILE || path.join(process.env.APPDATA, 'webflow', 'auth.json');
  const { accessToken } = JSON.parse(await fs.readFile(authPath, 'utf8'));
  const response = await fetch(`https://api.webflow.com/v2/collections/${collection}/fields`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'Reference', displayName: 'Category',
      isRequired: false, metadata: { collectionId: categories } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Create category reference: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const apply = process.argv.includes('--apply');
  await fs.mkdir(work, { recursive: true });
  const lockPath = path.join(work, 'cms.lock');
  const lock = await fs.open(lockPath, 'wx');
  try {
    const assets = JSON.parse(await fs.readFile(path.join(work, 'assets.json'), 'utf8'));
    const collections = await webflow(['cms', 'collections', 'list', '--site', TARGET]);
    const snapshot = { at: new Date().toISOString(), groups: [] };
    for (const group of groups) {
      const [source, categories, target, schema] = await Promise.all([
        items(group.source), items(group.categories), items(group.target),
        webflow(['cms', 'collections', 'get', group.target]),
      ]);
      const targetCategories = collections.find(c => c.slug === group.slug);
      snapshot.groups.push({ ...group, sourceItems: source, sourceCategories: categories,
        targetItems: target, targetSchema: schema, targetCategories,
        targetCategoryItems: targetCategories ? await items(targetCategories.id) : [] });
      console.log(`INSPECTED ${group.source}: ${source.length} posts, ${categories.length} categories`);
    }
    const snapshotPath = path.join(work, `cms-before-${Date.now()}.json`);
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    const report = { apply, createdPosts: [], createdCategories: [], overlaps: [], existing: [], snapshots: [snapshotPath] };
    const reportPath = path.join(work, 'cms-result.json');
    const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    // Validate every image mapping before any write.
    for (const group of snapshot.groups) for (const item of group.sourceItems) {
      for (const key of ['featured-image', 'thumbnail-image']) if (item.fieldData[key]) remapImage(item.fieldData[key], assets);
    }
    for (const group of snapshot.groups) {
      let categoryCollection = group.targetCategories;
      if (!categoryCollection && apply) {
        categoryCollection = await webflow(['cms', 'collections', 'create', '--site', TARGET,
          '--name', group.name, '--slug', group.slug]);
        console.log(`CREATED collection ${group.name}`);
      }
      const categoryMap = {};
      for (const category of group.sourceCategories) {
        const fields = { name: category.fieldData.name, slug: category.fieldData.slug };
        let match = group.targetCategoryItems.find(c => c.fieldData.slug === fields.slug);
        if (match && !await sameFields(match.fieldData, fields)) throw new Error(`Category conflict: ${fields.slug}`);
        if (!match && apply) {
          match = await webflow(['cms', 'items', 'create', '--collection', categoryCollection.id,
            '--data', JSON.stringify(fields), '--draft']);
          if (!match.isDraft || !await sameFields(match.fieldData, fields)) throw new Error('Category verification failed');
          report.createdCategories.push({ source: category.id, target: match.id, collection: categoryCollection.id });
          await save();
        }
        categoryMap[category.id] = match?.id || `planned:${category.id}`;
      }
      let reference = group.targetSchema.fields.find(f => f.slug === 'category');
      if (reference && (reference.type !== 'Reference' || reference.validations?.collectionId !== categoryCollection?.id)) {
        throw new Error('Destination category field conflicts with migration');
      }
      if (!reference && apply) {
        reference = await addReference(group.target, categoryCollection.id);
        if (reference.slug !== 'category' || reference.type !== 'Reference') throw new Error('Reference field verification failed');
      }
      for (const item of group.sourceItems) {
        const fields = postFields(item.fieldData, categoryMap, assets);
        const overlap = group.targetItems.find(i => i.fieldData.slug === overlaps.get(fields.slug));
        if (overlap) { report.overlaps.push({ source: item.id, target: overlap.id, slug: fields.slug }); continue; }
        const existing = group.targetItems.find(i => i.fieldData.slug === fields.slug);
        if (existing) {
          if (!await sameFields(existing.fieldData, fields)) throw new Error(`Post conflict: ${fields.slug}`);
          report.existing.push(existing.id);
          continue;
        }
        if (apply) {
          const created = await webflow(['cms', 'items', 'create', '--collection', group.target,
            '--data', JSON.stringify(fields), '--draft']);
          const record = { source: item.id, target: created.id, collection: group.target, slug: fields.slug, verified: false };
          report.createdPosts.push(record);
          await save();
          if (!created.isDraft || !await sameFields(created.fieldData, fields)) throw new Error(`Post verification failed: ${fields.slug}`);
          record.verified = true;
          await save();
          console.log(`DRAFT ${fields.slug}`);
        } else console.log(`WOULD CREATE DRAFT ${fields.slug}`);
      }
    }
    await save();
    console.log(JSON.stringify({ apply, posts: report.createdPosts.length,
      categories: report.createdCategories.length, overlaps: report.overlaps.length, existing: report.existing.length }));
  } finally { await lock.close(); await fs.unlink(lockPath); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
