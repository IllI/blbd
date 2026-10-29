# BLBD — context for Claude sessions

Current direction: **2026-10-29**. Read this before changing code, configuring
a workstation, or using remote tools.

## Start every fresh workstation/session here

Read [AGENTS.md](AGENTS.md), [SKILLS.md](SKILLS.md),
[ENVIRONMENTS.md](ENVIRONMENTS.md), [ONBOARDING.md](ONBOARDING.md),
[MCP.md](MCP.md), [DESIGN.md](DESIGN.md), and [SETUP.md](SETUP.md).
Load these files explicitly; do not assume arbitrary Markdown is auto-loaded.
Instructions must work from a fresh clone, without the owner's machine,
personal memory, existing CLIs, credentials, or previous session approvals.

For Jonas's onboarding, inspect the OS, repo root, branch and available tools.
Install locked dependencies, create the example env only if absent, verify
MCPs with read-only requests, and report missing invitations/configuration
without displaying secrets. Start and check the local app; distinguish
placeholder layout/build checks from authenticated beta verification.

## Product boundary

Jonas is joining BLBD to help design the beta site in **Figma**. Public website
and CMS work currently stays in **Webflow**. The **member/admin portal stays
in Next.js on Vercel**. Design portal screens under `src/app/` and
`src/components/`; do not duplicate public marketing pages there.

Older instructions saying every page design belongs in Webflow, that React
portal pages are only a test harness, or that members never change domains
are superseded. The native Webflow portal drafts remain as historical
artifacts; do not extend or publish that migration. Preserve deployed SDK and
native auth behavior until a separately reviewed integration change replaces it.

[ENVIRONMENTS.md](ENVIRONMENTS.md) is the canonical environment map:
beta Webflow `693b4fc98a599c12cbf30e36` at `blbd.webflow.io`;
beta Supabase `hfmjvbjyectxiszutwen`; Vercel `blbd` /
`illi1s-projects`, **Preview / `feat/admin-portal`**.
The current beta portal is
`https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app`.
`blbd-staging.vercel.app` is a legacy production alias, never a beta target.

Beta settings are branch-specific. Before using a new feature-branch preview,
verify its own database/env settings; Preview does not automatically mean beta.
Production uses Webflow `69b9ae3792be3b49ef7eab96` / `blbd.life`,
Supabase `ihghsacsxvibtwoiyjag`, and the Vercel Production target.

## Connections and credentials

[.mcp.json](.mcp.json) supplies the official remote **Figma, Webflow and Vercel**
server definitions. OAuth and team/site/file invitations are per person.
Read [MCP.md](MCP.md); don't mistake a configured server or public docs search
for authenticated access. Use the local Code session/CLI for repo work;
ordinary desktop chat needs explicit files and its own working connectors.

For Webflow, discover the current tools and call `webflow_guide_tool` first.
Use its requirements for headless Data operations versus Designer/Bridge
operations; don't assume a live Designer is always unnecessary. Confirm the
immutable beta site ID before each mutation. On expired OAuth, have Jonas
reconnect interactively, without sharing tokens/codes.

Cloning does not create `.env.local`. Copy the tracked example only if absent.
Dummy values support preparation, not real auth/data. Use beta values for
functional QA. Keep service-role, Webflow API, Stripe and Resend secrets on the
server, never in Figma, Webflow browser code, commits, logs or chat.
Do not transfer the owner's `.vercel`, Supabase link metadata, or personal
Claude settings into another workstation. MCP login and CLI login are separate.

## Development and review

- Use `npm ci` and the lockfile. Node.js 22 LTS is the recommended baseline.
- Run `npm run build` before a commit. Run the appropriate existing tests
  for behavioral changes; there are local admin, native, social and password
  test commands in `package.json`. Don't claim there is no test suite.
- Start a personal branch from `feat/admin-portal` and target that beta branch
  for review until the beta changes are merged.
- Use Figma frame/node context, existing components, CSS tokens and responsive
  states. See [DESIGN.md](DESIGN.md); don't blindly paste generated React into
  Webflow or create a replacement app.
- Local setup does not run remote migrations, create projects, grant roles,
  change shared env, send mail, publish sites, or deploy production.
- Obtain explicit release authorization before Webflow publication (whole-site
  changes may include other teammates' drafts), `vercel --prod`, production
  env/DNS/alias changes, or unprompted pushes/merges to `main`.
  Approval from an older session is not a standing release permission.

## Implementation map and invariants

- `src/app/(portal)/` and `src/app/admin/` contain Vercel portal screens.
  Inspect the actual route tree before editing.
- `src/app/page.tsx` is a service status/install page; signed-in users go to
  `/dashboard`. It is not the public marketing homepage. Its status badges
  reflect config presence, not successful remote service checks.
- `src/app/globals.css`, `src/components/` — shared design and UI.
- `src/app/api/` — server APIs. `src/lib/admin/` — beta-only admin isolation,
  authorization, mail policy and exact-origin transport.
- `supabase/migrations/` — schema, RLS and triggers. Read
  [supabase/README.md](supabase/README.md) before database work.
- `public/blbd.js` — existing browser SDK; config comes from script `data-*`
  attributes, not env files. Preserve native Webflow, Memberstack and generic
  `data-blbd-form` conventions. Search every hardcoded path when changing CFG.
- `public/vN/blbd.js` — immutable releases, cut with
  `node scripts/release-sdk.mjs vN`. Never hand-edit a frozen version.
  Verify the target site's actual loader rather than assuming pinned/edge.
- `webflow/` — SDK install/attribute references.
  `webflow/portal-migration/` and `public/blbd-portal.js` record the superseded
  native portal experiment; existing auth consumers still need regression care.
- [ADMIN-PORTAL.md](ADMIN-PORTAL.md) — beta access and operational controls.
  Mail sending was enabled on shared beta; new local setups keep it off.

Security belongs in Postgres RLS/triggers and verified server authorization.
UI gating is only a convenience. Never weaken CSRF/CORS, verified-email
requirements, admin revocation or last-admin protection for a visual change.
Never send real audience mail as a setup or automated design test.

## Known implementation gotchas

- Client env vars must remain literal `process.env.NEXT_PUBLIC_FOO`
  references. Dynamic lookup isn't inlined. Rebuild/restart after changing them.
- Supabase implicit auth returns tokens in URL fragments; preserve the current
  client handling and the explicitly supported PKCE paths. Do not replace one
  with an unverified server-only callback assumption.
- The signed beta auth-mail hook accepts only its configured HTTPS app origin.
  Register/verify/recover on the shared beta portal, then sign in locally with
  that verified account. A Supabase localhost redirect entry alone does not
  enable local signup/recovery mail; don't weaken the hook to make it work.
- Webflow SDK sessions use localStorage on the Webflow origin. Vercel portal
  sessions use first-party cookies; do not assume cross-domain session sharing.
- Public API CORS and beta admin bearer CORS have different policies. Admin
  transport accepts only its explicit beta origin and verified current role;
  cross-origin cookies and a client-provided `is_admin` are not authorization.
- Avoid newline-bearing shell pipes for env values, especially PowerShell
  `vercel env add` pipelines. Use dashboard entry or reviewed stdin handling.
  Vercel env changes require a new deployment to reach a deployment.
- Verify markup with precise opening tags/DOM checks. A CSS selector match is
  not proof an element rendered; line counts aren't occurrence counts.
- `mcp__Claude_Browser__*` previously crashed sessions on this project.
  Use provider MCPs for structured edits; check the actual supported client
  before choosing another browser tool.
