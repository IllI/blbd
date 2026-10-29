# Workstation and contribution setup

This procedure is part of agent bootstrap. When Jonas asks Claude to initialize
the project, execute the local setup and GitHub configuration below, rather
than stopping after `npm ci` or asking him to explain the deployment pipeline.
Owner preparation is in [OWNER-SETUP.md](OWNER-SETUP.md).

## 1. Install workstation prerequisites

Inspect the OS and existing tools first. Install missing **Git**, **Node.js
22 LTS (22.13+) or 24 LTS**, **npm**, and **GitHub CLI (`gh`)** through official
installers/package managers. The repo's `.nvmrc` selects Node 22. The Vercel
project currently builds with Node 24; both supported LTS lines are declared
in `package.json`. Do not replace a working supported installation.

| Tool | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Git | `winget install --id Git.Git -e` (includes Git Bash) | Xcode command-line tools or `brew install git` | Distribution package manager |
| Node/npm | Official [Node.js installer](https://nodejs.org/en/download) for a supported LTS line | Official installer or existing version manager | Official installer or existing version manager |
| GitHub CLI | `winget install --id GitHub.cli -e` | `brew install gh` | [Official Linux packages](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) |

Use an available package manager, not an assumption that Homebrew/winget is
already installed. Let Jonas complete unavoidable installer dialogs and sign-ins.
Vercel CLI and Supabase account credentials are not required for this path.
Figma/Webflow OAuth is covered in [MCP.md](MCP.md).

In the cloned repo root on `feat/admin-portal`, run:

```sh
npm run setup:workstation
```

This uses the lockfile via `npm ci`, creates `.env.local` only if absent, and
reports GitHub CLI/sign-in status without exporting credentials. It preserves
existing env values. `npm run check:workstation` inspects without installing
packages or copying env. It does not create forks, push code or deploy.
After local setup, the agent must finish the GitHub steps below.

## 2. Authenticate Jonas's own GitHub account

Check `gh auth status --hostname github.com`. If sign-in is needed, run:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh api user --jq .login
```

Jonas completes browser authentication himself; don't request tokens/codes in
chat or use `gh auth token`. Discover his username from the authenticated
account; the team does not need to know it before he starts. If the wrong
person's account is active, resolve that before creating a fork or pushing.
Check his repository-local Git author configuration; ask for his own verified
GitHub email/noreply identity only if missing. Never substitute the owner's identity.

## 3. Configure a writable remote

Inspect `git remote -v`, the current branch, `git status`, and:

```sh
gh api repos/IllI/blbd --jq '.permissions.push'
```

**If Jonas has upstream write access**, preserve `origin=IllI/blbd` and create
or reuse the local design branch. He can push a personal branch directly.
Repository collaboration is separate from paid Vercel team membership.

**Without upstream write access**, the repo is public and allows forks. Create
or reuse his fork using GitHub CLI:

```sh
gh repo fork IllI/blbd --clone=false --remote=false
```

Verify the resulting fork belongs to the signed-in user and its parent is
`IllI/blbd`. If a same-name unrelated repo already exists, do not overwrite it;
resolve the fork name with Jonas. For an initial clone with only
`origin=https://github.com/IllI/blbd.git`, rename that remote and add the fork:

```sh
git remote rename origin upstream
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/blbd.git
git fetch upstream feat/admin-portal
```

Substitute the actual discovered username/fork URL. Inspect and reuse existing
`upstream`/`origin` definitions rather than blindly rerunning these commands.
Preserve local branches, edits, and commits; do not reset or reclone over work.

Create a local **`jonas/design-first-pass`** branch from the beta base if no
design branch exists. Keep the current design branch when work has started.
The owner can prepare isolated preview variables for this known branch name
ahead of time; see [OWNER-SETUP.md](OWNER-SETUP.md).

When a network write check is requested, `git push --dry-run origin HEAD`
checks the push path without publishing a commit. Do not call a successful
clone proof of write permission or a successful local build proof of deployment.

## 4. Start designing locally

Run `npm run build`, then `npm run dev`; verify `/login` actually responds and
give Jonas the local URL, server status, and stop/restart instructions. If the
default port is occupied, use an available port and report the actual URL.
The sample env is for layout/build work, not real auth. Follow
[SETUP.md](SETUP.md) for beta public credentials and verified account login.

Inspect Figma frames, existing components and CSS tokens as described in
[DESIGN.md](DESIGN.md). Continue local design when private Vercel access or
other invitations are missing. Never disable route guards for a mockup.

## 5. Submit and automatically build beta contributions

When Jonas asks to submit his work, inspect/stage only the intended changes,
run the build and relevant existing tests, commit with his identity, and push
the design branch to the writable `origin`. Open a PR explicitly targeting
the upstream beta branch, not the fork's default branch:

```sh
git push -u origin HEAD
gh pr create --repo IllI/blbd --base feat/admin-portal --head YOUR_GITHUB_USERNAME:jonas/design-first-pass
```

Use the actual username/branch. Include the Figma frame links, screenshots,
validation and remaining gaps; use a body file for multiline PR descriptions.
Do not push code or open a PR just to initialize the laptop.

**Default automatic deployment:** the existing Vercel Git integration builds
upstream branches. Reviewed PRs merged by the owner into `feat/admin-portal`
automatically build the already configured shared beta. No hook URL, Vercel
token or paid contributor seat is needed on Jonas's laptop.

A personal branch/fork preview may need owner authorization and its own
isolated beta variables. Do not authorize unreviewed code with production
secrets or assume a green preview uses beta. If a preview cannot be isolated,
review locally and use the owner-reviewed shared-beta merge path. Native fork
deployment approval is a provider gate; no local Git hook bypasses it.

Inspect the actual Vercel commit check and beta URL after deployment. Report
an approval/configuration blocker precisely; don't silently move to `main`,
change authorship, share an owner token, or claim an accepted hook is a completed
deployment. The optional **beta-only** Actions hook workflow and exact owner
settings are in [OWNER-SETUP.md](OWNER-SETUP.md).

## Access and cost boundaries

GitHub contribution, preview viewing, portal login, and Vercel project
administration are different permissions. Private Vercel MCP/dashboard/env
access is optional for Jonas and is not supplied by a fork or deploy hook.
Keep all three MCP definitions, but don't block bootstrap on private Vercel tools.

This avoids an extra contributor seat; hosting limits and plan eligibility
still apply. Public code does not change the project's hosting plan terms.

Official references:
[GitHub CLI authentication](https://cli.github.com/manual/gh_auth_login),
[fork command](https://cli.github.com/manual/gh_repo_fork),
[Vercel public collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration),
[fork deployment approval](https://vercel.com/docs/git#deploying-forks-of-public-git-repositories).
