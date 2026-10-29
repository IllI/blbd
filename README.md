# BLBD — website and member/admin portal

Welcome, Jonas! BLBD (Better Living Better Dying) uses **Figma for design**,
**Webflow for the public website/CMS**, and **Next.js on Vercel for the member
and admin portal**, backed by Supabase. Design changes are developed and
reviewed in beta first.

**New workstation:** [ONBOARDING.md](ONBOARDING.md) and
[CONTRIBUTING.md](CONTRIBUTING.md) tell Claude how to install prerequisites,
initialize GitHub authentication/fork/remotes, and start the local app.
`CLAUDE.md` and `AGENTS.md` require that contribution procedure during setup.
[OWNER-SETUP.md](OWNER-SETUP.md) lists what the owner can prepare beforehand,
including branch-specific Vercel env and the optional beta Deploy Hook.

## Start from the current beta branch

Until the beta work is merged, use `feat/admin-portal` rather than `main`:

```sh
git clone --branch feat/admin-portal https://github.com/IllI/blbd.git
cd blbd
npm run setup:workstation
```

The setup command runs `npm ci`, creates `.env.local` from the tracked example
only if absent, and reports GitHub CLI/auth status. Claude then completes
GitHub sign-in, verifies contribution remotes and starts `npm run dev`.
Open [localhost:3000/login](http://localhost:3000/login).

The template has dummy values for build/layout work. Real sign-in, member
data and admin access require **beta** configuration; see [SETUP.md](SETUP.md).
Do not overwrite an existing local env file. Node.js 22 LTS (22.13+) is the
recommended baseline; Node 24 LTS is also supported. `.nvmrc` selects Node 22.
The lockfile controls dependencies; GitHub CLI is a separate workstation tool.

Open a **local Code session** in Claude Desktop and select this cloned
folder, or run `claude` here. [CLAUDE.md](CLAUDE.md) provides project context;
[AGENTS.md](AGENTS.md) directs other agents to the same instructions.
[.mcp.json](.mcp.json) shares all three remote MCP endpoints. Each person
still needs their own server trust/sign-ins for the services used. Private
Vercel project access is optional for GitHub contributions; don't buy a seat
or share owner credentials just to bootstrap a laptop.

## Find the right context

| Document | Purpose |
| --- | --- |
| [ONBOARDING.md](ONBOARDING.md) | First-day workstation procedure and agent startup context |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Executable local setup, GitHub login/fork/remotes, PRs and beta builds |
| [OWNER-SETUP.md](OWNER-SETUP.md) | Owner preparation, personal preview env and optional beta hook activation |
| [ENVIRONMENTS.md](ENVIRONMENTS.md) | Current beta/production IDs, branches and hosting boundary |
| [MCP.md](MCP.md) | Figma, Webflow and Vercel connections and read-only checks |
| [DESIGN.md](DESIGN.md) | Figma handoff, implementation destinations and review |
| [SETUP.md](SETUP.md) | Local beta configuration and maintainer deployment setup |
| [ARCHITECTURE.md](ARCHITECTURE.md) | App, SDK and database responsibilities |
| [SKILLS.md](SKILLS.md) | Project procedures and verification |
| [ADMIN-PORTAL.md](ADMIN-PORTAL.md) | Admin accounts, email workflow and operational history |
| [supabase/README.md](supabase/README.md) | Migrations, RLS and security |
| [webflow/DESIGN-TEAM.md](webflow/DESIGN-TEAM.md) | Existing Webflow attribute contracts |
| [ONBOARDING-CODEX.md](ONBOARDING-CODEX.md) | Alternative agent entry point |

## App surfaces and commands

The Vercel portal includes `/login`, `/signup`, `/forgot-password`,
`/dashboard`, `/goals`, `/profile`, `/community`, `/settings`,
`/checkout`, and `/admin` (including accounts and newsletter tools).
The repo also serves APIs and existing Webflow SDK integrations.

Next.js 15 · React 19 · TypeScript · vanilla CSS · Supabase · Stripe · Resend.
Versions and scripts are defined in [package.json](package.json).

- `npm run dev` — local app on port 3000.
- `npm run setup:workstation` — install locked deps, create env safely, inspect GitHub setup.
- `npm run check:workstation` — read-only workstation prerequisite check.
- `npm run build` — build and type-check.
- `npm run lint` — ESLint.
- `npm run test:admin` — local database/admin/auth-mail logic tests.
- `npm run test:native`, `test:social`, `test:password` — existing integration regressions.
- `npm run test:beta` — **remote** beta checks; not a workstation prerequisite.

The shared beta portal is on **Vercel Preview / `feat/admin-portal`**.
Personal preview branches need their own verified beta env configuration.
`blbd-staging.vercel.app` is a legacy production alias, not isolated beta.
Pushing to `main` can deploy production. See [ENVIRONMENTS.md](ENVIRONMENTS.md)
before publishing or deploying.

Public GitHub contributions do not require a paid Vercel team seat. The
existing integration automatically builds reviewed merges to the shared beta
branch. A fork preview can need owner authorization and isolated configuration.
The optional Actions Deploy Hook is checked in but disabled by default; see
[OWNER-SETUP.md](OWNER-SETUP.md) before activating it.
