# BLBD administration — beta implementation

## Environment boundary (confirmed 2026-10-21)

| Environment | Webflow project | Immutable site ID | Public host |
| --- | --- | --- | --- |
| Production — DO NOT EDIT/PUBLISH for this feature | BLBD (formerly BLBD BETA) | `69b9ae3792be3b49ef7eab96` | `blbd.life` |
| Beta / development | BLBD BETA (formerly BLBD) | `693b4fc98a599c12cbf30e36` | `blbd.webflow.io` |

This feature changes the **backend's internal admin UI**, not public marketing
pages or Webflow custom code. There are no Webflow publishes or production
database changes in this PR. A Vercel preview is NOT automatically a safe beta:
it must use its own Supabase project and keys, not the shared production project
`ihghsacsxvibtwoiyjag`. The admin guards explicitly reject that project.

Do not merge/deploy this feature to production as a shortcut to testing it.
Production rollout requires a separately reviewed environment-policy change.

## First beta rollout

1. Create/identify an **isolated beta Supabase project**. Do not clone production
   subscriber addresses into a test audience. Use synthetic contacts and inboxes
   that the testing team owns.
2. Apply `supabase/migrations/0001_init.sql` and then
   `supabase/migrations/0002_admin_portal.sql` to that beta project. For an
   existing beta database, apply only migrations not already recorded. Review
   `supabase/README.md`; do not run a linked `db push` without checking its ref.
3. Configure a beta-only Vercel preview environment (or local `.env.local`):

   ```dotenv
   BLBD_ADMIN_ENVIRONMENT=beta
   BLBD_BETA_SUPABASE_PROJECT_REF=YOUR_ISOLATED_BETA_PROJECT_REF
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_ISOLATED_BETA_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_BETA_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_BETA_SERVICE_ROLE_KEY
   NEXT_PUBLIC_APP_URL=https://YOUR_BETA_BACKEND_HOST
   NEXT_PUBLIC_SITE_URL=https://blbd.webflow.io
   BLBD_ADMIN_MAIL_ENABLED=false
   RESEND_API_KEY=YOUR_SERVER_ONLY_RESEND_KEY
   RESEND_FROM_EMAIL="BLBD <contact@blbd.life>"
   BLBD_MAIL_POSTAL_ADDRESS=YOUR_ORGANIZATION_MAILING_ADDRESS
   ```

   Set secrets through the deployment's secret manager, never in git/chat.
   `NEXT_PUBLIC_*` changes require rebuilding. No credentials are included here.
4. Enable email confirmation in beta Supabase Auth, configure its auth mailer,
   and allow the beta backend's `/auth/confirm` redirect. The existing password,
   Google, and Yahoo/Webflow SDK flows are not replaced. Workspace inboxes do
   **not** automatically create BLBD accounts or share their passwords.
5. Sign up/sign in at the beta backend using one of these **exact**, verified
   mailbox addresses: `contact@blbd.life`, `admin@blbd.life`, `dan@blbd.life`,
   `kevin@blbd.life`, `m.blake@blbd.life`, `meghan@blbd.life`. Use
   `/login?next=/admin` or `/signup?next=/admin`. Existing verified accounts get
   the initial grant during migration; new accounts get it on verification.
6. Open `/admin`. Test non-admin denial, grants/revocation, last-admin protection,
   and audience selection. The existing profile security trigger still blocks
   client-side `is_admin`/billing edits.
7. Only when beta recipients are safe and the sender domain is verified in
   Resend, explicitly set `BLBD_ADMIN_MAIL_ENABLED=true` in **beta**. Configure
   required sending DNS without replacing Google's inbound MX records.
8. Prepare a draft, review the frozen count/message, send a test to yourself,
   check it in your inbox, then approve the small test audience send. Verify
   opt-out, pause/resume, and provider failures. Never broadcast to real users as
   an automated test. Nothing in this PR creates a Workspace mailing group.

## Included in this increment

- `/admin`: initial-access status, recent audit history, sending status.
- `/admin/accounts`: paginated account list, display-name edits, admin grant /
  revoke. All admins currently have the same full admin permission. No deletion,
  password disclosure, impersonation, or manual billing-tier changes.
- `/admin/newsletter`: plain-text composition, individuals, saved groups,
  verified members (including free accounts), confirmed subscribers, or a
  deduplicated union. Contacts can be searched and paginated; group creation
  only accepts eligible, known contacts, not arbitrary pasted email lists.
- Immutable campaign snapshots, own-address tests, explicit send confirmation,
  bounded batches of 25, pause/resume, and accepted/pending/skipped counts.
- Per-recipient delivery with no visible recipient list, unsubscribe footer and
  one-click headers. Provider rejection is never reported as successful sending.
- Service-role-only RPCs, verified server sessions, same-origin mutation checks,
  read restrictions, audit entries, transaction-serialized last-admin protection.

The six initial grants are **one-time invitations**, not a permanent override:
revocation survives future sign-ins, and other `@blbd.life` addresses do not
automatically become admins. A deleted initial account does not automatically
reclaim a grant by registering again.

## Mail semantics and limits

- A verified portal account is considered a member audience contact. Only send
  member-related updates appropriate to that relationship; do not infer marketing
  consent merely from an account. Subscriber audiences require confirmation.
- Any newsletter unsubscribe or global update opt-out suppresses **all** update
  audiences, including manually selected individuals and saved groups. Auth /
  security mail is separate. There is no admin opt-out bypass.
- Suppression is rechecked during sending. Pending/removed contacts are skipped.
  An opt-out does not recall an email already accepted by the provider.
- The subscriber source is `newsletter_subscribers` in the isolated database.
  **Webflow Forms records are not automatically imported.** A consent-aware sync
  from the live form is a separate rollout item; do not silently label those
  submissions confirmed, or point beta at production to fetch them.
- Campaign creation freezes up to 10,000 recipients. Individual/group selections
  support up to 1,000 contacts. The UI shows the 30 most recent campaigns and
  100 most recent groups. These explicit limits can be expanded later.
- "Accepted" means API acceptance, not delivery/open tracking. Delivery webhooks,
  bounce/complaint processing, scheduling, attachments, group editing, granular
  staff roles, and social publishing are future increments.
- Every message has a stable campaign/recipient idempotency key. A 90-second
  lease prevents concurrent campaign workers. Automatic resume is refused after
  23 hours because provider deduplication expires after 24 hours. Review provider
  records for old interrupted campaigns; **do not duplicate them blindly**.
- If the browser closes or Pause is clicked, the current bounded batch may finish.
  Reopen the same campaign to resume; do not create another draft to retry.
- Templates/configuration should remain unchanged during a campaign's retry
  window; provider idempotency rejects changed payloads for an existing key.
- Resubscription after a global opt-out needs a future explicit verified opt-in
  flow. It is not reset by an admin grant or by joining a group.

The legacy `/api/newsletter/send` endpoint now returns 410 for admins rather
than bypassing these protections. The composer uses `/api/admin/mail` instead.

## Local verification

```sh
npm ci
npm run test:admin
npm run build
```

The schema tests use in-memory PostgreSQL (PGlite) and the actual two migrations,
with minimal Supabase auth/storage stand-ins. No remote database or real mail is
used. They exercise bootstrap, verification, forged metadata, revocation, RLS,
last-admin protection, deduplication, suppression, snapshots, leases, audit, and
expired retry windows. Beta integration and inbox tests remain required before
enabling real sends.
