# Beta Google / Yahoo sign-in

**Context update (2026-10-29):** the member/admin portal stays on Vercel.
This document records existing beta Webflow auth controls and outstanding
provider setup. Preserve deployed loaders; historical publish approvals here
are not standing authorization for a new session. See
[../../ENVIRONMENTS.md](../../ENVIRONMENTS.md) and
[../../DESIGN.md](../../DESIGN.md) for current direction.

## Git evidence and current blocker

- `d54d275` introduced Google/Facebook UI with optional configuration flags.
- `af1af69` explicitly recorded Yahoo as a requirement, not a verified provider.
- `d9842e4` recorded Google/Yahoo as not enabled in the restored Auth backend.
- `1bedb3d` restored themed Google/Facebook embeds and explicitly recorded Yahoo
  as unimplemented. It did not contain a working Yahoo configuration to restore.
- The October 21 audit found Google disabled with no client ID or secret on
  either project. Beta custom-provider inventory was empty. Neither old Google
  nor Yahoo credentials are recoverable from the tracked implementation.

The new controls are wired, **not enabled sign-in providers**. Do not claim an
end-to-end provider login has passed until the following setup and real account
tests are complete. No fake client IDs/secrets, provider flags, or bypassed
email verification are used to make the buttons appear functional.

## Native Webflow presentation

Only beta `693b4fc98a599c12cbf30e36` is edited:

| Page | Page ID | Native source |
| --- | --- | --- |
| `/log-in` | `693b4fcb8a599c12cbf30eb7` | `social-login.html` |
| `/sign-up` | `693b4fcb8a599c12cbf30eb8` | `social-signup.html` |

Both groups use the **existing** `Button` / `Is small` style chain (green,
rounded, matching the password submit buttons). Existing theme definitions,
navbar, footer, legacy native auth node, email/password inputs and consent
checkboxes are not changed or replaced. Only group spacing has new namespaced
styles in `social.css`.

The older Webflow User Accounts element is opaque to the headless native tree
API. The new native group is an editable sibling in the Designer. On the
published page, `public/blbd-social.js` moves that existing group into the form
just before its footer. It does not generate HTML or intercept password submits.
Signup social clicks require the existing privacy checkbox. No marketing consent
is inferred from OAuth. The controller is scoped to the exact beta origin.

The controller reads real availability from `/api/auth/providers`; unavailable
buttons announce setup requirements and do not start a broken provider redirect.
The server independently checks availability, so changing browser attributes
does not bypass configuration. A readiness response contains booleans only.

## First-party PKCE flow

```
Native Webflow button → beta backend /auth/social?provider=google|yahoo
  → Supabase authorize → provider → Supabase → existing /auth/callback
  → beta portal dashboard (or safe requested portal path)
```

This intentionally uses the working beta portal while the full native portal
cutover is incomplete. First-party PKCE cookies are established on its stable
host; immutable deployment URLs redirect there before creating the verifier.
No JWT is copied between origins or placed in a query string. Existing callback
code exchanges the code; existing database verification, role and membership
checks remain the security boundary. Both login and signup use the provider's
standard sign-in-or-create flow; no custom user/session minting is added.

## Remaining provider setup — beta only

Open Supabase project **blbd-beta / `hfmjvbjyectxiszutwen` → Authentication →
Sign In / Providers**. Do not configure production or paste secrets into chat.

1. **Google:** enable Google and enter a Web Application OAuth client ID/secret.
   Register `https://hfmjvbjyectxiszutwen.supabase.co/auth/v1/callback` in that
   client's authorized redirect URIs. Keep email verification and nonce checks.
2. **Yahoo:** add a **custom OIDC provider** with identifier **`custom:yahoo`**,
   name Yahoo, issuer **`https://api.login.yahoo.com`**, and the Yahoo app's client
   ID/secret. Request `openid`, `email`, `profile`; require email. Copy the exact
   callback URL shown by Supabase into the Yahoo app. Keep PKCE enabled and
   `skip_nonce_check=false`. Yahoo discovery advertises S256 support.
3. The beta backend callback is already in beta Auth's redirect allowlist.
   No new Vercel public flag is required for these native controls; readiness is
   checked against actual provider configuration on each visit.
4. Test Google and Yahoo separately using existing and new accounts. Verify
   cancellation/error recovery, safe `next`, privacy acknowledgement, verified
   admin access, and existing profile/avatar preservation. Neither mocked tests
   nor an authorize redirect proves the provider login itself succeeded.

References: [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google),
[custom OAuth/OIDC setup](https://supabase.com/docs/guides/auth/custom-oauth-providers),
[Yahoo discovery](https://api.login.yahoo.com/.well-known/openid-configuration).

## Validation / installation

Run `npm run test:social`, `npm run test:native`, existing admin/auth-email tests,
and `npm run build`. Verify `/api/auth/providers` returns only readiness booleans,
correct exact-origin CORS, and `no-store`; verify both unconfigured start routes
give the explicit setup error without creating any account or session.

Register `social-bootstrap.js` as an inline script. Its external controller uses
an immutable beta Preview URL, the actual SHA-256 integrity hash, and anonymous
CORS. The API accepts only `data-*` custom attributes on applied scripts, so do
not try to set `crossorigin`/`defer` through its attributes map. Apply the loader
**only to the two auth pages**, not to the entire site. Read back bindings
and verify no existing script was removed. Beta publish is the only authorized
publish; production remains the stable Coming Soon site.

Installed and read back on the two auth pages only: registered script
`blbdbetasocialloader`, version `0.1.0`, asset
`https://blbd-2y5wswke8-illi1s-projects.vercel.app/blbd-social.js`, SHA-256
`Quj+jGjTtGNH7rxzBecMfR4HreW4kietGfT/ENz3+so=`, with anonymous CORS. Global
freeform code remains empty and the four unpublished portal draft scripts are
unchanged. Native group IDs: login `e4ea5403-a500-1ae2-8df8-e4a5843c1f03`,
signup `6c0b5c5e-110d-d69f-7403-dcadec88653f`.

Live beta readiness returned `google=false, yahoo=false`; both start routes
returned the explicit `social_setup_required` path with no new auth cookies.
Unsupported providers return 400. Provider credentials and actual account login
checks remain tracked in [issue #8](https://github.com/IllI/blbd/issues/8).
After explicit user approval to release all pending beta changes, Webflow beta
was published on **2026-10-21 at 21:20:47.657 UTC** (task
`dd432025-2d2a-42de-88a5-52c22f6b22c5`). The target was the Webflow subdomain
only, with `customDomains=[]`; production was not changed. This also released
the approved pending blog/category template edits.

Published `/log-in` and `/sign-up` both return 200 with exactly one native
social group, both themed provider links, and the registered loader. Existing
email/password inputs and signup consent inputs remain present. Executing the
actual published controller against the fetched page DOM verified group
relocation into the original form, safe disabled-provider behavior, and an
unmodified password-submit listener. The live loader/controller passed source,
SHA-256 integrity and anonymous-CORS checks. This is DOM/script verification,
not browser visual QA or a successful account login.

The four unfinished portal pages remain drafts; `/admin/newsletter` still
returns 404 on Webflow. The existing beta backend portal remains the working
newsletter surface. Google/Yahoo readiness still returns false for both;
provider credentials and real end-to-end account tests remain blocked on
the configuration described above and tracked in issue #8.
