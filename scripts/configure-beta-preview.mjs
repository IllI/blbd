// Configure this feature's Vercel Preview branch only. No production writes.
// Keys travel in memory/stdin, never command-line arguments or console output.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const projectRef = 'hfmjvbjyectxiszutwen';
const branch = 'feat/admin-portal';
const project = 'blbd';
const origin = 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app';
assert.notEqual(projectRef, 'ihghsacsxvibtwoiyjag');
const supabaseCli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const keys = JSON.parse(execFileSync(process.execPath, [supabaseCli,
  'projects', 'api-keys', '--project-ref', projectRef, '--output', 'json',
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const anon = keys.find(k => k.name === 'anon')?.api_key;
const service = keys.find(k => k.name === 'service_role')?.api_key;
assert.ok(anon && service, 'Beta API keys are required');
for (const token of [anon, service]) {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(claims.ref, projectRef, 'Refusing a key from another project');
}
const values = {
  BLBD_ADMIN_ENVIRONMENT: 'beta', BLBD_BETA_SUPABASE_PROJECT_REF: projectRef,
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service,
  NEXT_PUBLIC_APP_URL: origin, NEXT_PUBLIC_SITE_URL: 'https://blbd.webflow.io',
  BLBD_ADMIN_MAIL_ENABLED: 'false', NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH: 'false',
  NEXT_PUBLIC_ENABLE_FACEBOOK_OAUTH: 'false',
};
const privateKeys = new Set(['SUPABASE_SERVICE_ROLE_KEY']);
for (const [key, value] of Object.entries(values)) {
  try {
    execFileSync(process.execPath, ['C:/Program Files/nodejs/node_modules/vercel/dist/vc.js',
      'env', 'add', key, 'preview', branch, '--project', project, '--force', '--yes',
      privateKeys.has(key) ? '--sensitive' : '--no-sensitive',
    ], { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`Configured ${key} for Preview/${branch}`);
  } catch { throw new Error(`Could not configure ${key}; no secret values were logged`); }
}
console.log('Beta preview configuration complete; sending remains OFF.');
