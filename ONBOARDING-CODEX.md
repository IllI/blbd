# BLBD onboarding with Codex

The shared setup and environment rules are in [ONBOARDING.md](ONBOARDING.md),
[ENVIRONMENTS.md](ENVIRONMENTS.md), [SETUP.md](SETUP.md), and
[DESIGN.md](DESIGN.md). Jonas's primary path uses Claude; use this alternative
only if you prefer Codex. Current project direction is identical for both agents.

Install/start Codex using the current
[official CLI guide](https://learn.chatgpt.com/docs/codex/cli).
Open the cloned beta repository root. Codex reads
[AGENTS.md](AGENTS.md), which directs it to the remaining project context.
See [official AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Use the same beta branch clone, `npm ci`, tracked env example and local app
steps from the shared onboarding guide. Dummy values do not supply working
auth/data. The member/admin portal stays on Vercel, public-site work stays in
Webflow beta, and local mail stays off.

The same required contribution bootstrap is in
[CONTRIBUTING.md](CONTRIBUTING.md): GitHub CLI sign-in, username discovery,
writable fork/upstream remotes and a local design branch. Use
`npm run setup:workstation`; see [OWNER-SETUP.md](OWNER-SETUP.md) for advance
owner configuration. Private Vercel project access is optional for this path.

## Provider connections

The repo's `.mcp.json` is for Claude Code. For Codex CLI, configure the same
official servers with Codex's MCP settings:

```sh
codex mcp add figma --url https://mcp.figma.com/mcp
codex mcp add webflow --url https://mcp.webflow.com/mcp
codex mcp add vercel --url https://mcp.vercel.com
codex mcp login figma
codex mcp login webflow
codex mcp login vercel
codex mcp list
```

Inspect existing entries first to avoid duplicates. Use your own account and
complete browser OAuth; invitations are still required. Provider availability
depends on the client/account. See
[official Codex MCP guidance](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
and [MCP.md](MCP.md) for the provider-specific access checks and vendor links.
Do not reuse another teammate's config or tokens.

Ask the agent to read the shared setup documents, verify needed design
connections and any authorized Vercel tools with read-only calls, and report
what works versus missing access without showing secret values. The production boundary and review/release
requirements in [AGENTS.md](AGENTS.md) apply here too.
