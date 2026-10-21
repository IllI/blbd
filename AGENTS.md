# Instructions for Codex / other AGENTS.md-reading agents

This file exists so agents that auto-load `AGENTS.md` (Codex CLI and other
tools that follow the same convention) get oriented the same way Claude Code
does from `CLAUDE.md` in this repo. **Read `CLAUDE.md` and `SKILLS.md` in
full before making any change.** Those two files are the source of truth for
this project; this file is a bridge to them, not a replacement — if it drifts
out of sync, trust `CLAUDE.md` over this one.

## The most important rules, in case you act before reading the links above

- **Webflow is the site.** blbd.life runs on Webflow (CMS + design, already
  paid for). This repo is a free replacement for Memberstack — the auth/
  database/payments layer that plugs into Webflow pages via one script tag
  (`public/blbd.js`). Never build a competing landing page or duplicate
  marketing content under `src/app/`.
- **Environment roles were switched.** Production is **BLBD / blbd.life**,
  site `69b9ae3792be3b49ef7eab96`. Beta is **BLBD BETA / blbd.webflow.io**,
  site `693b4fc98a599c12cbf30e36`. Identify sites by ID, not their old names.
  Production DB is `ihghsacsxvibtwoiyjag`; beta DB is
  `hfmjvbjyectxiszutwen`. See `ADMIN-PORTAL.md` for beta deployment details.
  The old `blbd-staging.vercel.app` alias still points to the production
  deployment and must NOT be used as a beta admin test host.
- **`public/blbd.js` versioning matters.** Bare `/blbd.js` is the mutable
  "edge" copy that `blbd-2` currently tracks (fine for shipping fixes with
  zero Webflow-side edit). `public/vN/blbd.js` is a frozen, cache-forever
  snapshot cut with `node scripts/release-sdk.mjs vN` — it refuses to
  overwrite an existing version; never hand-edit one after the fact.
- **Confirm with the human before publishing Webflow changes**, running
  `vercel --prod`, or pushing to `main` unprompted. Publishing a Webflow site
  is whole-site by default, not scoped to the one edit just made — it can
  ship other people's unpublished draft changes too.
- **Run `npm run build` before every commit** (also full-typechecks) — it is
  currently the only gate; there is no CI test suite.
- **Security is enforced in Postgres (RLS + triggers)**, not just in the UI
  or in `blbd.js` — see `supabase/README.md` before touching
  `supabase/migrations/`.

Everything else — the infra map, exact recipes for shipping a fix, cutting an
SDK version, editing a Webflow page via its MCP server, diagnosing a wrong
redirect, and the list of mistakes already made once so you don't repeat
them — lives in `CLAUDE.md` and `SKILLS.md`. Read them.
