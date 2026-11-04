# Native Webflow portal migration — archived direction

**Superseded 2026-10-29:** the member/admin portal stays in **Next.js on
Vercel**. Jonas's Figma designs should follow [../../DESIGN.md](../../DESIGN.md)
and [../../ENVIRONMENTS.md](../../ENVIRONMENTS.md). Public-site work stays in
Webflow beta. Do not continue this migration or publish its unfinished portal
drafts. Existing auth loaders and integrations remain deployed and need to be
preserved until a separately reviewed change replaces them.

The content below records the October 21–26 experiment and verification
history. Page destinations, parity gates and prior publish approvals describe
that work; they are not current instructions or standing release authorization.

Tracked in [issue #7](https://github.com/IllI/blbd/issues/7); dependent backend
work is in [PR #5](https://github.com/IllI/blbd/pull/5).

## Immutable environment boundary

Only write/publish Webflow site `693b4fc98a599c12cbf30e36` (BLBD BETA,
`blbd.webflow.io`). Production `69b9ae3792be3b49ef7eab96` / `blbd.life`
was preserved as the stable Coming Soon experience. Beta publication was
authorized for the recorded releases only, not future sessions. Confirm the
returned site ID before every mutation and obtain new release authorization.

## Historical presentation contract

- Convert headings, text, links, buttons, inputs, form groups, lists, cards,
  status panels, and repeated-item templates into native editable Webflow nodes.
- Do not insert a whole-page HtmlEmbed, iframe, React root, or generated widget
  as a substitute for native page content. Runtime scripts bind to native nodes
  using `data-blbd-*`, fill text safely, and clone designer-owned item templates.
- Shared member, administrator, and subscriber menus must be actual Webflow
  components, not copied HTML per page. Keep the existing marketing Navbar,
  Footer, CTA, Newsletter and other components unchanged.
- Namespace new styles `blbdp-*`. Do not edit global body, headings, or the
  designer's existing marketing styles. Define responsive Webflow breakpoint
  properties explicitly, preserving desktop styling.
- Preserve the currently working React beta portal as a fallback/test harness
  until each corresponding Webflow page passes functional and access tests.

## Historical page map / parity checklist

Desired folders are **Members**, **Admin**, and **Subscribers**. The existing
Admin folder (`693b4fcb8a599c12cbf30eb5`) also contains template styleguide,
changelog, and licences; those pages must not be overwritten or moved.

| Current service screen | Native Webflow destination | Required behavior |
| --- | --- | --- |
| `/dashboard` | `/members/dashboard` | Profile greeting, tier, goal totals/list, recent comments |
| `/goals` | `/members/goals` | Living/dying goal templates, add/edit/complete/delete, tier limits |
| `/profile` | `/members/profile` | Profile edits, avatar upload/preview and image preservation |
| `/profile/[id]` | `/members/member?user=...` | RLS-protected public member profile |
| `/community` | `/members/community` | Searchable member directory and profile links |
| `/settings` | `/members/settings` | Account/password changes, subscription/billing links, sign out |
| `/checkout` | `/members/checkout` | Existing Stripe hosted handoff, never Webflow ecommerce replacement |
| `/blog`, `/blog/[slug]` | Existing Webflow Blog + CMS templates | Reuse CMS content and native comment templates; preserve gating |
| `/admin` | `/admin/portal` | Verified-admin overview, invitations, audit and status |
| `/admin/accounts` | `/admin/accounts` | Paginated accounts, verified admin grants/revocation, last-admin protection |
| `/admin/newsletter` | `/admin/newsletter` | Compose, contacts/groups, snapshots, test/approve/send, pause/resume |
| `/login`, `/signup` | Existing `/log-in`, `/sign-up` | Preserve native forms; password signup and configured OAuth behavior |
| `/forgot-password` | Existing `/reset-password` | Real recovery email, no false success |
| Password recovery/settings | Existing `/update-password` | Safely consume auth callback and update password |
| `/auth/confirm`, `/auth/error` | Subscriber/member auth-status pages | Implicit and PKCE confirmation, safe redirects, meaningful errors |
| Newsletter subscribe | `/subscribers/join` | Rate-limited opt-in through the existing service |
| `/newsletter/confirmed` | `/subscribers/confirmed` | Genuine confirmation result, not unconditional success |
| `/newsletter/unsubscribe`, `/updates/unsubscribe` | `/subscribers/preferences` | Signed-token preferences; scanner GET never unsubscribes |
| Access denied | Existing `/access-denied` | Useful sign-in/return options; not the permission boundary |

Subscriber-only identities do not automatically become member accounts. The
preference page uses its signed unsubscribe link; do not require a newly created
member login to unsubscribe.

## Current verified state

- October 26: native email/password form transport is being restored separately
  from the social buttons. See `PASSWORD-AUTH.md` for the beta-only POST flow,
  first-party portal fallback and Webflow installation/verification gates.
  The separate password loader is now published only on beta's existing
  `/log-in` and `/sign-up` pages (2026-10-26T16:43:04.440Z), preserving both
  social loaders and designer markup/styles. Eighteen live backend checks and
  the published browser invalid-login flow passed. Portal drafts remain
  unpublished, and production is unchanged.
- MCP 2.2 headless pages/elements/components are available using the existing
  OAuth connection; the old local Data API token lacks `pages:read`.
- No site-specific agent instructions were found on beta.
- Beta site freeform head/footer code is currently empty. Do not assume the SDK
  is installed or that Webflow User Accounts still supplies authentication.
- The Designer bridge connected successfully. Created Members folder
  `6ad907477e710690862673d1` (`/members`) and Subscribers folder
  `6ad907482f404dbbd264f222` (`/subscribers`). No browser login was needed.
- Created unpublished native drafts:

  | Path | Page ID | Source |
  | --- | --- | --- |
  | `/members/dashboard` | `6ad905e4f5abb8b13b1666e2` | `dashboard.html` |
  | `/admin/portal` | `6ad915a3f97c6604b162ab2b` | `admin.html` |
  | `/admin/accounts` | `6ad915a333aab36f28d69e03` | `accounts.html` |
  | `/admin/newsletter` | `6ad915a42646ae220d05ed50` | `newsletter.html` |

- Shared native **BLBD Member Menu** component:
  `79c6873a-528a-ebbc-8cdf-1442dc1e47af`. Shared **BLBD Admin Menu**:
  `ef9e207c-b1cc-7e9d-93cf-ce83b30b87d9`, with instances on all three new
  administrator pages. Existing marketing components are unchanged.
- Inputs must be inside native Webflow Forms. The custom controller intercepts
  submission; these forms must not email Webflow notifications or store admin
  message bodies as Webflow form submissions.
- The WHTML importer discarded select-option settings. Use native audience
  radio controls and native group-card templates instead of relying on those
  lost options. Webflow Buttons are anchor nodes; the controller adds accessible
  button semantics, keyboard behavior, and explicit disabled state.
- Native behavior lives in `public/blbd-portal.js`; it changes text and clones
  designer-owned templates, never replaces whole-page markup. SDK native mode
  is opt-in, so existing site dropdown/sidebar behavior remains unchanged.
- Cross-origin admin transport is implemented but disabled unless
  `BLBD_WEBFLOW_ADMIN_ORIGIN=https://blbd.webflow.io` is set in isolated beta.
  It uses verified Supabase bearer tokens, the current database role, exact
  origin CORS, no cookies, and no production opt-in. First-party cookie CSRF
  protection remains unchanged. An invalid bearer never falls back to cookies.
- `bootstrap.js` is a registration template, NOT a script ready to paste with
  placeholder values. Registration must pin an immutable beta asset deployment,
  substitute only the beta PUBLIC anon key, and apply to explicit portal/auth
  pages. Never install globally or on production. No privileged keys belong here.
- Registered `blbdnativebetaportal` version `0.1.0` using the beta public anon
  key and immutable asset origin
  `https://blbd-ptl69i6pp-illi1s-projects.vercel.app` (commit `39d4582`). Verified
  page-scoped footer bindings on the four new drafts only. No global or existing
  auth-page script was changed at that checkpoint. Runtime registration alone
  does not publish pages.
- Subsequent social-auth restoration adds native Google/Yahoo groups to existing
  `/log-in` and `/sign-up` pages using the existing `Button` / `Is small` classes.
  Separate loader script `blbdbetasocialloader` v`0.1.0` is scoped only to those two
  pages; it does not replace password forms or change the membership SDK.
  See `SOCIAL-AUTH.md` and [provider setup issue #8](https://github.com/IllI/blbd/issues/8).
  Both real providers remain unconfigured; no end-to-end Google/Yahoo success
  is claimed. After explicit approval to release all pending beta changes,
  beta was published to `blbd.webflow.io` only at 2026-10-21 21:20:47.657 UTC,
  including pending blog/category edits. Published auth markup, loader integrity,
  CORS and controller behavior passed live DOM/script checks; existing password
  and consent inputs remain present. The four portal drafts remain unpublished
  (`/admin/newsletter` returns 404). Production was not changed. See
  `SOCIAL-AUTH.md` for the release evidence and remaining provider setup.
- A new page's registered-code GET/add returned 404 because the code block did
  not exist yet. The documented `set_page_scripts` upsert initialized that block;
  readback then succeeded. Do not infer a paid-plan requirement from this 404.
  This initialization is safe only after proving the page has no existing block;
  otherwise the bulk setter can remove scripts. Prefer single-script add/update
  for already initialized pages. See Webflow's official custom-code guide:
  https://developers.webflow.com/data/docs/working-with-custom-code
- Live beta verification after deployment: **15** cookie checks, **19** Webflow
  bearer checks, and **26** explicit sink-only group-send checks passed. The
  last run sent one preview and two group messages only to independently checked
  generated `@resend.dev` test sinks. Fixtures were removed. No real audience was
  emailed, and neither production DB nor production Webflow was mutated.
- The dashboard snapshot attempt failed with an empty Designer error, so visual
  responsive QA is still required. Do not claim a successful screenshot check.

## Historical integration gates — do not resume this migration

1. Members / Subscribers folders are created; the existing Admin folder is reused
   only for new portal pages. Existing template utility pages remain unchanged.
2. Inventory existing auth forms and CMS templates before any modification.
3. Build and inspect native node types and responsive styles; transform shared
   navigation into actual components and verify instances on each page.
4. Add script bindings without replacing designer markup; select beta Supabase
   `hfmjvbjyectxiszutwen` and the stable branch Preview backend explicitly.
5. Verify the separately tested cross-origin admin session transport live. Do NOT
   simply enable broad CORS, send cookies cross-site, trust a client `is_admin`,
   place service/Resend keys in Webflow, or weaken CSRF checks. A bearer transport
   must validate the session server-side, exact beta origin, verified email,
   current database role, and immediate revocation on every request.
6. Keep token confirmations, unsubscribe scanner safety, frozen send counts,
   test-before-send, suppression, idempotency and sender/footer requirements.
7. Run role, auth, profile/avatar, goals, subscription, and sink-only group-mail
   regression tests. Verify OAuth availability instead of enabling unconfigured
   providers. Payment keys remain an independent rollout requirement.
8. Publish only beta after complete page parity. Webflow publishes the entire
   beta site, including other pending designer changes; inventory these first.

This migration was **not completed** and is now superseded. The Vercel portal
is the intended member/admin surface; draft construction does not mean a
Webflow page has been connected or published.

## Verification commands

- `npm run test:native`: executes the shipped SDK and controllers against the
  native HTML blueprints; covers session readiness/refresh, legacy chrome
  preservation, template reuse, text safety, account edits, audience selection,
  test/approval gates, and pause/resume. No network or mail.
- `npm run test:admin`: database, server authorization, signed auth email,
  provider errors, newsletter workflow, exact-origin CORS and preflight tests.
- `node scripts/verify-beta-environment.mjs --webflow`: isolated live beta bearer transport checks;
  no email is sent. Default (without `--webflow`) also verifies cookie regression.
- `node scripts/verify-beta-environment.mjs --webflow --group-send`: explicit sink-only dispatch;
  independently checks the frozen snapshot contains ONLY this run's two exact
  Resend test addresses before sending. Never use a real audience for QA.
- `node scripts/audit-webflow-native.mjs <saved-MCP-tree.json>`: read-only
  native node/binding audit. Designer snapshots and post-publish browser checks
  are additional required evidence, not replaced by local blueprint tests.

Use the direct Node command for flags in PowerShell: the installed npm wrapper
was observed silently dropping `--webflow` after `npm run ... --`. A genuine
bearer run prints the four additional CORS/preflight/forged-token checks; do not
mistake a 15-check cookie-only run for Webflow verification.
