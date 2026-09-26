// Custom fonts have no command in Webflow CLI 2.2.0. Use the documented
// custom_fonts API with the existing CLI authorization; never publish.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const work = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.secrets/webflow-migration');
const authPath = process.env.WEBFLOW_CLI_AUTH_FILE || path.join(process.env.APPDATA, 'webflow', 'auth.json');
const { accessToken } = JSON.parse(await fs.readFile(authPath, 'utf8'));
const SOURCE = '693b4fc98a599c12cbf30e36', TARGET = '69b9ae3792be3b49ef7eab96';
const apply = process.argv.includes('--apply');
const hash = b => createHash('md5').update(b).digest('hex');
async function api(site, body) {
  const r = await fetch(`https://api.webflow.com/v2/sites/${site}/custom_fonts`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`Font API: HTTP ${r.status}`);
  return r.json();
}
async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Font download: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
await fs.mkdir(work, { recursive: true });
const lockPath = path.join(work, 'fonts.lock');
const lock = await fs.open(lockPath, 'wx');
try {
  const source = await api(SOURCE), target = await api(TARGET);
  if (source.pagination.total > source.customFonts.length || target.pagination.total > target.customFonts.length) {
    throw new Error('Font listing needs pagination');
  }
  const report = [];
  for (const font of source.customFonts) {
    const data = await download(font.hostedUrl);
    const fileHash = hash(data);
    const existing = target.customFonts.find(f => f.fontFamily === font.fontFamily && f.weight === font.weight && f.italic === font.italic);
    if (existing) {
      if (hash(await download(existing.hostedUrl)) !== fileHash) throw new Error('Destination font conflict');
      console.log(`VERIFIED existing ${font.fontFamily} ${font.weight}`);
      report.push({ source: font.id, target: existing.id, fileHash });
      continue;
    }
    if (!apply) { console.log(`WOULD COPY ${font.fontFamily} ${font.weight}`); continue; }
    const result = await api(TARGET, { fileName: font.fileName.replace(/^[a-f0-9]{24}_/, ''),
      fileHash, fontFamily: font.fontFamily, weight: font.weight, italic: font.italic,
      fontDisplay: font.fontDisplay, axes: font.axes });
    // Save in-flight metadata privately before upload. Inspect it rather than
    // blindly retrying creation if the upload is interrupted.
    await fs.writeFile(path.join(work, `font-upload-${font.id}.json`), JSON.stringify(result, null, 2));
    const form = new FormData();
    for (const [key, value] of Object.entries(result.upload.fields)) form.append(key, String(value));
    form.append('file', new Blob([data]), result.customFont.fileName);
    const upload = await fetch(result.upload.url, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
    if (!upload.ok) throw new Error(`Font upload: HTTP ${upload.status}`);
    if (hash(await download(result.customFont.hostedUrl)) !== fileHash) throw new Error('Font content verification failed');
    report.push({ source: font.id, target: result.customFont.id, fileHash });
    await fs.writeFile(path.join(work, 'fonts-result.json'), JSON.stringify(report, null, 2));
    console.log(`COPIED AND VERIFIED ${font.fontFamily} ${font.weight}`);
  }
  if (apply) await fs.writeFile(path.join(work, 'fonts-result.json'), JSON.stringify(report, null, 2));
} finally { await lock.close(); await fs.unlink(lockPath); }
