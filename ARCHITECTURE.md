# How this fits together

**Webflow is the site.** The founder paid for Webflow's CMS and design; that
is where the homepage, about, join, and blog live and get edited. Nothing here
replaces or duplicates that.

**This project is the membership layer** — a free, self-hosted replacement for
Memberstack. Webflow discontinued its native User Accounts feature, which left
the Starfire template's login, signup, and gating markup in place but dead.
We bring that markup back to life with Supabase behind it.

```
                 blbd.life  (Webflow — design + content, unchanged)
    ┌──────────────────────────────────────────────────────────────┐
    │  Home · About · Join · Blog · Contact                        │
    │  /log-in  /sign-up   ← Starfire's own forms, revived         │
    │  Blog post template  ← <div data-blbd="comments">            │
    │                                                              │
    │   <script src="app.blbd.life/blbd.js">  ← the whole install  │
    └───────────────────────────┬──────────────────────────────────┘
                                │ first-party fetch (CORS)
                                ▼
              ┌─────────────────────────────────┐
              │  Supabase                       │
              │  auth · profiles · goals ·      │
              │  comments · newsletter · RLS    │
              └─────────────────────────────────┘
                                ▲
                                │
    ┌───────────────────────────┴──────────────────────────────────┐
    │  app.blbd.life  (Next.js — the *app*, not a website)         │
    │  /dashboard /goals /profile /community /settings             │
    │  /checkout → Stripe · /admin/newsletter → Resend             │
    │  /api/* · /blbd.js                                           │
    └──────────────────────────────────────────────────────────────┘
```

## The dividing line

| | Webflow | This project |
| --- | --- | --- |
| Homepage, marketing, brand | ✅ owns it | never touches it |
| Blog authoring | ✅ owns it | reads only |
| Login / signup **markup** | ✅ owns it | supplies the behaviour |
| Identity, sessions, passwords | ✗ discontinued | ✅ Supabase Auth |
| Member data, goals, comments | ✗ | ✅ Supabase Postgres |
| Payments, tiers | ✗ | ✅ Stripe |
| Email | ✗ | ✅ Resend |

## Members never change domains

Every member-facing feature renders **inside Webflow pages** via a div and one
custom attribute — goals, profile, directory, account, comments. Nobody is
bounced to another domain to use the site.

| Webflow page | Attribute on an empty div |
| --- | --- |
| `/members` | `data-blbd="account"` |
| `/members/goals` | `data-blbd="goals"` |
| `/members/profile` | `data-blbd="profile"` |
| `/members/community` | `data-blbd="directory"` |
| Blog post template | `data-blbd="comments"` |

The only unavoidable hand-offs are to **Stripe** (hosted checkout and the
billing portal) — a payment processor, not a second site — and returning
straight back afterwards.

`app.blbd.life` is therefore a **service endpoint, not a website**: it serves
`/blbd.js`, the Stripe and newsletter APIs, and an admin newsletter composer.
It has no landing page — `/` redirects members to their dashboard and everyone
else to blbd.life. The React pages under `/dashboard`, `/goals` etc. remain as
a fallback surface but are not the intended path for members.

## Why a script and not iframes

The SDK (`public/blbd.js`) runs **first-party on blbd.life**. That matters:

- The session lives in blbd.life's own `localStorage`, so there is no
  third-party-cookie or storage-partition problem.
- Comments render inline in the Webflow page instead of in a cross-site
  iframe, so they inherit the page's typography and resize naturally.
- Gating happens before paint via attributes, so member-only content does not
  flash.

This is the same shape Memberstack uses, which is why it composes cleanly with
a Webflow site.

Verified from the live `blbd.webflow.io` origin: password login returns a
token, and authenticated reads of `profiles` and `blog_comments` both succeed
— Supabase's CORS defaults permit it, no proxy needed.

## Security model

Everything is enforced in Postgres, not in the browser:

- The anon key is public by design; RLS decides what it can reach.
- Comment insertion requires a paid tier (`has_paid_tier()` in the INSERT
  policy) — the SDK's upgrade prompt is a courtesy, not the control.
- Goal slots are capped per tier by a trigger.
- `is_admin` and `membership_tier` are reverted on self-update by a trigger;
  only the service role (Stripe webhooks, admin routes) can change them.

Tampering with the SDK in devtools gets you nothing.

## Content flow

Posts are authored once, in Webflow, and surface in two places:

1. **blbd.life/blog** — the public Webflow pages, with the comment div.
2. **app.blbd.life/blog** — a members' reading surface that *pulls* from the
   Webflow CMS Data API (`lib/webflow.ts`, ISR-cached 5 min).

Webflow remains the single source of truth; nothing is re-keyed. Publish in
Webflow and it appears in both within five minutes. Drafts stay hidden in both.
