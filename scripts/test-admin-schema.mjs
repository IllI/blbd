// Real PostgreSQL in memory; no network, production database, or email sends.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const db = new PGlite({ extensions: { pgcrypto } });
const q = (sql, args = []) => db.query(sql, args);
const one = async (sql, args) => (await q(sql, args)).rows[0];
let checks = 0;
function ok(value, message) { assert.ok(value, message); checks++; }
async function denied(sql, args = [], pattern = /permission denied|Admins only/) {
  await assert.rejects(q(sql, args), pattern); checks++;
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE ROLE supabase_admin;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text UNIQUE, email_confirmed_at timestamptz, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid, bucket_id text, name text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/') $$;
    CREATE PUBLICATION supabase_realtime;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8'));
  const dan = randomUUID(), kevin = randomUUID(), member = randomUUID(), pending = randomUUID();
  await q('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,$2,now())', [dan, 'dan@blbd.life']);
  await q('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,$2,now())', [member, 'member@example.com']);
  await db.exec(await readFile(new URL('../supabase/migrations/0002_admin_portal.sql', import.meta.url), 'utf8'));
  const jonas = randomUUID();
  await q('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [jonas, 'jonasgoldstein@gmail.com']);
  const jonasMigration = await readFile(new URL('../supabase/migrations/0003_add_jonas_admin.sql', import.meta.url), 'utf8');
  await db.exec(jonasMigration);
  ok(!(await one('SELECT is_admin FROM profiles WHERE id=$1', [jonas])).is_admin, 'Jonas invitation never bypasses mailbox verification');
  await q('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [jonas]);
  ok((await one('SELECT is_admin FROM profiles WHERE id=$1', [jonas])).is_admin, 'Verified Jonas Gmail account claims the exact invitation');
  await q('SELECT admin_set_account($1,$2,$3,$4)', [dan, jonas, 'Jonas', false]);
  await db.exec(jonasMigration);
  ok(!(await one('SELECT is_admin FROM profiles WHERE id=$1', [jonas])).is_admin, 'Reapplying Jonas invitation never restores revoked access');
  ok((await one('SELECT is_admin FROM profiles WHERE id=$1', [dan])).is_admin, 'Backfill grants verified initial admin');
  await q('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [kevin, 'kevin@blbd.life']);
  ok(!(await one('SELECT is_admin FROM profiles WHERE id=$1', [kevin])).is_admin, 'Unverified initial address is not admin');
  await q('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [kevin]);
  ok((await one('SELECT is_admin FROM profiles WHERE id=$1', [kevin])).is_admin, 'Verification claims the one-time invitation');
  await q('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [pending, 'pending@example.com']);
  for (const email of ['contact@blbd.life', 'admin@blbd.life', 'm.blake@blbd.life', 'meghan@blbd.life']) {
    const id = randomUUID();
    await q('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,$2,now())', [id, email]);
    ok((await one('SELECT is_admin FROM profiles WHERE id=$1', [id])).is_admin, `${email} bootstraps on verified signup`);
  }
  const unrelated = randomUUID();
  await q('INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES ($1,$2,now(),$3)', [unrelated, 'other@blbd.life', { is_admin: true }]);
  ok(!(await one('SELECT is_admin FROM profiles WHERE id=$1', [unrelated])).is_admin, 'Same domain and forged metadata do not grant admin');
  await q('SELECT admin_set_account($1,$2,$3,$4)', [dan, kevin, 'Kevin', false]);
  await q('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [kevin]);
  ok(!(await one('SELECT is_admin FROM profiles WHERE id=$1', [kevin])).is_admin, 'Revoked admin is not regranted');
  await denied('SELECT admin_set_account($1,$2,$3,$4)', [kevin, member, 'Escalate', true]);
  await denied('SELECT admin_set_account($1,$2,$3,$4)', [dan, pending, 'Unverified', true], /Verify the user email/);
  await q('SELECT admin_set_account($1,$2,$3,$4)', [dan, member, 'Member', true]);
  ok((await one('SELECT is_admin FROM profiles WHERE id=$1', [member])).is_admin, 'Admins can promote verified users');
  await q('SELECT admin_set_account($1,$2,$3,$4)', [dan, member, 'Member', false]);
  await q('UPDATE profiles SET is_admin=false WHERE id<>$1', [dan]);
  await denied('SELECT admin_set_account($1,$2,$3,$4)', [dan, dan, 'Dan', false], /last verified admin/);

  await db.exec('SET ROLE authenticated');
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)", [member]);
  await q('UPDATE profiles SET is_admin=true WHERE id=$1', [member]);
  ok(!(await one('SELECT is_admin FROM profiles WHERE id=$1', [member])).is_admin, 'Direct client privilege escalation is blocked by original trigger');
  await denied('SELECT admin_set_account($1,$2,$3,$4)', [dan, member, 'Forged actor', true]);
  await denied('SELECT * FROM admin_mail_contacts()');
  await denied('SELECT claim_initial_admin($1)', [member]);
  await denied("INSERT INTO mail_groups(name, emails) VALUES ('bad',ARRAY['member@example.com'])");
  ok((await q('SELECT * FROM mail_campaigns')).rows.length === 0, 'RLS hides admin data from members');
  await db.exec('RESET ROLE');

  await q('INSERT INTO newsletter_subscribers(email,is_confirmed) VALUES ($1,true),($2,true),($3,false)', ['member@example.com', 'subscriber@example.com', 'unconfirmed@example.com']);
  const contacts = (await q('SELECT * FROM admin_mail_contacts()')).rows;
  ok(contacts.filter(c => c.email === 'member@example.com').length === 1, 'Member/subscriber overlap is deduplicated');
  ok(!contacts.some(c => c.email === 'pending@example.com' || c.email === 'unconfirmed@example.com'), 'Unverified and unconfirmed contacts excluded');
  const campaign = (await one('SELECT admin_prepare_mail($1,$2,$3,$4) id', [dan, 'Test subject', 'Safe body', { kind: 'all' }])).id;
  const before = await one('SELECT recipient_count FROM mail_campaigns WHERE id=$1', [campaign]);
  ok(before.recipient_count > 0, 'Campaign has durable audience snapshot');
  ok(!(await one('SELECT admin_claim_mail($1,$2,$3) claimed', [dan, campaign, randomUUID()])).claimed, 'Test required before send');
  await q('UPDATE mail_campaigns SET tested_at=now() WHERE id=$1', [campaign]);
  ok((await one('SELECT admin_claim_mail($1,$2,$3) claimed', [dan, campaign, randomUUID()])).claimed, 'Tested campaign can be claimed');
  ok(!(await one('SELECT admin_claim_mail($1,$2,$3) claimed', [dan, campaign, randomUUID()])).claimed, 'Second concurrent worker cannot claim lease');
  await q("UPDATE mail_campaigns SET lease_until=now()-interval '1 minute', started_at=now()-interval '24 hours' WHERE id=$1", [campaign]);
  ok(!(await one('SELECT admin_claim_mail($1,$2,$3) claimed', [dan, campaign, randomUUID()])).claimed, 'Expired idempotency window blocks automatic replay');
  const pref = await one("SELECT unsubscribe_token FROM mail_preferences WHERE email='member@example.com'");
  await q('SELECT unsubscribe_blbd_updates($1)', [pref.unsubscribe_token]);
  for (const a of [{ kind: 'all' }, { kind: 'members' }, { kind: 'subscribers' }, { kind: 'individuals', emails: ['MEMBER@EXAMPLE.COM', 'subscriber@example.com', 'outsider@example.com'] }]) {
    const recipients = (await q('SELECT * FROM admin_mail_audience($1)', [a])).rows;
    ok(!recipients.some(r => r.email === 'member@example.com' || r.email === 'outsider@example.com'), `Opt-out and unknown address blocked for ${a.kind}`);
  }
  const group = (await one('INSERT INTO mail_groups(name,emails) VALUES ($1,$2) RETURNING id', ['Example', ['member@example.com', 'subscriber@example.com']])).id;
  const groupRecipients = (await q('SELECT * FROM admin_mail_audience($1)', [{ kind: 'group', groupId: group }])).rows;
  ok(groupRecipients.length === 1 && groupRecipients[0].email === 'subscriber@example.com', 'Saved group cannot bypass opt-out');
  await q("UPDATE newsletter_subscribers SET unsubscribed_at=now() WHERE email='subscriber@example.com'");
  ok(!!(await one("SELECT opted_out_at FROM mail_preferences WHERE email='subscriber@example.com'")).opted_out_at, 'Legacy newsletter unsubscribe mirrors global suppression');
  await denied('SELECT * FROM admin_mail_audience($1)', [{ kind: 'invalid' }], /Invalid audience/);
  ok((await one('SELECT count(*)::int n FROM admin_audit')).n >= 8, 'Bootstrap, permission, and campaign actions are audited');
  await db.exec('SET ROLE anon');
  await denied('SELECT * FROM admin_bootstrap');
  await denied('SELECT * FROM admin_mail_contacts()');
  await denied('SELECT unsubscribe_blbd_updates($1)', [pref.unsubscribe_token]);
  await db.exec('RESET ROLE');
  console.log(`Admin PostgreSQL checks passed: ${checks}`);
} finally { await db.close(); }
