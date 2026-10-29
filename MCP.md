# Figma, Webflow, and Vercel connections

Workstation setup, checked against vendor documentation on **2026-10-29**.
Project context and environment IDs are in [ENVIRONMENTS.md](ENVIRONMENTS.md).

The repo's [.mcp.json](.mcp.json) shares three official remote HTTP server
definitions. It contains no tokens. Claude Code can load it from the cloned
repo; Jonas still reviews the project/server trust prompts and completes each
provider's OAuth login using his own account. Invitations and authorization
are per person and are not supplied by cloning.

| Server | Endpoint | Used for |
| --- | --- | --- |
| Figma | `https://mcp.figma.com/mcp` | Read the shared design file, frames, components, assets and design context |
| Webflow | `https://mcp.webflow.com/mcp` | Inspect/edit public beta pages, styles and CMS |
| Vercel | `https://mcp.vercel.com` | Inspect portal projects, beta deployments and logs |

The standard Webflow MCP endpoint can edit the BLBD beta site. Webflow's
separate experimental **Beta MCP server** is not the BLBD beta environment
and is not required for onboarding.

## Claude Code: desktop Code tab or terminal

Open a **local Code session** in the cloned repo, or run `claude` in its root.
Use `/mcp` to check all three servers and authenticate any that request login.
Restart the session after changing configuration. In a terminal with the
Claude Code CLI installed, `claude mcp list` also diagnoses configuration.

If the client doesn't load the checked-in definitions, the equivalent manual
commands below add local, per-user entries for the current project. Do not
add duplicates when `.mcp.json` already works:

```sh
claude mcp add --transport http figma https://mcp.figma.com/mcp
claude mcp add --transport http webflow https://mcp.webflow.com/mcp
claude mcp add --transport http vercel https://mcp.vercel.com
claude
# Inside Claude Code: /mcp, then authenticate each server.
```

An existing personal entry or plugin can override the repo entry; inspect
`/mcp` before changing anything. Figma also offers an official Claude Code
plugin with additional skills; use that or the manual server, avoiding a
duplicate connection. Remote Figma access does not require its desktop app.

## Ordinary Claude Desktop chat

Use the Code tab for local development and automatic `CLAUDE.md` context.
Ordinary chat does not become a local repo development session simply because
the repo was cloned. Provide the relevant files explicitly if using chat for
design discussion.

For chat, open **Settings → Connectors** (or **+ → Add connectors**), connect
Figma, Webflow and Vercel, and sign in. Where custom connectors are available,
use the endpoint table above. Select the beta Webflow site during OAuth.
Client, plan, and organization policies can affect connector availability;
use the vendor links below if the controls differ. Always verify tools inside
the actual Code/chat session that will do the work.

## Verify access without making changes

Ask Claude to report the result of a read-only check for each provider:

1. **Figma:** Jonas supplies a shared file/frame URL with its node ID. Read its
   design context and screenshot. The Figma file link is not yet recorded in
   this repo; get it from the team. No write to the canvas is needed to check access.
2. **Webflow:** call `webflow_guide_tool` first, discover the available tools,
   then list/read site `693b4fc98a599c12cbf30e36` and its pages. Confirm it is
   beta before any subsequent edit. Tool names and prefixes vary by connection.
3. **Vercel:** read team `illi1s-projects`, project `blbd`, and the latest
   **Preview / `feat/admin-portal`** deployment. Check the branch, commit,
   ready state and URL. Public documentation search alone does not prove
   authenticated access to the team's project. Don't export env values to chat.

The Webflow guide determines which operations need a live Designer/Bridge
connection. Open the **beta** Designer and its MCP Bridge App when requested;
some Data operations work without it. Do not assume all Designer operations
are headless, or install a global SDK just to fix a connection failure.

MCP OAuth, CLI login, and the app's `.env.local` are separate credentials.
Vercel MCP does not install Node/npm, link the CLI, or populate `.env.local`.
Webflow MCP OAuth does not supply `WEBFLOW_API_TOKEN` for server-side CMS reads.
Figma MCP does not deploy a design; Claude still implements it in the correct
surface and verifies the result.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Needs authentication / 401 | Reconnect in `/mcp` or Connectors and finish browser OAuth locally; never paste tokens or codes into chat |
| Connected but site/project/file missing | Check the signed-in account, team invitation, selected site and shared file permissions |
| Tools missing in Code | Confirm the session's repo root and MCP settings; restart; inspect duplicate local/plugin entries and organization restrictions |
| Webflow Designer connection error | Open the beta Designer/Bridge; use the connection link the tool actually returns |
| Preview returns access protection | Sign in using the team's granted access; don't disable deployment protection as a workaround |
| Authenticated portal still fails | Check beta app env and account verification; connector authentication is separate from member login |

Continue local code/design work when a provider is unavailable. Report exactly
which read failed; don't claim a connected MCP or a working login from config alone.

## Official references

- [Claude Code MCP configuration and project scope](https://code.claude.com/docs/en/mcp)
- [Claude Code desktop](https://code.claude.com/docs/en/desktop)
- [Figma remote MCP setup](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)
- [Webflow Claude Code setup](https://developers.webflow.com/mcp/installing/claude-code)
- [Webflow Claude Desktop setup](https://developers.webflow.com/mcp/installing/claude-desktop)
- [Vercel MCP setup](https://vercel.com/docs/agent-resources/vercel-mcp)
