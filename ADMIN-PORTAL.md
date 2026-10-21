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

## Provisioned beta environment (2026-10-21)

- Supabase **blbd-beta**: `hfmjvbjyectxiszutwen`, Free plan / Nano, US East.
  Migrations `0001` and `0002` are applied and recorded in
  `supabase_migrations.schema_migrations`. Migration `0003` adds the owner's
  additional one-time invitation for `jonasgoldstein@gmail.com`; verification
  is still required and revoked access is not restored by reapplying it. Production project
  `ihghsacsxvibtwoiyjag` was not migrated or otherwise changed.
- Vercel **Preview / feat/admin-portal** has branch-specific beta URL, anon key,
  service key, environment guard, and beta app/site URLs. Other Preview branches,
  Development, and Production settings were not overwritten.
- Beta admin URL:
  `https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app/admin`.
- The old `blbd-staging.vercel.app` alias is NOT the isolated beta. It pointed
  to the same deployment as `app.blbd.life` at audit time and is deliberately
  unchanged to avoid breaking any existing production consumers.
- No production users, passwords, newsletter contacts, or profile images were
  copied. The six requested initial admin invitations exist, but each admin
  must register/verify a **separate beta account**.
- Local `supabase/.temp` metadata is no longer tracked in git. It previously
  carried a production project link into new worktrees. Explicitly link each
  checkout to its intended project; never infer the target from the branch name.
  This beta worktree is now linked to `hfmjvbjyectxiszutwen`; the original
  checkout's production link was not changed. Use the repo-pinned CLI with
  `npx supabase` (the old global CLI cannot parse PostgreSQL 17 config).
  `npx supabase db push --dry-run` confirms the beta migrations are up to date.
- Auth email confirmation remains required. Google/Facebook login flags are
  disabled in the new beta until provider credentials are configured for it;
  no production provider settings were changed.
- Auth mail can use the signed `/api/auth/send-email` hook, with the Resend key
  kept inside Vercel rather than exported into SMTP configuration. Configure
  `SUPABASE_AUTH_EMAIL_HOOK_SECRET` (Standard Webhooks format) and
  `RESEND_FROM_EMAIL="BLBD Beta <contact@blbd.life>"` in this Preview branch,
  deploy, and verify provider acceptance before enabling the matching HTTP
  Send Email hook in **beta** Supabase. The provider domain must be verified.
  Signatures/timestamps are verified against the raw body; invalid requests,
  non-beta environments, external redirect URLs, and provider errors fail closed.
  Retries use recipient-specific provider idempotency keys. Signup, recovery,
  invitations, magic links, reauthentication and secure email-change token mapping
  are covered by local tests. No tokens, addresses, or provider keys are logged.
  Confirmation remains required; never mark real admin emails verified to bypass it.
- Beta update sending was activated after the owner supplied the physical
  mailing address on 2026-10-21. The address is stored in the branch-specific
  `BLBD_MAIL_POSTAL_ADDRESS` environment variable, and
  `BLBD_ADMIN_MAIL_ENABLED=true` applies ONLY to Preview / feat/admin-portal.
  No production configuration or Google Workspace MX changes were made.
  [Issue #6](https://github.com/IllI/blbd/issues/6) tracks that setup decision.
  `contact@blbd.life` remains the reply-to, not the postal address.
  The auth hook does not send campaigns or grant admin access by itself.

### Draft-to-send workflow

The workspace separates **Write update**, **Saved emails**, and **Contacts &
groups**. Saving selects one draft for review, instead of repeating the full
workflow for every saved campaign down a long page. The audience is shown by
name, with the email preview and a focused send panel side by side (send panel
first on narrow screens). The exact mailing-address blocker is displayed next
to the test result with a link to issue #6, not a direction to scroll elsewhere.
There is no inactive audience-send button when sending is unavailable. Technical
configuration and delivery counts are tucked into optional details. Inbox tests are
allowed for the verified signed-in admin even if group sending is paused
or the postal address is missing. Audience sends still require the postal
address, explicit beta activation, successful test, approval checkbox, and
the server-side reviewed-count/lease/suppression checks. There is no automatic
send after saving/testing. “Copy to new draft” preserves the immutable original
and requires review/testing of the new snapshot. “Send” means email dispatch,
not publication to Webflow or social media.

`scripts/configure-beta-preview.mjs` can reapply the branch-only environment
configuration on this Windows workstation using the existing authenticated CLIs.
It intentionally resets the beta send switch and unconfigured OAuth flags to
false. Keys are obtained from the **beta** project and passed through stdin,
never logged or committed. `scripts/verify-beta-environment.mjs` runs remote
beta integration checks with a temporary fictional QA account and removes its
identity/draft/preferences afterwards; it sends no email.

The default verification run sends no mail, including when beta sending is
enabled: it checks that an untested draft is rejected by the server. Explicit
`node scripts/verify-beta-environment.mjs --mail-sink` sends one own-address
preview to Resend's test sink. Explicit `--group-send` additionally creates a
two-contact sink-only group, independently checks the stored recipient snapshot,
sends the group, verifies both provider acceptances, and checks that replaying
the completed campaign does not resend it. No existing groups, real mailboxes,
or live subscribers are used; all exact synthetic fixtures are removed afterwards.

Provisioning verification passed **13 live beta integration checks**: anonymous
and ordinary-member denial, verified-admin access and page rendering,
cross-origin rejection, disabled-send enforcement, individual audience counting,
durable drafts, non-mutating unsubscribe GET, one-click POST, suppression, and
revocation of an existing session. Temporary QA data was removed afterwards;
the beta database returned to zero accounts/subscribers/campaigns and six
unclaimed initial admin invitations. Only audit records of those fictional tests
remain.

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
4. Enable email confirmation in beta Supabase Auth, configure its signed auth
   email hook (or custom SMTP, but not both as active sending paths),
   and allow the beta backend's `/auth/confirm` redirect. The existing password,
   Google, and Yahoo/Webflow SDK flows are not replaced. Workspace inboxes do
   **not** automatically create BLBD accounts or share their passwords.
5. Sign up/sign in at the beta backend using one of these **exact**, verified
   mailbox addresses: `contact@blbd.life`, `admin@blbd.life`, `dan@blbd.life`,
   `kevin@blbd.life`, `m.blake@blbd.life`, `meghan@blbd.life`, or
   `jonasgoldstein@gmail.com` (migration `0003`). Use
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
# Optional live checks, beta only; requires authenticated Supabase CLI and
# BLBD_ADMIN_MAIL_ENABLED=false in the branch Preview environment:
npm run test:beta
```

Auth-mail tests additionally exercise valid/forged/stale signatures, strict
redirect origins, provider failures, stable idempotency keys and each supported
auth-mail action. A Resend sink acceptance test is not proof of real mailbox
delivery; the admin must still finish signup using their own inbox.

The schema tests use in-memory PostgreSQL (PGlite) and the actual two migrations,
with minimal Supabase auth/storage stand-ins. No remote database or real mail is
used. They exercise bootstrap, verification, forged metadata, revocation, RLS,
last-admin protection, deduplication, suppression, snapshots, leases, audit, and
expired retry windows. Beta integration and inbox tests remain required before
enabling real sends.
