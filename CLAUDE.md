# BLBD — context for Claude Code sessions in this repo

Read this before touching anything. It's dense on purpose — every line here
was learned the hard way in an earlier session. **See also `SKILLS.md`** for
step-by-step procedures (shipping a fix, cutting a release, adding a Webflow
page). This file is the *map*; that one is the *recipes*.

## What this actually is

**Webflow is the site.** The founder pays for Webflow's CMS/design; it drives
all public content (home, about, blog, join). This repo is **not** a second
website — it's a free, self-hosted **replacement for Memberstack**: the
auth/database/payments layer that plugs *into* Webflow pages via one script
tag. Never build a competing landing page or duplicate marketing content
here. If a task smells like "design a page," it belongs in Webflow, not in
`src/app/`.

Full architecture diagram + reasoning: `ARCHITECTURE.md`.

## The two Webflow sites — do not confuse them

| | `blbd.webflow.io` | `blbd-2.webflow.io` |
| --- | --- | --- |
| Status | Original, blog built out | **Active site being built out** |
| Custom code | **Blocked** — no site plan, Webflow gates Custom Code behind a paid plan | Allowed (has a plan) |
| Auth forms | Native Webflow User Accounts (`#wf-log-in-email` etc.), page `/log-in` | Was Memberstack (`data-ms-form`, `data-ms-member`), page `/login` (no hyphen) |
| Use it for | Nothing right now — can't even install the script | All current work |

`blbd.js` supports **three** form conventions simultaneously (native Webflow
IDs, Memberstack `data-ms-*` attributes, and a generic `data-blbd-form` /
`data-blbd-input` contract for hand-built forms) specifically so it works on
whichever site ends up being real. Don't assume one and delete support for
the others.

## Infrastructure map

| Piece | Where | Notes |
| --- | --- | --- |
| Code | `github.com/IllI/blbd` (public repo, `main` branch) | `gh` CLI authenticated as user `IllI` |
| Hosting | Vercel project `blbd` (team `illi1s-projects`) | Auto-deploys on push to `main` — see below |
| "Production" test URL | `blbd-life.vercel.app` | Manual alias, does **not** auto-follow new deploys |
| "Staging" test URL | `blbd-staging.vercel.app` | Same caveat |
| Real prod domain | `app.blbd.life` | Added to Vercel, DNS record not yet added at GoDaddy — once it is, this domain *will* auto-track every push forever, no more manual aliasing |
| Database/Auth | Supabase project `blbd`, ref `ihghsacsxvibtwoiyjag`, org "BLBD" | Created via `supabase` CLI this session |
| Payments | Stripe | **Not set up yet** — placeholder keys in `.env.local` / Vercel env |
| Email | Resend | **Not set up yet** — placeholder keys |
| Blog content | Webflow CMS, pulled via `lib/webflow.ts` | `WEBFLOW_API_TOKEN` scoped to CMS read/write + Sites read |

### The git/Vercel pipeline — how a code change actually ships

```
edit code → npm run build (catches errors) → git add/commit → git push
  → Vercel auto-builds (~40-90s) → new immutable deployment URL
  → manually re-alias blbd-life.vercel.app + blbd-staging.vercel.app to it
    (skip this step entirely once app.blbd.life DNS is live)
```

There is **no CI test suite** — `npm run build` (which also full-typechecks)
is the only gate before pushing. Run it before every commit.

## `blbd.js` — the one file that matters most

`public/blbd.js`. Vanilla JS, no build step, no dependencies, ~1700 lines.
Runs first-party on whatever Webflow site loads it (this is deliberate — see
"Why first-party" in `ARCHITECTURE.md`; it's why there's no third-party-
cookie problem and no iframe for comments).

**Versioning — do not skip this when shipping to a real site:**
- `public/blbd.js` (served at bare `/blbd.js`) is the **edge** copy — whatever
  is on the branch right now, 5-minute cache. Fine for our own testing.
- `public/vN/blbd.js` (served at `/vN/blbd.js`, e.g. `/v3/blbd.js`) is a
  **frozen** snapshot, cached forever. Cut with
  `node scripts/release-sdk.mjs vN` — it refuses to overwrite an existing
  version. A real Webflow footer-code install should point at a version, not
  bare `/blbd.js`.
- `blbd-2.webflow.io`'s footer script currently points at the **bare**
  `/blbd.js` — meaning every fix that lands on `main` and deploys reaches it
  automatically, with **zero Webflow-side edit**. This has repeatedly been
  the fastest way to fix something the user hit live, without asking them to
  touch the Designer at all. Keep exploiting this while it's true; don't
  casually switch that site to a pinned version without a reason.

**Config is read from the `<script>` tag's `data-*` attributes**, not env
vars — this file ships to a browser, it has no access to `.env`. See the
`CFG` object at the top of the file for every knob (`data-supabase-url`,
`data-app-url`, `data-login-path`, `data-signup-path`, `data-members-path`,
`data-after-login`, etc.). When adding a new configurable behavior, add a
`CFG` entry with a sensible default — **and grep the whole file for any
hardcoded path literal that should have used it instead** (this has been a
real, shipped bug twice: `/log-in` hardcoded in two `href=` strings instead
of `CFG.loginPath`).

**Two ways content gets rendered, both supported everywhere reasonable:**
1. Pre-built widgets — a bare `<div data-blbd="goals">` (or `profile`,
   `directory`, `account`, `comments`, `login-form`, `signup-form`) gets a
   fully pre-styled widget with zero markup from the design team.
2. Templated — the design team builds their *own* markup with
   `data-blbd-template`, `data-blbd-bind`, `data-blbd-when`,
   `data-blbd-action` (goals board only, so far — see `webflow/DESIGN-TEAM.md`
   for the exact contract). Detected automatically; falls back to (1) if no
   template markup is found. Extending this pattern to profile/directory/
   comments is a reasonable next step if the design team hits real limits
   with widget-level CSS overrides.

## Editing the actual Webflow Designer — superseded, read this not the old advice

**Earlier in this project's life, real Designer editing (elements, attributes,
components) was confirmed impossible from Claude Code** — the Data API's
Pages resource had no element-creation endpoint, the CLI had no page/element
commands, and Designer Extensions only run while a human has the Designer
physically open. **That conclusion no longer holds.** The user added
Webflow's own MCP server ("Webflow MCP 2.0" / `webflow-mcp-server`,
tool-prefixed `mcp__<connection-id>__*` — the id is per-connection, re-find
the tools by name via `ToolSearch` rather than hardcoding a prefix) partway
through the session, and it genuinely can create pages, insert component
instances, set attributes, and publish. If a fresh session's `ToolSearch`
doesn't surface tools like `data_element_tool` / `data_component_tool` /
`data_pages_tool` / `designer_tool`, the server may not be connected — search
for it before assuming the old limitation still applies.

**Two categories of tool, with different requirements — call
`webflow_guide_tool` first in any session that uses these, it has the
authoritative up-to-date usage rules:**

- **Data tools** (`data_*`, e.g. `data_pages_tool`, `data_element_tool`,
  `data_component_tool`, `data_component_builder`, `data_sites_tool`) are
  plain REST calls against Webflow's backend. They work **headlessly** —
  confirmed working in this environment with no browser, no live Designer
  session, nothing open on the user's end. This is how a page gets created,
  an element tree gets read, a component instance gets inserted, attributes
  get set, and the site gets published.
- **`designer_tool` and `element_snapshot_tool`** interact with the user's
  **live, currently-open Designer tab** specifically — get/set selection,
  canvas navigation, visual snapshots. These fail with a clear "Unable to
  connect to Webflow Designer" error (not a crash) if the user doesn't have
  the Designer open with the MCP companion connected; the error message
  includes a real, safe connection link to hand back to the user
  (`https://<site-shortname>.design.webflow.com?app=...`) — share it as a
  markdown link, don't fabricate one.

**Verified end-to-end this session:** found the site's real shared `Navbar`
component (`data_component_tool > query_components`), read the login page's
element tree (`data_element_tool > get_all_elements`), inserted a live
instance of that exact component before the existing embed content
(`data_component_builder` / `data_component_tool > insert_component_instance`
with `creation_position: "before"`), confirmed the new order by re-reading
the tree, then published (`data_sites_tool > publish_site`) — **after
explicit user confirmation**, since publishing is whole-site by default
(single-page publishing needs an Enterprise plan) and pushes out any other
unpublished draft changes too, not just the one edit just made. Verified live
via `curl` afterward: real navbar markup present, login form still intact.

**Still true and unchanged:**
- **Webflow CLI OAuth login (`webflow auth login`) refuses without a real
  interactive TTY** — confirmed failing identically via both the Bash tool
  and the PowerShell tool. This is the *old* Webflow CLI (`webflow` on PATH,
  `npm i -g webflow-cli` or similar) — unrelated to the MCP server above,
  which authenticates differently and does work. Don't conflate the two or
  retry the CLI login expecting a different result.
- **The sandboxed Browser tool (`mcp__Claude_Browser__*`) crashes Claude
  Code** — user-confirmed twice. **Do not use it, at all,** for this
  project. The Webflow MCP tools above are a better path for anything that
  needs the Designer anyway.
- Prefer the **one-attribute shortcuts** (`data-blbd="account-link"` etc.)
  over building new structure even now that real editing works — smaller
  diffs are still easier to verify and less likely to fight the site's
  existing design.
- **Always confirm before publishing** — the edit itself (via data tools) is
  safe/reversible (it's a draft-state change), but `publish_site` is
  whole-site by default and is exactly the kind of action to check first,
  same as any other publish action.

## Verification discipline — mistakes already made, don't repeat them

This session had **two false alarms** from sloppy verification, both
corrected in the same session:
1. A "script tag is duplicated" finding that was actually a bug in an ad-hoc
   Node script's string-slicing, not real duplication.
2. A "nav strip isn't there" read that was actually a loose substring count
   (`grep -c "blbd-mini-nav"`) matching CSS selectors as well as the real
   HTML element, producing a misleadingly high count.

**Lesson: when checking whether markup shipped, match the actual opening tag
precisely** (e.g. `grep -o '<nav class="blbd-mini-nav">'`), not a bare
substring that could also match a CSS rule, a comment, or an unrelated
occurrence. When in doubt, dump wider context and read it, don't trust a
single count.

## Known gotchas already paid for once — don't rediscover

- **`NEXT_PUBLIC_*` vars must be literal `process.env.NEXT_PUBLIC_FOO` member
  expressions** in code that ships to the browser. A dynamic lookup
  (`process.env[name]`) is never inlined by Next.js's build-time substitution
  and silently evaluates to `undefined` client-side — this caused a real
  production login outage. `src/lib/env.ts` has the client-safe constants
  spelled out individually for this reason; don't "simplify" it back to a
  helper function.
- **Piping a value into `vercel env add` from PowerShell bakes `\r\n` into
  it.** Use Bash: `printf '%s' "$val" | vercel env add KEY production`.
- **Supabase's email/OAuth confirmation links use the implicit flow** —
  session comes back in the URL *fragment* (`#access_token=…`), which a
  server route can never read. `/auth/confirm` (client component) and
  `blbd.js`'s `consumeAuthFragment()` both handle this; any *new* auth entry
  point needs the same handling, not a server-side `?code=` assumption.
- **Tier gating is enforced in Postgres** (RLS policies + triggers in
  `supabase/migrations/0001_init.sql`), not just in the UI or in `blbd.js`.
  The client-side "upgrade to unlock" prompts are a courtesy; the actual
  security boundary is the database. Verified: a free-tier user's INSERT into
  `blog_comments` and a 6th goal slot both get rejected at the DB level even
  if someone bypasses the JS entirely.
- **CORS is origin-echoed, not a static allowlist** (`src/lib/cors.ts`) —
  Webflow is reachable from the custom domain and from `*.webflow.io`
  staging hosts simultaneously, and a static `Access-Control-Allow-Origin`
  header can only name one origin.

## Where things live

- `public/blbd.js`, `public/v*/blbd.js` — the SDK, see above.
- `webflow/` — everything meant to be pasted into Webflow: `INSTALL.md`
  (setup steps, written for whoever's doing the pasting), `DESIGN-TEAM.md`
  (the templating contract, written for a designer, not a developer),
  `login-page.html`, `members-page.html` (paste-ready Embed content).
- `src/app/(portal)/*` — the old standalone Next.js member pages
  (dashboard/goals/profile/community). **Intentionally kept** as an internal
  test harness (user's explicit call) — not linked from anywhere real, not
  the intended path for actual members, useful for me to verify backend
  changes fast without needing a Webflow page built first.
- `src/app/page.tsx` — the portal's own root is a **service status page**
  (diagnostics + the current install snippet), not a landing page. It
  redirects signed-in users to `/dashboard` and does nothing else for
  anonymous visitors — there is deliberately no marketing content here.
- `supabase/migrations/0001_init.sql` — full schema + RLS + triggers, applied
  via `supabase db push`. `supabase/README.md` has the reasoning for several
  non-obvious choices (why `check_function_bodies = off` is needed, why
  `protect_profile_columns()` exists, etc.).
- `scripts/release-sdk.mjs` — cuts a new pinned SDK version.
- `scripts/seed-webflow-blog.mjs` — one-shot blog-post importer via the
  Webflow CMS Data API.
