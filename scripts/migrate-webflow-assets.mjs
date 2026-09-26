// BLBD -> BLBD BETA asset migration. Dry-run by default; --apply uploads.
// Reads the existing CLI authorization without printing or copying credentials.
// Existing destination assets are reused only when their bytes match exactly.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SOURCE = '693b4fc98a599c12cbf30e36';
const TARGET = '69b9ae3792be3b49ef7eab96';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, '.secrets', 'webflow-migration');
const statePath = path.join(work, 'assets.json');
const apply = process.argv.includes('--apply');
const authPath = process.env.WEBFLOW_CLI_AUTH_FILE || path.join(
  process.env.APPDATA || path.join(os.homedir(), '.config'), 'webflow', 'auth.json',
);
const { accessToken } = JSON.parse(await fs.readFile(authPath, 'utf8'));
if (!accessToken) throw new Error('Run webflow auth login first.');
await fs.mkdir(work, { recursive: true });
const lock = await fs.open(path.join(work, 'assets.lock'), 'wx');
const hash = (bytes) => createHash('md5').update(bytes).digest('hex');

async function api(route, body) {
  const response = await fetch(`https://api.webflow.com/v2${route}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
  return response.json();
}

async function list(site) {
  const result = [];
  for (let offset = 0; ; offset += 100) {
    const data = await api(`/sites/${site}/assets?limit=100&offset=${offset}`);
    result.push(...data.assets);
    if (result.length >= data.pagination.total) return result;
  }
}

async function bytes(asset) {
  const url = new URL(asset.hostedUrl);
  if (url.protocol !== 'https:') throw new Error('Expected HTTPS asset URL');
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Asset ${asset.id}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const source = await list(SOURCE);
  const target = await list(TARGET);
  await fs.writeFile(path.join(work, 'inventory.json'), JSON.stringify({ source, target }, null, 2));
  let state;
  try { state = JSON.parse(await fs.readFile(statePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = {}; }
  const save = () => fs.writeFile(statePath, JSON.stringify(state, null, 2));
  const byHash = new Map();
  for (const asset of target) byHash.set(hash(await bytes(asset)), asset);
  let copied = 0, reused = 0, pending = 0;
  for (const asset of source) {
    const content = await bytes(asset);
    const fileHash = hash(content);
    const existing = byHash.get(fileHash);
    if (existing) {
      state[asset.id] = { sourceName: asset.displayName, sourceUrl: asset.hostedUrl,
        targetId: existing.id, targetUrl: existing.hostedUrl, fileHash, status: 'verified' };
      await save();
      reused++;
      continue;
    }
    // Fonts require the site's custom-font workflow, not ordinary asset upload.
    if (!/^image\//.test(asset.contentType)) {
      state[asset.id] = { sourceName: asset.displayName, sourceUrl: asset.hostedUrl,
        fileHash, status: 'needs-font-or-file-import' };
      await save();
      console.log(`PENDING ${asset.displayName} (${asset.contentType})`);
      pending++;
      continue;
    }
    if (!apply) { console.log(`WOULD COPY ${asset.displayName}`); pending++; continue; }
    // A saved in-flight upload is reused after a network failure, rather than
    // creating another metadata entry. Upload details stay in the ignored folder.
    let entry = state[asset.id];
    let upload = entry?.status === 'uploading' && entry.fileHash === fileHash ? entry.upload : null;
    if (!upload) {
      upload = await api(`/sites/${TARGET}/assets`, { fileName: asset.displayName, fileHash });
      if (!upload.id || !upload.hostedUrl) throw new Error('Incomplete asset metadata');
      entry = state[asset.id] = { sourceName: asset.displayName, sourceUrl: asset.hostedUrl,
        fileHash, status: 'uploading', upload };
      await save();
    }
    if (upload.uploadUrl && upload.uploadDetails) {
      const form = new FormData();
      for (const [key, value] of Object.entries(upload.uploadDetails)) form.append(key, String(value));
      form.append('file', new Blob([content], { type: asset.contentType }), asset.displayName);
      const response = await fetch(upload.uploadUrl, { method: 'POST', body: form,
        signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`Upload ${asset.displayName}: HTTP ${response.status}`);
    }
    if (hash(await bytes(upload)) !== fileHash) throw new Error(`Verification failed: ${asset.displayName}`);
    state[asset.id] = { sourceName: asset.displayName, sourceUrl: asset.hostedUrl,
      targetId: upload.id, targetUrl: upload.hostedUrl, fileHash, status: 'verified' };
    byHash.set(fileHash, upload);
    await save();
    copied++;
    console.log(`COPIED ${asset.displayName}`);
  }
  console.log(JSON.stringify({ apply, source: source.length, copied, reused, pending, statePath }));
}

try { await main(); }
finally { await lock.close(); await fs.unlink(path.join(work, 'assets.lock')); }
