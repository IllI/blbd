# Welcome, Jonas — set up your BLBD workstation

Updated **2026-10-29**. Jonas will help design the BLBD beta site in **Figma**.
Public-site designs are implemented in **Webflow beta**; the **member/admin
portal stays in this repo on Vercel**. Start with local work and beta review.

Cloning supplies project context and MCP definitions. It does not transfer
another teammate's logins, secrets, account permissions, or Figma files.

## 1. Get your accounts and tools ready

Ask the project owner for the access needed for your work:

| Access | Why / target |
| --- | --- |
| Own GitHub account | Public repo; clone now and create a fork for PRs without an invitation. Upstream write access is optional |
| Figma team/file invitation | Design source; ask for the shared file and exact frame/node links (not yet recorded in this repo) |
| Webflow site edit access | BLBD BETA, site `693b4fc98a599c12cbf30e36` |
| Shared beta review URL | Owner shares access if protected. Private Vercel dashboard/MCP access and a paid seat are not required for contributions |
| Beta public Supabase URL + anon key | Real local member login/data; supplied through the team's secure channel |
| Verified beta portal account | Separate signup from production; admin screens also require an actual admin grant |

Jonas's one-time beta admin invitation is defined in migration `0003`.
A maintainer checks whether it has been applied. Sign up with the invited
mailbox on the [shared beta portal](https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app/signup)
and finish email verification there before logging in locally. The shared
auth-mail hook does not accept localhost confirmation redirects; see
[SETUP.md](SETUP.md). See [ADMIN-PORTAL.md](ADMIN-PORTAL.md) for invitation rules.
Do not rerun migrations or bypass verification just to unblock design work.

Install **Git**, **Node.js 22 LTS (22.13+) or 24 LTS**, **GitHub CLI**, and the
**Claude desktop app**. The repo's `.nvmrc` selects Node 22 for version managers.
Install commands and GitHub authentication are in [CONTRIBUTING.md](CONTRIBUTING.md).
Use its **Code tab with a local session** for repository work. A regular
Claude chat does not automatically read a cloned folder. A terminal
Claude Code installation is an alternative; see
[Anthropic's setup guide](https://code.claude.com/docs/en/setup) and
[desktop guide](https://code.claude.com/docs/en/desktop).

On Windows, install Git for Windows (including Git Bash) and Node.js 22 using
their official installers. On macOS/Linux, use the official Node installer
or your existing Node version manager (`nvm install 22`, `nvm use 22`).
Open a fresh terminal after installing and check:

```sh
git --version
node --version
npm --version
```

The standalone Claude Code CLI and Vercel CLI are optional for the Code-tab
path. Install the Vercel CLI only if using the explicit env-pull procedure in
[SETUP.md](SETUP.md). Webflow CLI and Supabase CLI login are not required for
design work; the repo provides the Supabase CLI for maintainer tasks.

## 2. Clone the current beta code

```sh
git clone --branch feat/admin-portal https://github.com/IllI/blbd.git
cd blbd
git status --short
git branch --show-current
npm run setup:workstation
```

The checked-out branch should be `feat/admin-portal`. On an existing clone,
inspect local changes before switching or pulling; don't reset someone else's
work. These docs currently live with the beta implementation on this branch;
a plain default-branch clone may not include it yet.

The repository root is this `blbd` folder containing `package.json`.
Do not create a second Next.js project or reproduce the owner's worktree paths.

## 3. Let Claude initialize the workstation and contribution workflow

Open a **local Code session** in Claude Desktop and select the cloned repo,
or run Claude Code in that folder. The checked-in `CLAUDE.md` and `AGENTS.md`
direct the agent to execute [CONTRIBUTING.md](CONTRIBUTING.md), not merely
describe the setup.

The agent must inspect prerequisites, run `npm run setup:workstation`,
guide your own GitHub browser authentication, discover your username,
configure a writable fork/upstream remote, create/reuse a design branch,
build, start the app and report the verified local URL. Existing files,
credentials and changes must be preserved. Never paste tokens into chat.

The bootstrap script installs locked dependencies and creates the sample env
only if absent. GitHub authentication and remote setup are agent-guided steps
after that command; a successful install alone is not complete contribution
setup. [OWNER-SETUP.md](OWNER-SETUP.md) lists advance owner preparation.

A regular Claude chat does not automatically gain local terminal access from
a clone. Use the local Code session for installation. Other Markdown files
are explicitly read per agent instructions; a name like `SKILLS.md` does not
make a file automatically load. No email prompt is stored in the repo.

## 4. Connect design MCPs; Vercel private access is optional

Follow [MCP.md](MCP.md). The checked-in `.mcp.json` includes **Figma,
Webflow and Vercel**. In Claude Code, open `/mcp` and authenticate the needed
providers under your own account. Missing private Vercel permissions must not
block local design or GitHub contribution. For ordinary desktop chat, use
Connectors; confirm tools in the session that will implement your changes.

The first checks read a Figma frame and list the beta Webflow site/pages.
Inspect private Vercel deployment tools only if your account is authorized;
otherwise use the GitHub check and shared beta review URL. Configuration alone
is not proof of access.
The owner must supply the Figma file/frame link before design inspection.

## 5. Configure the local app and run it

In the repo root, create `.env.local` **only if it doesn't already exist**:

macOS/Linux:

```sh
cp .env.local.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

The example contains dummy public Supabase values and blank secrets. It
supports build/layout preparation; it cannot authenticate users or provide a
working signed-in portal. For real local sessions, follow [SETUP.md](SETUP.md)
to enter the **beta** public URL and anon key. Privileged admin operations need
additional server credentials supplied case by case; use the shared beta
portal for review if those aren't needed on your laptop.

```sh
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).
The repo also includes `.claude/launch.json` for the desktop app's dev preview.
Local email sending stays disabled; never copy the shared beta's enabled mail
setting into a design workstation.

## 6. Verify, then start a design branch

Run `npm run build`. Authenticated features need a separate real beta smoke
check: member login, required portal screen, and verified-admin access when
reviewing admin screens. Report missing credentials as missing access, not
as successful end-to-end verification.

Create a branch based on the current beta branch, for example:

```sh
git switch -c jonas/design-first-pass
```

Capture the Figma frame URL, intended surface and acceptance criteria using
[DESIGN.md](DESIGN.md), then open a PR against `feat/admin-portal`.
The contribution procedure in [CONTRIBUTING.md](CONTRIBUTING.md) configures
your own fork when upstream write access isn't available. Owner-reviewed
merges automatically build shared beta through the existing Vercel integration.
Advance owner tasks are listed in [OWNER-SETUP.md](OWNER-SETUP.md).
A personal Vercel preview is usable only after its exact branch has been
configured and checked for beta isolation; see [ENVIRONMENTS.md](ENVIRONMENTS.md).

Your workstation is ready when dependencies install, the local app starts,
the build passes, Claude reports the correct environment/portal split, and
your GitHub sign-in/remotes are configured, and needed design MCP reads succeed
(or a specific outstanding invitation is recorded). Private Vercel access is
not a workstation readiness requirement.
Real member/admin design review additionally requires working beta login.
