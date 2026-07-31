# Building membership pages in Webflow

This is for whoever is designing the login, signup, and member pages in the
Webflow Designer. You do not need to know anything about Supabase, APIs, or
the backend — you build normal Webflow elements, add a few **custom
attributes**, and the page comes alive.

Custom attributes are added in the Designer: select an element → **Settings
panel (gear icon)** → scroll to **Custom attributes** → **+**.

One rule throughout: **build it however you want.** Any layout, any classes,
any breakpoints. The attributes below are the only contract — everything else
is yours.

---

## Login and signup forms

Build a normal Webflow `Form Block` with whatever fields and styling fit the
brand. Then tag it:

| On this element | Attribute | Value |
| --- | --- | --- |
| The `<form>` | `data-blbd-form` | `login` or `signup` |
| Email input | `data-blbd-input` | `email` |
| Name input *(signup only)* | `data-blbd-input` | `name` |
| Password input | `data-blbd-input` | `password` |
| Terms checkbox *(signup only)* | `data-blbd-input` | `consent` |
| Error/success text element | `data-blbd-input` | `message` |

That's the whole form. No IDs, no required classes. The `message` element can
be a plain `<div>` styled however errors should look on this site — it's
hidden until there's something to say, then filled with the message text.

**Don't** wire the submit button to anything — leave it a plain submit
button. The script intercepts the form's submit event.

---

## The 5 Living / 5 Dying goals board

Design **one goal card** and **one empty-slot card**. The script clones each
one as needed and fills them in — you never see more than the one of each you
designed, in the Designer.

```
[data-blbd="goals"]                    ← the whole board container
  [data-blbd-list="living"]            ← the Living column
    [data-blbd-template="goal"]        ← design ONE card; hidden automatically
      [data-blbd-bind="title"]
      [data-blbd-bind="description"]
      [data-blbd-bind="target_date"]
      [data-blbd-when="is_completed"]  ← e.g. a checkmark, shown only when done
      [data-blbd-action="toggle"]      ← a button: mark done / not done
      [data-blbd-action="delete"]      ← a button: delete this goal
    [data-blbd-template="slot"]        ← design ONE empty slot; hidden automatically
      [data-blbd-bind="position"]      ← shows "1", "2", etc.
      [data-blbd-action="add"]         ← a button: opens the add-goal form
  [data-blbd-list="dying"]             ← the Dying column — same shape again
    [data-blbd-template="goal"] ...
    [data-blbd-template="slot"] ...
```

Notes:
- `data-blbd-bind` puts the field's text into that element — put it on a text
  block, not the card itself.
- `data-blbd-when="is_completed"` shows the element only for completed goals.
  Prefix with `!` to invert: `data-blbd-when="!is_completed"` shows only for
  goals not yet done.
- Free-tier members are capped at 2 goals per column; slots 3–5 render with
  `data-blbd-locked="true"` on the slot element, so you can style a "locked"
  state (grey it out, add a lock icon) purely in CSS from that attribute.
- Only one card and one slot design are needed per column — build the "empty"
  state once, the "filled" state once, done.

**Simplest possible version:** skip all of this and just add
`data-blbd="goals"` to an empty div. You get a working, pre-styled board
immediately — useful for placeholder pages before the real design is ready.

---

## Everything else — no templating yet, but restyleable

These render a complete pre-built widget into an empty div. They match the
Starfire palette by default; override the CSS classes below from the Webflow
site's own stylesheet (Site Settings → Custom Code, or a `<style>` embed) if
they need to look different. Full per-element templating for these — same
pattern as goals — is a natural next step if wanted.

| Attribute | Renders | Key CSS classes to override |
| --- | --- | --- |
| `data-blbd="profile"` | Profile editor + avatar upload | `.blbd-profile`, `.blbd-in`, `.blbd-avatar` |
| `data-blbd="directory"` | Member directory | `.blbd-dir`, `.blbd-dir-card` |
| `data-blbd="account"` | Email, tier badge, billing, log out | `.blbd-account`, `.blbd-tier` |
| `data-blbd="comments"` | Blog comment thread | `.comment-list` … see `blbd.js` source |
| `data-blbd="login-form"` | Full pre-built login form (no Form Block needed) | `.blbd-auth`, `.blbd-in` |
| `data-blbd="signup-form"` | Full pre-built signup form | `.blbd-auth`, `.blbd-in` |

---

## Gating and personalization — works anywhere on any page

| Attribute | Effect |
| --- | --- |
| `data-blbd="member-only"` | Element hidden unless signed in |
| `data-blbd="anon-only"` | Element hidden once signed in |
| `data-blbd="logout"` | Click signs the member out |
| `data-blbd-tier="supporter"` | Hidden unless tier ≥ supporter (also `member`, `founding`) |
| `data-blbd-field="display_name"` | Text replaced with the member's name (also `email`, `membership_tier`) |
| `data-blbd-checkout="supporter"` | Click starts Stripe checkout for that tier |

**Nav bar tip:** put `data-blbd="anon-only"` on the *Log in* / *Join* links and
`data-blbd="member-only"` on a *Dashboard* / *Log out* link. Bare `<a href="#">`
buttons whose text says "Join", "Sign up", "Log in", etc. are also
auto-routed to the right page even without any attribute — but an explicit
`data-blbd="anon-only"` / `"member-only"` pairing looks better once there are
two states to show.

---

## Testing a page

1. Publish the site.
2. The script itself updates within ~5 minutes of any backend change without
   a republish — but attribute changes on your elements need a normal
   publish, same as any other Webflow edit.
3. Hard-refresh (Ctrl/Cmd+Shift+R) if something looks stale — that's the
   script's own cache, not your publish.
