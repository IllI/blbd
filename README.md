# BLBD Member Portal

The membership backend for **Better Living Better Dying** ([blbd.life](https://blbd.life)),
deployed at `app.blbd.life`. Next.js + Supabase + Stripe + Resend. Replaces the
discontinued Webflow native memberships used by the Starfire template.

- **Setup & deploy:** [`SETUP.md`](./SETUP.md)
- **Schema notes:** [`supabase/README.md`](./supabase/README.md)
- **Webflow snippets:** [`webflow/`](./webflow/)

## What's here

| Area | Route(s) | Notes |
| --- | --- | --- |
| Auth | `/login`, `/signup`, `/forgot-password`, `/auth/callback` | Email/password + optional Google OAuth |
| Dashboard | `/dashboard` | Goals + comment summary, tier status |
| Goals | `/goals` | 5 living / 5 dying, drag-reorder, tier-gated slots |
| Profile | `/profile`, `/profile/[id]` | Avatar upload, public profiles |
| Community | `/community` | Paginated member directory (paid tiers) |
| Membership | `/checkout`, `/settings` | Stripe Checkout + Customer Portal |
| Comments | `/embed/comments?slug=…` | Frameable widget, Supabase Realtime |
| Newsletter | `/api/newsletter/*`, `/admin/newsletter` | Resend, double opt-in |
| Stripe | `/api/stripe/*` | Checkout, portal, signed webhook |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Supabase (`@supabase/ssr`) ·
Stripe · Resend · vanilla CSS (no Tailwind), Starfire palette in
`src/app/globals.css`.

## Develop

```bash
npm install
cp .env.local.example .env.local   # fill in real values — see SETUP.md
npm run dev
```

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build (also full type-check)
- `npm run lint` — ESLint
- `node scripts/release-sdk.mjs vN` — freeze `public/blbd.js` as a pinned
  `public/vN/blbd.js`. Real Webflow sites should link a versioned path, never
  the bare `/blbd.js` (see `webflow/INSTALL.md`).

## Deploying

Pushing to `main` on [github.com/IllI/blbd](https://github.com/IllI/blbd)
auto-deploys to Vercel (project `blbd`) — no manual `vercel --prod` needed
anymore. Other branches get their own preview deployment URL.

`app.blbd.life` (once its DNS record is added — see `SETUP.md`) always points
at the latest Production deploy automatically. The interim testing aliases
`blbd-life.vercel.app` / `blbd-staging.vercel.app` do **not** — they only move
when explicitly re-pointed with `vercel alias set <deployment> <alias>`,
since they're ad-hoc `.vercel.app` aliases, not a real project domain.

## Architecture notes

- **Supabase clients** in `src/lib/supabase/`: `client` (browser, cookies),
  `server` (RSC/route handlers), `admin` (service role, server-only), and
  `embed` (localStorage, for the cross-site iframe).
- **Security is enforced in the database**, not just the UI — RLS policies and
  triggers gate comments and goal slots by tier. See `supabase/README.md`.
- **The comment iframe** authenticates inside the frame using a localStorage
  session, because third-party cookies are blocked cross-site.
- **Stripe tier changes** flow only through the webhook (`applyTier`), keeping
  one source of truth.
