# Onboarding — using OpenAI Codex CLI (GPT-5) instead of Claude Code

For anyone on the BLBD team who'd rather use their **ChatGPT subscription**
(Plus/Pro/Business/Edu/Enterprise) than pay for a separate Claude Code plan.
Same repo, same rules, different agent. If you're setting up Claude Code
instead, see [`ONBOARDING.md`](./ONBOARDING.md) — most of this file just
mirrors it with Codex-specific commands.

**The short version:** install Codex CLI, sign in with your ChatGPT account
(no API key needed), clone the repo, run `codex`. Codex auto-loads
[`AGENTS.md`](./AGENTS.md) from the repo root, which points it at
`CLAUDE.md`/`SKILLS.md` — the same project context Claude Code gets.

---

## 1 · Install Node.js + git

Same as any JS project. Codex CLI itself doesn't strictly need Node (it ships
native binaries), but you'll need Node/npm anyway to run this repo
(`npm install`, `npm run dev`).

**macOS / Linux:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# open a new terminal, then:
nvm install --lts
node -v && npm -v
```

**Windows (PowerShell):**
```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
node -v; npm -v
```

## 2 · Install Codex CLI

Pick whichever installer you're comfortable with — all are official,
maintained by OpenAI ([github.com/openai/codex](https://github.com/openai/codex)):

**macOS / Linux — one-line installer:**
```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

**Windows — PowerShell one-liner:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"
```

**Or, on any OS, via npm** (works fine as an alternative to the above):
```bash
npm install -g @openai/codex
```

**Or on macOS via Homebrew:**
```bash
brew install --cask codex
```

## 3 · Sign in with your ChatGPT plan (not an API key)

```bash
codex
```

On first run it'll prompt you to authenticate — choose **"Sign in with
ChatGPT."** This uses your existing Plus/Pro/Business/Edu/Enterprise plan's
included Codex usage, with **no separate API billing** — exactly what you
want if you don't want to pay for a second AI coding subscription. (There's
also an API-key sign-in path, but that bills per-token separately — skip it
unless you specifically want that instead.)

## 4 · Clone the repo

```bash
git clone https://github.com/IllI/blbd.git
cd blbd
npm install
cp .env.local.example .env.local
npm run dev   # http://localhost:3000 — works with placeholder keys, no real secrets needed
```

## 5 · Credentials — who needs what

Identical rules to the Claude Code path — see the table in
[`ONBOARDING.md`](./ONBOARDING.md#3-credentials-who-needs-what). Short
version: reading/editing code needs nothing; touching the database schema or
bypassing RLS needs a Supabase **service_role** key handed out in person;
deploying needs Vercel project access. Never commit a real `.env.local`.

## 6 · Run Codex in the repo — it already knows what to do

```bash
cd blbd
codex
```

Codex CLI automatically discovers and loads `AGENTS.md` at the repo root as
project instructions — you don't need a special first prompt the way Claude
Code benefits from one, because `AGENTS.md` itself tells it to go read
`CLAUDE.md` and `SKILLS.md` before doing anything. It's still worth asking
it to confirm out loud that it did, especially the first time:

> Confirm you've loaded AGENTS.md for this repo, then read CLAUDE.md and
> SKILLS.md in full. Tell me what's set up vs. missing in my local
> `.env.local`, and what you'd need from me before making a real change.

## 7 · One real gap vs. the Claude Code path: the Webflow MCP connector

Structural Webflow Designer edits (new pages, shared component changes,
navbar links) go through a Webflow MCP server connection — that's currently
wired up through Claude's connector system, and hasn't been set up for Codex
yet. Two options if you hit a task that genuinely needs it (most day-to-day
work — `blbd.js` fixes, embed HTML in `webflow/`, portal code — doesn't):

- Do the Designer edit by hand in the Webflow Designer UI (log in at
  `webflow.com`, open `blbd-2`) — same as anyone would before this project
  had MCP access at all.
- Codex CLI does support connecting its own MCP servers (config in
  `~/.codex/config.toml`). If this comes up often enough to be worth wiring
  up, ask — that's a one-time setup, not something to reverse-engineer
  mid-task.

## 8 · Where to go next

Same recipes as everyone else — `SKILLS.md` has step-by-step instructions
for shipping a fix to `blbd.js`, cutting a new SDK version, adding a Webflow
embed page, and diagnosing a wrong redirect. `CLAUDE.md` has the architecture,
the two-Webflow-sites gotcha, and a running list of mistakes already made
once — read it before rediscovering one.
