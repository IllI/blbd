# Guest homepage and avatar incident

Migration writes are paused pending resolution and functional verification.

Recovery was authorized by the owner. The Management API accepted a resume
request for the existing project; it is now `ACTIVE_HEALTHY`.
Vercel CLI needs a fresh account login before the isolated SDK deployment.
Do not confuse the passing PR preview deployment with the live SDK alias.

## Confirmed guest homepage defect

The published homepage stays at `/`, with its content still in the DOM, but
`<html data-blbd-auth="guest" data-blbd-tier="free">` receives
`display: none !important`. This looks like a reload into a blank page.

`applyState()` stamps tier state on the document root, then selects that same
root as `[data-blbd-tier]` restricted content. The guest tier check hides it.
Live `/blbd.js` matched the repository version before this fix. Git blame
identifies the early root-state stamping in commit `9ce42220`, before the
September migration.

The fix excludes only `document.documentElement` from content gating. Actual
member-only and tier-restricted elements retain their existing checks. The
root state remains available to CSS. Frozen SDK versions are unchanged.

Validation: `node --test scripts/test-sdk-state.mjs` passes four guest/free/
supporter/member cases, including repeated state application and content gates.
`node --check public/blbd.js` and `npm run build` pass (existing unused Alert
import warning). The fix has not been deployed or verified live yet.

## Backend outage and profile images

Read-only `supabase projects list --output json` reports the linked BLBD
project `ihghsacsxvibtwoiyjag` as `INACTIVE`. Both Node fetch and Windows DNS
lookup fail to resolve its configured `*.supabase.co` hostname. Profile and
avatar storage requests cannot succeed at that endpoint. No profile records
or stored images could be inspected during the outage.

After recovery, profile records are readable and the existing stored avatar
returns HTTP 200 with PNG content. Auth health also returns HTTP 200. Public
auth settings allow email signup with confirmation, but list only email as
enabled: Google/Yahoo flows are not currently configured as enabled providers.
End-to-end signed-in browser testing remains outstanding.

No migration operation modified Supabase, authentication configuration, or
SDK code before this incident investigation. No Webflow publication occurred.

## Required recovery checks

- Restore/resume the existing Supabase project with the owner's approval;
  do not create a replacement project or reset the database.
- Check existing profile avatar URLs and storage object responses after resume.
- Deploy the isolated SDK fix with approval; no Webflow publication is needed
  while the live site uses the unversioned SDK URL.
- Verify guest home, login/signup, member redirects, Google/Yahoo requirements,
  avatar rendering and member functionality against the restored backend.
- Keep migration PR #3 in draft until the functional checks pass.
