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
| GitHub repo access and contribution permission | [IllI/blbd](https://github.com/IllI/blbd); PRs against the beta branch |
| Figma team/file invitation | Design source; ask for the shared file and exact frame/node links (not yet recorded in this repo) |
| Webflow site edit access | BLBD BETA, site `693b4fc98a599c12cbf30e36` |
| Vercel team/project access | `illi1s-projects` / `blbd`, beta previews and logs |
| Beta public Supabase URL + anon key | Real local member login/data; supplied through the team's secure channel |
| Verified beta portal account | Separate signup from production; admin screens also require an actual admin grant |

Jonas's one-time beta admin invitation is defined in migration `0003`.
A maintainer checks whether it has been applied. Sign up with the invited
mailbox on the [shared beta portal](https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app/signup)
and finish email verification there before logging in locally. The shared
auth-mail hook does not accept localhost confirmation redirects; see
[SETUP.md](SETUP.md). See [ADMIN-PORTAL.md](ADMIN-PORTAL.md) for invitation rules.
Do not rerun migrations or bypass verification just to unblock design work.

Install **Git**, **Node.js 22 LTS (22.13 or newer)** with npm, and the
**Claude desktop app**. The repo's `.nvmrc` selects Node 22 for version managers.
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
npm ci
```

The checked-out branch should be `feat/admin-portal`. On an existing clone,
inspect local changes before switching or pulling; don't reset someone else's
work. These docs currently live with the beta implementation on this branch;
a plain default-branch clone may not include it yet.

The repository root is this `blbd` folder containing `package.json`.
Do not create a second Next.js project or reproduce the owner's worktree paths.

## 3. Open the repo in Claude and give it context

In Claude Desktop's **Code** tab, start a **local** session and select the
cloned `blbd` folder. If using the CLI, run `claude` from that folder.
Review the repo trust prompt and the project MCP servers.

Paste this first prompt:

```text
I'm Jonas, joining BLBD to help design the beta site in Figma.
Read CLAUDE.md, AGENTS.md, SKILLS.md, ONBOARDING.md, ENVIRONMENTS.md,
MCP.md, DESIGN.md and SETUP.md before doing setup or implementation.

Help set up this laptop using this clone. Inspect my OS, tool versions,
repo root and branch, then install the locked dependencies if needed.
Create .env.local from the checked-in example only if it doesn't exist.
Never overwrite existing secrets or show their values.

Verify the Figma, Webflow and Vercel MCP tools with read-only requests.
Tell me which account invitations, OAuth sign-ins, beta env values, or Figma
frame links are still missing. Let me complete browser authentication.
Use Webflow beta site 693b4fc98a599c12cbf30e36 for public-site work.
Keep the member/admin portal in Next.js on Vercel, project blbd,
team illi1s-projects, Preview / feat/admin-portal, using beta Supabase
hfmjvbjyectxiszutwen. Do not use blbd-staging.vercel.app.

Start the local app and report which pages/checks actually work, versus
which require real beta access. Placeholder keys are not working auth.
Keep local mail disabled. Do not publish Webflow, deploy production, alter
remote env/DNS, run migrations, grant roles, or send email during setup.
Once setup is verified, help implement my Figma designs in the correct
beta surface and prepare them for review.
```

Claude Code loads root `CLAUDE.md` as context. The other files are explicitly
referenced by its startup instructions and the prompt; a file named
`SKILLS.md` is not automatically loaded just because it exists.
See [Claude's memory documentation](https://code.claude.com/docs/en/memory).

## 4. Connect all three MCPs

Follow [MCP.md](MCP.md). The checked-in `.mcp.json` includes **Figma,
Webflow and Vercel**. In Claude Code, open `/mcp` and authenticate each
provider under your own account. For ordinary desktop chat, use Connectors;
confirm the tools in the session that will implement your changes.

The first checks read a Figma frame, list the beta Webflow site/pages, and
inspect the beta Vercel deployment. Configuration alone is not proof of access.
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
A personal Vercel preview is usable only after its exact branch has been
configured and checked for beta isolation; see [ENVIRONMENTS.md](ENVIRONMENTS.md).

Your workstation is ready when dependencies install, the local app starts,
the build passes, Claude reports the correct environment/portal split, and
each needed MCP read succeeds (or a specific outstanding invitation is recorded).
Real member/admin design review additionally requires working beta login.
