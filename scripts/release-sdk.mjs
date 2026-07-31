#!/usr/bin/env node
// Cuts a frozen, pinned copy of public/blbd.js to public/vN/blbd.js.
//
// The bare /blbd.js is the "edge" copy — whatever is on the branch right
// now, useful for our own testing but never safe to point a real Webflow
// production install at, since an in-progress edit reaches it immediately.
//
// A versioned release is a deliberate, one-time snapshot: once cut, that
// path's content is frozen (see the immutable Cache-Control in
// next.config.ts) and Webflow sites should point at it instead. Cutting a
// new version is how a breaking change ships without touching sites already
// pinned to an older one.
//
// Usage:
//   node scripts/release-sdk.mjs v1
//   node scripts/release-sdk.mjs v2
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const version = process.argv[2];
if (!version || !/^v\d+$/.test(version)) {
  console.error('Usage: node scripts/release-sdk.mjs v<N>   (e.g. v1, v2)');
  process.exit(1);
}

const source = join(root, 'public', 'blbd.js');
const targetDir = join(root, 'public', version);
const target = join(targetDir, 'blbd.js');

if (existsSync(target)) {
  console.error(
    `public/${version}/blbd.js already exists and is frozen. Cut the next version instead — ` +
      `never overwrite a version that may already be live on a Webflow site.`,
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
writeFileSync(target, readFileSync(source, 'utf8'));

console.log(`Released public/${version}/blbd.js from the current public/blbd.js.`);
console.log(`Next: commit, deploy, then verify https://blbd-life.vercel.app/${version}/blbd.js`);
console.log(`before pointing any Webflow site's footer code at it.`);
