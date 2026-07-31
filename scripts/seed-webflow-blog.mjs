#!/usr/bin/env node
/**
 * Seed BLBD blog drafts into the Webflow CMS via the v2 Data API.
 *
 * Usage:
 *   WEBFLOW_API_TOKEN=... node scripts/seed-webflow-blog.mjs --discover
 *   WEBFLOW_API_TOKEN=... node scripts/seed-webflow-blog.mjs --dry-run
 *   WEBFLOW_API_TOKEN=... node scripts/seed-webflow-blog.mjs --seed
 *
 * Flags:
 *   --discover   List sites + collections + the chosen collection's fields.
 *                Run this first to confirm the field mapping below.
 *   --dry-run    Show exactly what would be created, create nothing.
 *   --seed       Create the items as DRAFTS (never auto-published).
 *
 * Env:
 *   WEBFLOW_API_TOKEN   (required) Site API token, Content read+write scope.
 *   WEBFLOW_SITE_ID     (optional) Skips site auto-detection.
 *   WEBFLOW_COLLECTION_ID (optional) Skips blog-collection auto-detection.
 *
 * The token grants write access to the CMS — keep it out of git. This script
 * only ever creates DRAFT items, so a bad run is easy to clean up in the
 * Webflow Designer.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = 'https://api.webflow.com/v2';
const token = process.env.WEBFLOW_API_TOKEN;

if (!token) {
  console.error('Set WEBFLOW_API_TOKEN (Webflow → Site Settings → Apps & Integrations → API access).');
  process.exit(1);
}

const mode =
  process.argv.includes('--seed') ? 'seed'
  : process.argv.includes('--dry-run') ? 'dry-run'
  : process.argv.includes('--discover') ? 'discover'
  : null;

if (!mode) {
  console.error('Pass one of: --discover | --dry-run | --seed');
  process.exit(1);
}

async function wf(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept-version': '2.0.0',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Webflow ${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function resolveSiteId() {
  if (process.env.WEBFLOW_SITE_ID) return process.env.WEBFLOW_SITE_ID;
  const { sites } = await wf('/sites');
  if (!sites?.length) throw new Error('No sites on this token.');
  // Prefer a site whose shortName/domain looks like blbd.
  const match =
    sites.find((s) => /blbd/i.test(`${s.shortName} ${s.displayName}`)) ?? sites[0];
  return match.id;
}

async function resolveBlogCollection(siteId) {
  if (process.env.WEBFLOW_COLLECTION_ID) {
    return wf(`/collections/${process.env.WEBFLOW_COLLECTION_ID}`);
  }
  const { collections } = await wf(`/sites/${siteId}/collections`);
  const blog =
    collections.find((c) => /blog|post/i.test(`${c.displayName} ${c.slug}`)) ?? collections[0];
  if (!blog) throw new Error('No collections found on the site.');
  // Fetch full schema (fields).
  return wf(`/collections/${blog.id}`);
}

/**
 * Maps our post JSON onto the collection's actual field slugs. Webflow always
 * has `name` and `slug`; the body/summary field slugs vary by template, so we
 * detect them from the schema.
 */
function buildFieldData(collection, post) {
  const fields = collection.fields ?? [];
  const bySlug = new Map(fields.map((f) => [f.slug, f]));

  const richTextField = fields.find(
    (f) => f.type === 'RichText' && /(post-body|body|content|rich-text)/i.test(f.slug),
  );
  const summaryField = fields.find(
    (f) => (f.type === 'PlainText' || f.type === 'RichText') && /(summary|excerpt|intro|subtitle)/i.test(f.slug),
  );

  const data = { name: post.name, slug: post.slug };

  if (richTextField) {
    data[richTextField.slug] = markdownToHtml(post.bodyMarkdown);
  } else {
    console.warn(`  ! No rich-text body field detected in "${collection.displayName}". Body skipped for ${post.slug}.`);
  }

  if (summaryField && post.summary) {
    data[summaryField.slug] =
      summaryField.type === 'RichText' ? `<p>${escapeHtml(post.summary)}</p>` : post.summary;
  }

  // Surface unknown-but-required fields so the user can extend the mapping.
  const requiredMissing = fields.filter(
    (f) => f.isRequired && !['name', 'slug'].includes(f.slug) && !(f.slug in data),
  );
  if (requiredMissing.length) {
    console.warn(
      `  ! Required fields not populated for ${post.slug}: ${requiredMissing.map((f) => f.slug).join(', ')}`,
    );
  }

  void bySlug;
  return data;
}

/** Deliberately minimal markdown → HTML for CMS rich text. */
function markdownToHtml(md) {
  const blocks = md.trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const h = block.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        const level = h[1].length + 1; // ## → h3, keeps h1 for the post title
        return `<h${level}>${inline(h[2])}</h${level}>`;
      }
      if (block.startsWith('> ')) {
        return `<blockquote><p>${inline(block.replace(/^>\s?/gm, ''))}</p></blockquote>`;
      }
      if (/^[-*]\s+/m.test(block)) {
        const items = block
          .split('\n')
          .filter((l) => /^[-*]\s+/.test(l))
          .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(block.replace(/\n/g, '<br>'))}</p>`;
    })
    .join('');
}

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
  const siteId = await resolveSiteId();
  const collection = await resolveBlogCollection(siteId);

  if (mode === 'discover') {
    console.log(`Site:       ${siteId}`);
    console.log(`Collection: ${collection.displayName} (${collection.id})`);
    console.log('Fields:');
    for (const f of collection.fields ?? []) {
      console.log(`  - ${f.slug.padEnd(24)} ${f.type}${f.isRequired ? '  [required]' : ''}`);
    }
    console.log('\nLooks right? Re-run with --dry-run, then --seed.');
    return;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const posts = JSON.parse(await readFile(join(here, 'blog-posts.json'), 'utf8'));

  console.log(`Collection: ${collection.displayName} (${collection.id})`);
  console.log(`${posts.length} draft posts from blog-posts.json\n`);

  for (const post of posts) {
    const fieldData = buildFieldData(collection, post);

    if (mode === 'dry-run') {
      console.log(`[dry-run] would create: ${post.name}`);
      console.log(`          slug: ${fieldData.slug}`);
      console.log(`          fields: ${Object.keys(fieldData).join(', ')}\n`);
      continue;
    }

    // isDraft: true → created but not published. Never auto-publishes.
    await wf(`/collections/${collection.id}/items`, {
      method: 'POST',
      body: JSON.stringify({ isArchived: false, isDraft: true, fieldData }),
    });
    console.log(`✓ created draft: ${post.name}`);
  }

  if (mode === 'seed') {
    console.log('\nDone. Review and publish the drafts in the Webflow Designer.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
