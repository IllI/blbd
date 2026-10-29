# BLBD — project procedures

Read [CLAUDE.md](CLAUDE.md) and [ENVIRONMENTS.md](ENVIRONMENTS.md) first.
All commands assume the cloned repository root containing `package.json`,
regardless of the local directory name. Current direction: **2026-10-29**.

## Set up Jonas's laptop

Follow [ONBOARDING.md](ONBOARDING.md), [CONTRIBUTING.md](CONTRIBUTING.md),
[MCP.md](MCP.md), [SETUP.md](SETUP.md) and [OWNER-SETUP.md](OWNER-SETUP.md).
Inspect/install Git, supported Node/npm and GitHub CLI. Run
`npm run setup:workstation`, preserve existing env and keep mail off.
Complete the user's own GitHub authentication, discover their username,
configure a verified upstream/fork remote, and create/reuse the design branch.
Build, start dev and verify the local URL; setup is more than installing deps.
Verify needed design MCPs and any authorized Vercel tools with read-only calls.
Missing private Vercel access is optional; don't require a paid seat or owner token.
Don't provision infrastructure, publish, run migrations or send mail.

## Implement a Figma design

Follow [DESIGN.md](DESIGN.md). Capture the exact frame/node and target route.
Public website work goes to Webflow beta. Member/admin portal work goes to
Next.js on Vercel. Use existing components and tokens, preserve auth/role/data
behavior, and compare responsive screenshots with the design.

Make a personal branch from `feat/admin-portal`; use the writable fork or
upstream remote from CONTRIBUTING.md and target `IllI/blbd:feat/admin-portal`
in the PR. Owner-reviewed merges automatically build shared beta through
existing Git integration; the optional Actions hook needs deliberate owner
activation. Run `npm run build` and relevant existing regression tests. Verify beta
isolation before using any personal-branch Preview; it does not inherit the
shared beta branch's overrides.

## Change the existing Webflow SDK

1. Inspect the target page's actual loader/config and its environment.
2. Edit `public/blbd.js`; preserve the supported form conventions and use CFG
   for configurable paths. SDK config comes from script attributes, not env.
3. Run `node --check public/blbd.js`, applicable SDK/native/auth regression
   tests, then `npm run build`.
4. Prepare a focused diff/PR on the beta base. Do not include unrelated files.
5. For an authorized preview deployment, verify its branch, commit and beta
   config, then check the exact asset URL and intended browser behavior.
   A Vercel deploy does not automatically update a Webflow script pinned to an
   older deployment/version; inspect that binding separately.
6. Do not move `blbd-life.vercel.app` or `blbd-staging.vercel.app` as part
   of beta testing. Both are legacy aliases with production consumers.

## Cut a pinned SDK version

Only when a release is requested, use:

```sh
node scripts/release-sdk.mjs vN
```

Replace `vN` with the next unused version. The script refuses to overwrite
a release; never hand-edit a frozen `public/v*/blbd.js`. Update any install
recommendations/status snippets in the same reviewed change. Verify the asset
on the intended deployment before updating a consumer's script binding.
Changing Webflow script bindings/publication is a separate release action.

## Edit public Webflow beta pages through MCP

1. Use [MCP.md](MCP.md) to authenticate your own connection.
2. Discover tools and call `webflow_guide_tool` first; follow its current
   schemas and Designer/Bridge requirements rather than old tool prefixes.
3. Read the site metadata and require beta ID `693b4fc98a599c12cbf30e36`.
   Inventory the page, components, classes and existing scripts.
4. Reuse existing components/styles and preserve the integration attributes.
   For SDK markup, consult [webflow/DESIGN-TEAM.md](webflow/DESIGN-TEAM.md).
5. Apply the authorized draft edits, read back the actual tree and inspect
   responsive screenshots. Draft success is not publication.
6. Inventory **all** pending site changes and get explicit authorization for
   the intended publish target. Webflow publishes can include other people's
   drafts. Past session approval does not authorize a new release.
7. After an authorized beta publish, check the actual live markup and browser
   behavior at `blbd.webflow.io`. Do not publish production.

A normal public-site design task does not migrate the Vercel portal to native
Webflow. Keep the native portal experiment archived. Editing an HTML blueprint
in `webflow/` changes the repository, not the Designer or published site.

## Diagnose a wrong auth redirect

Inspect the current browser URL, Webflow link/script attributes, SDK CFG and
Vercel `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`. Check the matching
beta Supabase project's redirect allowlist. Trace the actual login/signup/
recovery path, including `next` and fragment/PKCE handling. The two origins
have separate sessions; do not assume one login cookie works on both.

Verify precise DOM attributes and full redirects; a matching CSS selector or
a substring count is not proof. Don't change production defaults to fix beta.

## Environment changes and credential rotation

For authorized work, select the exact provider, team/project, branch and
environment before changing a value. Keep secrets out of command arguments,
logs, browser bundles and chat; avoid PowerShell newline-bearing env pipes.
Never replace a beta key with a production key to make a test pass.

After Vercel env changes, build a new deployment of the intended environment.
Existing deployments do not acquire new env values automatically. Use
[SETUP.md](SETUP.md) for branch-specific beta setup and
[ADMIN-PORTAL.md](ADMIN-PORTAL.md) for mail/auth-hook safeguards.

If a real credential was exposed, rotate it at its provider and update only
the approved consumers. Do not force a production deploy or push to `main`
without release authorization.

## Verification and browser work

Use `npm run build` before commits and the relevant scripts in
`package.json` for behavior changes. Distinguish local tests, remote beta
tests and visual QA. Do not claim a successful provider login, visual check,
deployment or email delivery without evidence.

Use Webflow MCP for structured site edits. `mcp__Claude_Browser__*` previously
crashed this project; don't reuse it. Select supported browser tooling for
visual QA and report unavailable checks instead of silently skipping them.
