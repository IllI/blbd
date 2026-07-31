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
3. Tell the user exactly what changed and ask them to re-paste the file's
   full contents into the existing Embed element, then Publish. **This step
   cannot be done by Claude** — no Webflow API can touch page content (see
   CLAUDE.md). Don't imply otherwise or claim to have "added" something to a
   live page without verifying it first.
4. After they say it's done (or some time later), verify with curl using a
   precise tag match, e.g.:
   ```bash
   curl -s -L https://blbd-2.webflow.io/members | grep -o '<nav class="blbd-mini-nav">'
   ```
   An empty result means either it hasn't been pasted yet, or Webflow/browser
   caching is showing something stale — say which you think it is rather
   than guessing; a second curl a minute later usually resolves cache
   ambiguity.

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

1. **Never** use `mcp__Claude_Browser__*` on this project — confirmed to
   crash Claude Code, twice, by the user.
2. `mcp__claude-in-chrome__*` is a different, separate tool (drives the
   user's real, already-logged-in Chrome) that was not connected as of last
   check. Worth a single `tabs_context_mcp` call at the start of a session
   that needs real Designer interaction, to see if it's since been set up —
   if the extension isn't installed you'll get a clean "not connected"
   message, not a crash. If it works, it's the only path to Claude driving
   actual Designer UI clicks (adding attributes, duplicating elements) —
   still worth trying cautiously (read-only action first) before relying on
   it for real edits.
