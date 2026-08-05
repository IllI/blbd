# Wiring BLBD membership into Webflow

This replaces Memberstack. Webflow keeps every bit of design and content —
this just makes the site's existing (currently dead) membership features work
again, backed by Supabase.

Total install: **one script tag**, plus a few custom attributes on elements
you already have.

> **Building the login page or member pages from scratch?** See
> **[DESIGN-TEAM.md](./DESIGN-TEAM.md)** — it covers building forms and the
> goals board with your own layout and styling, no fixed markup required.

---

## Step 1 — the script tag (required, do this once)

**Use a versioned path (`/v6/blbd.js`), not the bare `/blbd.js`.** The bare
path is the in-progress "edge" copy — whatever's on the branch right now — and
can change under you. `/v6/blbd.js` is a frozen, cached-forever snapshot that
only changes when we deliberately cut a new version (see *Releasing a new
version* below). A real Webflow site should always point at a version.

Webflow → **Project Settings → Custom Code → Footer Code**, paste and Save,
then **Publish**:

```html
<script defer src="https://app.blbd.life/v6/blbd.js"
  data-supabase-url="https://ihghsacsxvibtwoiyjag.supabase.co"
  data-supabase-key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZ2hzYWNzeHZpYnR3b2l5amFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTUzMDMsImV4cCI6MjEwMDk3MTMwM30.jZs2B7J856qxkRUp4DTCLqiLME95pAztW_K2b4q3D_8"
  data-app-url="https://app.blbd.life"></script>
```

> `blbd-2` is currently on the bare, unversioned `/blbd.js` — that's fine, it
> already picks up every fix automatically with no Designer edit needed. No
> rush to switch it to `/v2/` unless you want the "never changes under you"
> guarantee; either way works.

> The anon key is **meant** to be public. Every table is protected by Postgres
> row-level security, so the key on its own grants nothing.

Before `app.blbd.life` DNS is live, swap both `app.blbd.life` values for
`https://blbd-life.vercel.app` (production) — or `https://blbd-staging.vercel.app`
if you're testing an unreleased change on `blbd-2` before it's promoted.

### Step 1b — the head snippet (stops the "Join button flash")

Also paste **[head-snippet.html](./head-snippet.html)** into Webflow →
**Site settings → Custom code → HEAD code**, then publish.

Without it, signed-in members see "Join BLBD" for a frame before the profile
avatar replaces it. That's unavoidable with the footer script alone: it's
`defer`, so it runs after the page has already painted — and even in the head
it would still have to await an async session check first.

The snippet is a few lines of synchronous JS that peek at `localStorage`
before first paint and stamp `data-blbd-auth="member" | "guest"` on `<html>`,
plus CSS that hides the nav signup CTA for members from frame one. `blbd.js`
re-stamps the same attribute with the authoritative answer once its async
check completes, so a wrong guess self-corrects. If `blbd.js` fails to load
entirely, a 5-second fallback restores the signed-out nav rather than
leaving a member with an empty gap.

It keys on the nav signup CTA automatically. To mark a signup CTA it can't
infer (different wording, or outside the nav), add the custom attribute
`data-blbd-join` (no value needed) — `blbd.js` honors the same marker.

### Releasing a new version

When `public/blbd.js` has changes ready to go live:

```bash
node scripts/release-sdk.mjs v2      # freezes the current edge copy as v2
git add public/v2 && git commit -m "Release SDK v2"
vercel --prod                        # deploy
# verify https://blbd-life.vercel.app/v6/blbd.js before telling anyone to switch
```

Existing Webflow sites on `/v1/blbd.js` are unaffected until someone
deliberately edits their footer code to point at `/v6/blbd.js` — a version
never changes out from under a site that's already pinned to it.

### Building the login page

`blbd-2` doesn't have a `/login` page yet, and — confirmed by checking the
Webflow CLI (`webflow sites --help`: only `list / get / domains / publish`,
nothing for pages) — there is no API that can create it for you. That one
step has to happen by hand in the Designer, everything else is a paste:

1. Webflow Designer → **Pages panel → + → Page**, name it **Login**, set the
   slug to **`login`** (matches the "Login here" link already on the signup
   page — zero extra edits).
2. Drop an **Embed** element onto the page.
3. Paste the entire contents of **[login-page.html](./login-page.html)** into
   it.
4. Publish.

That file is self-contained — its own CSS, doesn't touch or depend on
Memberstack's classes (which only exist while Memberstack's script is still
running — see note below), and its Google/Facebook buttons are fully wired.
They'll error with a clear "not enabled yet" message until those providers
are turned on in Supabase (SETUP.md §1c) — a real, working placeholder rather
than a dead button.

> **Why not reuse the signup page's `.ms-input` / `.ms-button` styling?**
> Those classes aren't in the site's own stylesheet — they only exist because
> Memberstack's script (`static.memberstack.com/scripts/v2/memberstack.js`)
> injects them at runtime. Once Memberstack is fully removed, that styling
> disappears. Building on top of it would mean the login page silently breaks
> the day Memberstack goes away — the whole point of this migration.

### The member portal pages

Mirrors the Vercel portal's structure: a Dashboard hub, plus a dedicated page
per feature — rather than one page carrying everything. Each of these was
built with the real shared Navbar component (not a hand-rolled nav strip)
when the Webflow MCP server was connected; see CLAUDE.md "Editing the live
Webflow Designer" if pushing one of these again via MCP instead of pasting.

| Page | Slug | Content | Source |
| --- | --- | --- | --- |
| Dashboard | `members` | Account summary + quick links out | `members-page.html` |
| Goals | `goals` | Full 5+5 goals board | `goals-page.html` |
| Profile | `profile` | Profile editor | `profile-page.html` |
| Community | `community` | Member directory (supporter+) | `community-page.html` |

None of these need custom CSS beyond page layout — the actual widgets
(`data-blbd="account"` / `"goals"` / `"profile"` / `"directory"`) ship fully
styled from `blbd.js`.

**If the Webflow MCP server isn't connected**, build these by hand — same
pattern for each:

1. **Pages panel → + → Page**, matching name/slug from the table above.
2. Drop the site's **Navbar** component onto the page (drag from the
   Components panel — reuse the existing one, don't rebuild it).
3. Drop an **Embed** element below it, paste the matching file's contents.
4. Publish.

### Login lands on `/members` automatically — no edit needed

The script's default landing page after signing in is `/members`, so once the
page above is live, this already works. (Override with a
`data-after-login="/some-other-page"` attribute on the script tag if a
different site wants something else — not needed here.)

### The nav account menu — automatic, no Designer work

As of SDK v4 this needs **zero** setup. On every page:

- **Signed out:** the "Join BLBD" nav button behaves normally (and a bare
  `href="#"` one is auto-routed to `/sign-up`).
- **Signed in:** the script hides the "Join"/"Sign up" nav button and drops a
  **profile-avatar dropdown** in its place — avatar (photo or initials) →
  Dashboard / Goals / Profile / Community / Log out. No attribute to add, no
  second link to build.

It finds the Join button by its text, scoped to the nav, and skips anything
you've explicitly tagged with a `data-blbd` attribute — so if you *do* still
want the older behaviors they win:

- `data-blbd="account-link"` on a link → relabels it "My Account" → `/members`
  when signed in (instead of the dropdown taking over that button).
- `data-blbd="anon-only"` / `"member-only"` on any element → hard show/hide by
  login state (see DESIGN-TEAM.md).

### Member pages are gated automatically

Also as of v4: a signed-out visitor who lands on `/members`, `/goals`,
`/profile`, or `/community` (by typing the URL or an old link) is redirected
to the login page and returned there after signing in. Nothing to configure.
Override the list with `data-member-paths="/members,/goals,…"` on the script
tag if the slugs differ. (Member *data* is already protected by the database
regardless — this is the front-door UX gate on top of that.)

### That alone fixes

| Page | What starts working |
| --- | --- |
| `/log-in` | The Starfire login form actually logs people in |
| `/sign-up` | The signup form creates real accounts (+ confirmation email) |

No changes to those forms are needed — the script finds them by the IDs
Webflow already generated (`#wf-log-in-email`, `#wf-sign-up-name`, etc.),
takes over the submit, and shows errors in Webflow's own error block so the
styling matches.

---

## Step 2 — custom attributes (optional, add what you want)

In the Designer: select an element → **Settings panel (gear)** → scroll to
**Custom attributes** → **+**.

### Show/hide by login state

| Name | Value | Effect |
| --- | --- | --- |
| `data-blbd` | `member-only` | Hidden unless signed in |
| `data-blbd` | `anon-only` | Hidden once signed in |
| `data-blbd` | `logout` | Clicking it signs the member out |

**Use it on the navbar:** put `data-blbd="anon-only"` on the *Log in* and
*Join* buttons, and `data-blbd="member-only"` on a new *Dashboard* / *Log out*
link. The nav then behaves like a real membership site.

### Show/hide by membership tier

| Name | Value | Effect |
| --- | --- | --- |
| `data-blbd-tier` | `supporter` | Visible to supporter and above |
| `data-blbd-tier` | `member` | Visible to member and above |
| `data-blbd-tier` | `founding` | Founding members only |

### Show the member's own details

Put `data-blbd-field` on any text element; its contents get replaced.

| Value | Shows |
| --- | --- |
| `display_name` | Their name |
| `email` | Their email |
| `membership_tier` | `free` / `supporter` / `member` / `founding` |

e.g. a heading reading "Welcome back" with `data-blbd-field="display_name"`
becomes "Kevin O'Neill".

### Pricing buttons

On each button on `/join`, add `data-blbd-checkout` with value `supporter`,
`member`, or `founding`. Clicking sends the member to Stripe checkout for that
tier (logging them in first if needed).

### Member features — rendered on your Webflow pages

Members never leave blbd.life. Drop an empty **Div block** on any Webflow page
and give it one of these attributes; the script renders the feature inside it,
styled to match the Starfire palette.

| Name | Value | Renders |
| --- | --- | --- |
| `data-blbd` | `goals` | The 5 Living / 5 Dying board — add, complete, delete |
| `data-blbd` | `profile` | Profile editor incl. avatar upload |
| `data-blbd` | `directory` | The public member directory |
| `data-blbd` | `account` | Email, tier, manage-billing, log out |
| `data-blbd` | `comments` | Comment thread for the current blog post |

**Suggested page setup in Webflow** (all normal Webflow pages you design):

| New page | Div attribute | Who sees it |
| --- | --- | --- |
| `/members` (dashboard) | `data-blbd="account"` | members |
| `/members/goals` | `data-blbd="goals"` | members |
| `/members/profile` | `data-blbd="profile"` | members |
| `/members/community` | `data-blbd="directory"` | supporter+ |

Each widget shows its own "log in" or "upgrade" prompt to anyone who isn't
entitled, so you don't need to build those states yourself.

### Comments on blog posts

Open the **Blog Post CMS template**, drop an empty **Div block** at the bottom
of the post body, and give it:

| Name | Value |
| --- | --- |
| `data-blbd` | `comments` |

The script renders the thread inline — real comments, replies, live updates,
and a "log in to comment" prompt for guests. The post slug is read from the
URL, so this one div serves every post.

> This replaces the older iframe approach (`comment-embed.html`), which is now
> unnecessary: because the script runs first-party on blbd.life, there is no
> third-party-cookie problem to work around. Use the div, not the iframe.

---

## Step 3 — nav cleanup

The navbar's **Log in** link currently points at `#`. Set it to `/log-in`.
Add `data-blbd="account-link"` to it and the script will retarget it to the
member dashboard (and relabel it "Dashboard") once someone is signed in.

---

## What still lives in the portal (`app.blbd.life`)

Things that are genuinely an *app*, not a marketing page:

- Dashboard, the 5+5 goals board, profile editor, member directory
- Account settings and Stripe billing management
- Admin newsletter composer

Everything public — home, about, join, blog — stays in Webflow, authored by
you, and is never duplicated.

---

## Testing checklist

1. Publish Webflow, open `/sign-up`, create an account → confirmation email.
2. Confirm, then log in at `/log-in` → you land back on the site, signed in.
3. Open the browser console and run `BLBD.profile` — you should see your row.
4. Add `data-blbd="member-only"` to something and confirm it appears only
   when signed in.
5. Open a blog post → the comment box appears (upgrade prompt on the free
   tier, which is correct).

## Troubleshooting

**Nothing happens on the forms.** Check the console for `[blbd]`. The most
common cause is the script tag being in *Header* code instead of *Footer*, or
the site not being republished.

**"Failed to load blbd.js".** Vercel Deployment Protection is still enabled on
the portal project — disable it (Vercel → project → Settings → Deployment
Protection), or the script is not publicly fetchable.

**Login says "Email not confirmed".** Supabase → Authentication → Providers →
Email has *Confirm email* on. Either confirm via the emailed link or turn that
setting off while testing.
