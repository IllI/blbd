# Onboarding — get your own Claude Code working on BLBD

For anyone in the BLBD group who wants to help with the site/portal and run
their own Claude Code session against this repo. Fifteen minutes, no BLBD
secrets required for most of it.

**The short version:** clone the repo, install a few tools, open Claude Code
in the folder, paste one prompt. Claude Code auto-reads `CLAUDE.md` and
`SKILLS.md` from the repo root on its own — you don't have to explain the
project, just tell it to go read them.

> Using a ChatGPT subscription instead of Claude Code? See
> [`ONBOARDING-CODEX.md`](./ONBOARDING-CODEX.md) — same repo, same rules,
> OpenAI's Codex CLI instead.

---

## 1 · Install the tools

You need: **Node.js 20+**, **git**, and **Claude Code**. Everything else
below is optional depending on what you'll actually touch.

### macOS / Linux

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# open a new terminal, then:
nvm install --lts
node -v && npm -v
```

### Windows (PowerShell)

`curl`-piped installers aren't really a thing on Windows; use `winget`
instead — it's the closest equivalent (already on Windows 10/11):

```powershell
winget install OpenJS.NodeJS.LTS
node -v; npm -v
```

### Then, same on every OS

```bash
npm install -g @anthropic-ai/claude-code
git --version   # macOS/Linux: preinstalled or `xcode-select --install` / apt/brew.
                 # Windows: winget install Git.Git
```

**Optional, only if you'll need them:**
- GitHub CLI (`gh`) — makes cloning/auth simpler if you don't already have SSH
  keys set up: `winget install GitHub.cli` / `brew install gh`.
- Vercel CLI — only needed if you're deploying or touching env vars:
  `npm install -g vercel`.
- ~~Webflow CLI~~ — **skip this.** We tried it early on; its login
  (`webflow auth login`) needs a real interactive browser OAuth flow that
  doesn't work well from inside a Claude Code session, and nothing in this
  project's workflow actually depends on it anymore. Webflow Designer edits
  now go through the **Webflow MCP connector** instead — see step 4.

## 2 · Clone the repo

```bash
git clone https://github.com/IllI/blbd.git
cd blbd
npm install
cp .env.local.example .env.local
npm run dev   # http://localhost:3000 — should just work with placeholder keys
```

The repo ships with a placeholder `.env.local` baked in, so `npm run build`
and `npm run dev` work with **zero real secrets**. You only need real keys
for the specific things listed in step 3.

## 3 · Credentials — who needs what

Two tiers. Most people only need the first row.

| You're doing... | You need | Get it from |
|---|---|---|
| Reading/editing code, `blbd.js`, Webflow embed HTML, docs | Nothing — placeholder `.env.local` is enough | already in the repo |
| Testing real sign-up/login/goals locally against live data | Real Supabase URL + **anon** key | ask whoever's running tonight's setup — anon key is meant to be public-ish (RLS-protected), low risk to hand out |
| **Anything that touches the database schema, RLS policies, or needs to bypass RLS** | Supabase **service_role** key | handed out case-by-case, in person — this key bypasses all row-level security, treat it like a root password |
| Deploying to Vercel / changing env vars there | Vercel project access | ask to be added as a collaborator on the `blbd` Vercel project |
| Editing the live Webflow Designer (pages, components, navbar) | Webflow MCP connector authorized + Designer/edit access on `blbd-2.webflow.io` | connect the MCP yourself (step 4); ask to be invited as a site collaborator |
| Live Stripe/Resend keys | — | still placeholders project-wide as of now, nobody has these yet |

Never commit a real `.env.local` — it's gitignored already, just don't force it.

## 4 · Connect the Webflow MCP (only if you'll edit the Designer)

Most "make this look different on the site" tasks don't need this at all —
see `CLAUDE.md`'s note on runtime (`blbd.js`) vs. structural (Designer)
changes. If you do need it: the Webflow MCP server is what actually lets
Claude Code create pages, insert components, and publish, headlessly. It's a
**per-person OAuth connection** — connect it yourself via `/mcp` in an
interactive Claude Code session (or your claude.ai connector settings if
you're using the web app), and separately ask to be added as a collaborator
on the Webflow site itself. Without that Designer/edit invite, the MCP
connection alone isn't enough — Webflow still checks your account's
permissions on the site.

## 5 · Open Claude Code and give it this first prompt

```bash
cd blbd
claude
```

Then paste:

> Read CLAUDE.md and SKILLS.md in this repo before doing anything else.
> Then tell me: what's already set up vs. missing in my local `.env.local`,
> whether the Webflow MCP is connected for this session, and what you'd
> need from me before making a real change.

That's it — Claude Code loads `CLAUDE.md` (the map: architecture, the
two-Webflow-sites gotcha, infra, known bugs already paid for) and `SKILLS.md`
(the recipes: ship a fix, cut an SDK version, edit a Webflow page, diagnose a
bad redirect) automatically because they live at the repo root. The prompt
above just makes it say out loud what it found, so you know it's oriented
before it touches anything.

## 6 · Where to go next

- Want to fix something in `blbd.js` (the SDK that runs on the live site)?
  → `SKILLS.md`, "Ship a fix to `blbd.js`".
- Want to add/change a Webflow embed page? → `SKILLS.md`, "Add or update a
  Webflow embed page".
- Full setup from scratch (Supabase/Stripe/Resend/Vercel/DNS) — you
  shouldn't need this, it's already done, but it's in `SETUP.md` if curious.
- Confused why something works the way it does? → `CLAUDE.md`'s "Known
  gotchas" and "Verification discipline" sections — save yourself from
  re-discovering a bug that already got fixed once.
