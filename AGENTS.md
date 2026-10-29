# BLBD agent instructions

Before making changes, read [CLAUDE.md](CLAUDE.md) and
[SKILLS.md](SKILLS.md) in full, then [ENVIRONMENTS.md](ENVIRONMENTS.md).
For a new laptop, also read [ONBOARDING.md](ONBOARDING.md),
[MCP.md](MCP.md), [DESIGN.md](DESIGN.md), and [SETUP.md](SETUP.md).
These checked-in files supply shared context; personal machine state and old
session notes are not prerequisites.

## Current direction — 2026-10-29

- Jonas is joining to design the BLBD beta site in **Figma**.
- Public site/CMS implementation stays in **Webflow beta** for now.
- The **member/admin portal stays in this Next.js repository on Vercel**.
  Do not apply the superseded native Webflow portal migration plan.
- Beta is Webflow `693b4fc98a599c12cbf30e36` (`blbd.webflow.io`),
  Supabase `hfmjvbjyectxiszutwen`, Vercel project `blbd`, team
  `illi1s-projects`, **Preview / `feat/admin-portal`**.
  Personal preview branches need their own verified beta settings.
- `blbd-staging.vercel.app` is a legacy production alias, not beta.
  Confirm immutable IDs before remote writes; names can change.
- [.mcp.json](.mcp.json) shares **Figma, Webflow and Vercel** endpoints.
  Each teammate supplies their own OAuth and account permissions. Verify with
  read-only calls; call `webflow_guide_tool` before other Webflow tools.
- Inspect existing env before creating it. The tracked example is for
  build/layout preparation; it does not provide working authentication.
  Keep local mail off and secrets out of output/browser code/git.
- Use `npm ci`; run `npm run build` before committing. Use the existing
  tests appropriate to behavioral changes.
- Production publication, production deploys, env/DNS/alias changes and
  unprompted pushes/merges to `main` need explicit authorization.
  Webflow publishing can ship all pending draft changes across the site.
  Historical session approvals do not transfer to a new teammate.
- Preserve frozen SDK releases and existing auth/SDK consumers. Security is
  enforced by RLS/triggers and verified server authorization; read
  [supabase/README.md](supabase/README.md) before migration work.

For any conflict with the older native portal migration documentation,
the October 29 direction in CLAUDE.md and ENVIRONMENTS.md takes precedence.
