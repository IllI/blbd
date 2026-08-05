# BLBD — recipes

Step-by-step procedures for the things that come up repeatedly on this
project. Read `CLAUDE.md` first for the why; this file is just the how.

All commands assume `cd` into this directory (`blbd-portal/`) first, and Bash
(not PowerShell) for anything piping into `vercel env add` (see the CRLF
gotcha in CLAUDE.md).

---

## Ship a fix to `blbd.js`

1. Edit `public/blbd.js`.
2. `node --check public/blbd.js` — catches syntax errors before wasting a
   deploy cycle.
3. `npm run build` — full project build + typecheck. Fix anything it flags.
4. `git add -A && git commit -m "..."` then `git push`.
5. Wait for the auto-deploy:
   ```bash
   for i in 1 2 3 4 5 6 7 8; do
     LINE=$(vercel ls 2>&1 | grep -m1 "https://blbd-")
     echo "attempt $i: $LINE"
     echo "$LINE" | grep -q "Ready" && [ "$i" -gt 2 ] && break
     sleep 10
   done
   ```
6. Re-alias the testing URLs to the new deployment (skip once `app.blbd.life`
   DNS is live — that domain tracks automatically):
   ```bash
   vercel alias set <new-deployment-url> blbd-life.vercel.app
   vercel alias set <new-deployment-url> blbd-staging.vercel.app
   ```
7. **Verify the fix actually reached the site that matters.** `blbd-2`'s
   footer script points at the bare, unversioned `/blbd.js`, so step 6 alone
   is usually enough — no Webflow-side action needed:
   ```bash
   curl -s https://blbd-life.vercel.app/blbd.js | grep -q "<the specific string that changed>"
   ```
   Use a precise, unique string — see "Verification discipline" in
   `CLAUDE.md` for why a loose substring match has already produced two false
   readings this project.

## Cut a new pinned SDK version

Do this when a change needs to be safe to depend on forever (a site pinned
to `/v2/blbd.js` should never see it change under them).

```bash
node scripts/release-sdk.mjs v4      # refuses to overwrite an existing vN
```

Then update the two places that recommend a version number for new installs:
- `webflow/INSTALL.md` (the `<script src=...>` snippet, in a couple of spots)
- `src/app/page.tsx` (`snippet` variable, the status page's copy-paste block)

Commit, push, wait for deploy (steps above), then verify before telling
anyone to point a footer script at the new version:
```bash
curl -s https://blbd-life.vercel.app/v4/blbd.js | grep -q "<expected string>"
```

## Add or update a Webflow embed page (login, members, future pages)

1. Edit the relevant file in `webflow/` (e.g. `members-page.html`).
2. Commit + push (these files aren't served by the app — no Vercel deploy
   needed, but commit anyway so the repo stays the source of truth).
3. If the Webflow MCP tools are available this session (see the next recipe),
   the HtmlEmbed's content can be pushed directly — `data_element_settings_tool
   > set_settings` on the Embed element, or `data_scripts_tool >
   set_page_freeform_code` for footer/head code. Otherwise: tell the user
   exactly what changed and ask them to re-paste the file's full contents
   into the existing Embed element, then Publish.
4. Verify with curl using a precise tag match, e.g.:
   ```bash
   curl -s -L https://blbd-2.webflow.io/members | grep -o '<nav class="blbd-mini-nav">'
   ```
   An empty result means either it hasn't been pasted/pushed yet, or
   Webflow/browser caching is showing something stale — say which you think
   it is rather than guessing; a second curl a minute later usually resolves
   cache ambiguity. Remember the site has to be **published** (not just
   edited in draft) before curl against the live domain will ever see it.

## Edit the live Webflow Designer via the Webflow MCP server

Only if the user has it connected this session — check with `ToolSearch`
for tools like `data_pages_tool` / `data_element_tool` / `data_component_tool`
(prefixed `mcp__<connection-id>__*`; the id is per-connection, don't hardcode
it). If present, **call `webflow_guide_tool` first** — it returns the
authoritative, versioned usage rules and is more reliable than remembering
them here.

**If the harness says "The following MCP servers require authentication:
webflow"** the connection dropped its OAuth and this (non-interactive) session
can't restore it. Do not ask for tokens/codes. Tell the user to re-authorize
(claude.ai connector settings, or `/mcp` in an interactive session). Then
reconsider whether the task even needs the Designer — see the next paragraph.

**Before reaching for these tools, ask: is this actually a Designer change?**
"Show a profile menu when logged in / hide Join / gate a page / relabel a
link" are all **per-visitor runtime** behaviors — same HTML for everyone,
decided in the browser. Those belong in `blbd.js` (ship via the git pipeline,
no Webflow auth needed), NOT in the Designer. Use the MCP only for structural,
same-for-every-visitor changes: a new page, a shared component instance placed
on a page, a real static element. (Example that correctly used the SDK, not
the MCP: the nav account dropdown + member-page gating in v4.)

Typical flow for "make this page match the rest of the site" tasks (e.g.
inserting the shared navbar onto a bare Embed-only page):

1. `data_sites_tool > list_sites` — get the site id (there are two sites this
   project touches; confirm which one).
2. `data_pages_tool > list_pages` — get the target page's id by slug.
3. `data_component_tool > query_components` (keywords like `["nav"]`) —
   find the *existing* shared component rather than rebuilding one by hand.
4. `data_element_tool > get_all_elements` (depth 2 is usually enough) — see
   what's actually on the page and get the exact element id to anchor against.
5. `data_component_tool > insert_component_instance` (or
   `data_component_builder`) with `creation_position: "before"` against the
   existing content's element id — inserts the real component instance, not
   a copy, so it never drifts from the rest of the site.
6. Re-run `get_all_elements` to confirm the tree looks right. This step
   doesn't need a live Designer session — it's a plain data read.
7. `element_snapshot_tool` for a visual check **is** live-session-only — if
   it fails with "Unable to connect to Webflow Designer," that's expected
   when the user doesn't have the Designer open with the MCP companion
   connected. The error includes a real connection link
   (`https://<shortname>.design.webflow.com?app=...`) — hand it back to the
   user as a markdown link rather than skipping the visual check silently.
8. **Stop and ask before publishing.** `data_sites_tool > publish_site`
   defaults to the whole site, not just the one page just edited — call this
   out explicitly, since the user may not expect other draft changes to go
   out too. Only Enterprise sites can scope a publish to one page
   (`pageId` param).
9. After confirmed + published, verify with curl the same way as any other
   Webflow change (see the recipe above) — the MCP tools return "success"
   for the draft-state write; a curl against the live domain is what proves
   it's actually visible to a real visitor.

## Diagnose "a redirect/link goes to the wrong place"

Almost always a mismatch between a `CFG.*Path` default in `blbd.js` and the
Webflow site's real page slugs. Check both sides:

```bash
# What the live script currently assumes (defaults, since data-* overrides
# are rare so far):
curl -s https://blbd-life.vercel.app/blbd.js | grep -A1 "loginPath:\|signupPath:\|membersPath:\|afterLogin:"

# What actually exists on the Webflow site:
for p in "" sign-up login members join blog contact; do
  echo "/$p -> $(curl -s -o /dev/null -w '%{http_code}' -L https://blbd-2.webflow.io/$p)"
done

# What the live footer script tag actually overrides, if anything:
node -e "
const https = require('https');
https.get('https://blbd-2.webflow.io/', {headers:{'User-Agent':'Mozilla/5.0'}}, res => {
  let d=''; res.on('data', c => d+=c);
  res.on('end', () => console.log((d.match(/<script[^>]*blbd\.js[^>]*>[\s\S]*?<\/script>/)||['NOT FOUND'])[0]));
});
"
```

If the default is wrong for the *currently active* site (`blbd-2`), just fix
the default in `blbd.js` (ship-a-fix recipe above) rather than asking the
user to add another `data-*` override — every override is one more thing
they have to remember to paste. This has been the resolution both times this
came up (`afterLogin`, `loginPath`).

## Rotate a leaked credential

Anything pasted into chat is presumed exposed. This project has done this
before with a Webflow API token — rotate in the source dashboard first, then
push the new value:

```bash
# Webflow token: Site Settings → Apps & Integrations → API access → regenerate.
printf '%s' 'NEW_TOKEN' | vercel env add WEBFLOW_API_TOKEN production --force

# Any other key: same pattern, correct env var name.
```
No redeploy needed for env-var-only changes to take effect on *new*
invocations, but trigger one anyway (`git commit --allow-empty -m "..." && git push`)
to be sure server-side code picks it up immediately rather than waiting for
natural traffic.

## Set up Stripe / Resend (still pending as of last session)

Both are currently placeholder keys (`sk_test_placeholder` etc.) in Vercel
env. See `SETUP.md` sections 2–3 for exact dashboard steps. Once real keys
exist, push them the same way as any env var (see rotate-a-credential
recipe), then flip `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH` / the Stripe price ID
vars as needed and redeploy.

## Before trying browser automation

**Check for the Webflow MCP server first** (see "Edit the live Webflow
Designer" above) — if it's connected, it's a better path than any of the
below for actual Designer edits: headless, doesn't need a live browser tab,
and edits real elements/components directly.

1. **Never** use `mcp__Claude_Browser__*` on this project — confirmed to
   crash Claude Code, twice, by the user.
2. `mcp__claude-in-chrome__*` is a different, separate tool (drives the
   user's real, already-logged-in Chrome) that was not connected as of last
   check. Lower priority now that the Webflow MCP server covers the main use
   case, but still worth a `tabs_context_mcp` call if a task needs something
   the Webflow MCP genuinely can't do (e.g. something requiring actual mouse/
   keyboard interaction rather than a structured API call).
