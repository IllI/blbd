// CMS image fields may reference files absent from the site's asset list.
// Discover them from the CMS snapshot, then upload through the Webflow CLI.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { webflow } from './migrate-webflow-cms.mjs';

const work = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.secrets/webflow-migration');
const apply = process.argv.includes('--apply');
const files = (await fs.readdir(work)).filter(f => /^cms-before-\d+\.json$/.test(f)).sort();
if (!files.length) throw new Error('Run the CMS planner first to capture source items.');
const snapshot = JSON.parse(await fs.readFile(path.join(work, files.at(-1)), 'utf8'));
const mappingPath = path.join(work, 'assets.json');
const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
const hash = b => createHash('md5').update(b).digest('hex');
async function download(url) {
  if (new URL(url).protocol !== 'https:') throw new Error('Expected HTTPS asset URL');
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Image download: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const lockPath = path.join(work, 'assets.lock');
const lock = await fs.open(lockPath, 'wx');
try {
  const images = new Map();
  for (const group of snapshot.groups) for (const item of group.sourceItems) {
    for (const key of ['thumbnail-image', 'featured-image']) {
      const image = item.fieldData[key];
      if (image) images.set(image.fileId, image);
    }
  }
  let copied = 0, reused = 0, planned = 0;
  for (const [id, image] of images) {
    const data = await download(image.url);
    const fileHash = hash(data);
    const existing = Object.values(mapping).find(a => a.status === 'verified' && a.fileHash === fileHash);
    let targetId, targetUrl;
    if (existing) {
      if (hash(await download(existing.targetUrl)) !== fileHash) throw new Error('Existing image changed');
      ({ targetId, targetUrl } = existing);
      reused++;
    } else {
      let name = decodeURIComponent(new URL(image.url).pathname.split('/').pop());
      name = name.replace(/^(?:[a-f0-9]{24}_)+/i, '').replace(/%20/g, ' ').replace(/[^a-zA-Z0-9 ._-]/g, '_');
      if (name.length > 99) name = `${id}${path.extname(name)}`;
      const file = path.join(work, `${id}-${name}`);
      await fs.writeFile(file, data);
      if (!apply) { console.log(`WOULD UPLOAD ${name}`); planned++; continue; }
      const result = await webflow(['assets', 'upload', file, '--site', '69b9ae3792be3b49ef7eab96', '--name', name]);
      targetId = result.id;
      targetUrl = result.hostedUrl;
      if (!targetId || !targetUrl) throw new Error('Unexpected CLI asset response; inspect before retry');
      if (hash(await download(targetUrl)) !== fileHash) throw new Error('Uploaded image verification failed');
      console.log(`COPIED CMS IMAGE ${name}`);
      copied++;
    }
    mapping[id] = { sourceName: image.url.split('/').pop(), sourceUrl: image.url,
      targetId, targetUrl, fileHash, status: 'verified' };
    await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));
  }
  console.log(JSON.stringify({ apply, images: images.size, copied, reused, planned }));
} finally { await lock.close(); await fs.unlink(lockPath); }
