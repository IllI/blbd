// One-off: confirm the pushed schema is queryable over REST.
// Usage: node scripts/verify-schema.mjs   (reads .env.local)
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  (await readFile(new URL('../.env.local', import.meta.url), 'utf8'))
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const tables = ['profiles', 'goals', 'blog_comments', 'newsletter_subscribers', 'membership_events'];
let ok = true;

for (const t of tables) {
  const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true });
  if (error) {
    console.log(`✗ ${t}: ${error.message}`);
    ok = false;
  } else {
    console.log(`✓ ${t} (rows: ${count ?? 0})`);
  }
}

const { data: buckets, error: bErr } = await admin.storage.listBuckets();
if (bErr) {
  console.log(`✗ storage: ${bErr.message}`);
  ok = false;
} else {
  const avatars = buckets.find((b) => b.id === 'avatars');
  console.log(avatars ? `✓ avatars bucket (public: ${avatars.public})` : '✗ avatars bucket MISSING');
  if (!avatars) ok = false;
}

console.log(ok ? '\nAll checks passed.' : '\nSome checks failed.');
process.exit(ok ? 0 : 1);
