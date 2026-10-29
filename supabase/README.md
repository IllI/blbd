# Supabase schema notes

New workstation setup does **not** apply migrations or copy production data.
See [../SETUP.md](../SETUP.md) and [../ENVIRONMENTS.md](../ENVIRONMENTS.md).
Beta is `hfmjvbjyectxiszutwen`; production is `ihghsacsxvibtwoiyjag`.
Use the repo-pinned `npx supabase` for approved database work; a new clone
has no inherited project link. Verify the target ref before any remote write.

Migrations: `0001_init.sql` defines the base member schema/RLS;
`0002_admin_portal.sql` adds admin access and controlled mail operations;
`0003_add_jonas_admin.sql` defines Jonas's additional one-time beta invitation.
A maintainer checks which migrations are applied; cloning does not apply them.
Verified signup is still required, and rerunning onboarding must not restore
a revoked grant. See [../ADMIN-PORTAL.md](../ADMIN-PORTAL.md).

The following base-schema decisions explain the implementation. The original
handoff spec predates the current beta architecture and is not a prerequisite
file outside this clone.

## RLS recursion avoided
A policy on `profiles` that runs `SELECT ... FROM profiles` (as the original
`WITH CHECK` subquery did) trips Postgres' infinite-recursion guard at runtime.
Instead:
- `profiles` UPDATE is a simple `auth.uid() = id` check.
- Privileged columns (`is_admin`, `membership_tier`, `stripe_*`) are reverted
  by the `protect_profile_columns` BEFORE trigger unless the caller is the
  service role. Members can send the whole row; the server owns those fields.

## Tier gating is enforced in the database
Clients hit PostgREST directly, so UI-only gating is not a control. Therefore:
- **Comments**: the INSERT policy requires `has_paid_tier()`.
- **Goals**: `enforce_goal_tier_limit()` caps free accounts at 2 slots per
  category and paid accounts at 5.

`current_tier()`, `is_admin()`, and `has_paid_tier()` are `SECURITY DEFINER`
helpers that read `profiles` without re-entering its RLS, so policies on other
tables can call them safely.

## Comment depth
`enforce_comment_depth()` keeps replies exactly one level deep (a reply's
parent must itself be top-level).

## Reordering goals
`goals` has a **deferrable** unique constraint on `(user_id, category,
position)`. Swapping two goals' positions must happen in one statement (the app
uses a single `upsert`) so the transient duplicate is allowed until commit.

## Newsletter
- `confirmation_token` is single-use and nulled on confirm.
- `unsubscribe_token` is stable so every send can carry a working one-click
  unsubscribe link.
- There is **no** anon INSERT policy — subscribing goes through the
  service-role API route so it can rate-limit and send the confirmation email.

## Storage
`avatars` bucket is public-read, 2 MB limit, images only. Objects live at
`{user_id}/avatar.{ext}`; the storage policies check the first path segment
against `auth.uid()`.

## Regenerating types
After any schema change, keep `src/lib/supabase/database.types.ts` in sync:
```bash
npx supabase gen types typescript --project-id hfmjvbjyectxiszutwen > src/lib/supabase/database.types.ts
```

Row types **must** be `type` aliases (not `interface`) or Postgrest's generics
degrade table types to `never`. The generator already emits type aliases.
