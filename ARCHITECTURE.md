# How BLBD fits together

Current team direction: **2026-10-29**. See
[ENVIRONMENTS.md](ENVIRONMENTS.md) for exact beta and production targets.

**Figma is the design source. Webflow hosts the public website and CMS.
Vercel hosts the member/admin portal and backend. Supabase provides auth,
data, storage and database permissions.** Jonas designs in Figma, and the
team implements and reviews those designs in the corresponding beta surface.

```text
Figma frames, components, assets and interaction specs
    |
    +--> Webflow beta: public pages, marketing, blog / CMS
    |       |
    |       +--> links to beta Vercel portal
    |       +--> existing blbd.js widgets / native auth integrations
    |
    +--> Next.js on Vercel: member/admin portal, auth UI, APIs, SDK assets
                |
                +--> isolated beta Supabase: Auth, Postgres/RLS, Storage
                +--> Stripe: configured payment flows
                +--> Resend: configured auth mail / controlled admin mail
                +--> Webflow CMS reads for member blog
```

## Responsibility map

| Area | Implementation |
| --- | --- |
| Design explorations, components, responsive specs | Figma |
| Public home/about/join/blog, CMS authoring | Webflow |
| Member dashboard, goals, profiles, community, settings | Next.js on Vercel |
| Admin accounts, newsletter composition/review | Next.js on Vercel |
| Login/signup/recovery and member sessions | Vercel portal + Supabase Auth; preserve existing Webflow auth entry integrations |
| Data access and tier restrictions | Supabase RLS/triggers plus server-side authorization |
| Payments and tier updates | Stripe and verified server webhooks |
| Email dispatch | Server-side Resend integration with beta admin safeguards |
| Existing Webflow inline behavior | `public/blbd.js` and documented attributes |

The root app page is currently a service-status/install page; signed-in users
redirect to `/dashboard`. Portal UI is a supported implementation target.
Public marketing content remains in Webflow rather than being copied into
Next.js. The existing app blog reads Webflow CMS rather than authoring a
second copy of the same content.

## Existing integrations and historical direction

The project began as a replacement for Memberstack and Webflow's retired
native User Accounts functionality. The browser SDK supports legacy forms,
auth state, goals, profiles, comments and other inline widgets on Webflow.

A later experiment created native Webflow member/admin drafts and a portal
controller. **That migration is superseded by the October 29 decision to
keep the member/admin portal on Vercel.** Its files and draft IDs remain in
[webflow/portal-migration/README.md](webflow/portal-migration/README.md)
for maintenance/history. Do not delete existing integrations or publish that
migration during onboarding. Beta Webflow auth entry pages already have
published integrations that require care.

## Auth and security boundaries

- The Vercel portal uses first-party cookie sessions through the
  `src/lib/supabase/client.ts` and `server.ts` clients.
- The existing Webflow SDK executes on the Webflow origin and uses its own
  localStorage session. Cross-domain cookies/localStorage are not shared
  automatically. Review redirects, confirmation callbacks and login flows
  whenever navigation crosses between Webflow and Vercel.
- The existing comments iframe has its own embed client. It does not replace
  inline Webflow SDK support.
- Public Supabase anon keys are browser-visible; Postgres RLS/triggers enforce
  ownership, tier rules and protected profile columns.
- Admin routes verify sessions, email verification and current admin grants.
  The beta environment guard rejects the production Supabase project.
- The service-role client is server-only and bypasses RLS. It belongs in
  privileged server operations, never in design assets, client code or Webflow.
- Cross-origin beta admin bearer transport is an explicit opt-in for existing
  native consumers. It is separate from public API CORS and requires exact
  beta-origin and current-role checks. Preserve it without enabling it on
  a new workstation.
- Mail review, test-before-send, suppression, snapshots and idempotency are
  functional safeguards, not styling choices.

## Local and shared beta

A laptop runs `http://localhost:3000`. The checked-in env example provides
dummy values for preparation; functional sessions need beta credentials.
The shared Vercel beta branch uses its own Supabase project.
A personal Preview must be configured independently before use.

Figma/Webflow/Vercel MCPs give an agent access to provider tools using the
teammate's own account; they do not replace the app's env or member login.
See [MCP.md](MCP.md) and [SETUP.md](SETUP.md).
