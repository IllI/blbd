# BLBD workstation configuration and beta deployment

Updated **2026-10-29**. New teammates start with
[ONBOARDING.md](ONBOARDING.md) and [MCP.md](MCP.md). This document configures
the existing app; onboarding does not recreate infrastructure or deploy
production. [ENVIRONMENTS.md](ENVIRONMENTS.md) defines the current targets.

## Local build and layout work

From the repo root on the beta branch, run `npm run setup:workstation`.
This installs locked dependencies with `npm ci` and copies
[.env.local.example](.env.local.example) only if `.env.local` is absent.
Then complete [CONTRIBUTING.md](CONTRIBUTING.md): GitHub CLI login, verified
writable fork/upstream remotes and a local design branch. Run `npm run build`
and `npm run dev`. See [OWNER-SETUP.md](OWNER-SETUP.md) for advance owner tasks.

The example uses a dummy Supabase host/key, blank service credentials, beta
guard settings, localhost app URL and disabled mail/OAuth flags. Those public
dummy values satisfy configuration shape for build/layout preparation;
they do not connect to the beta database. Protected pages require real login.
The service-status page's badges are not a remote connectivity test.

No real env file, `.vercel` link, Supabase link metadata, API tokens or
personal Claude settings are shipped by cloning. Do not copy these from a
different workstation. Never print an env file or secret values in chat/logs.

## Real local member and admin review

Obtain the beta **public** URL and anon key through the team's secure channel.
Set these in your gitignored `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://hfmjvbjyectxiszutwen.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_BETA_PUBLIC_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=https://blbd.webflow.io
BLBD_ADMIN_ENVIRONMENT=beta
BLBD_BETA_SUPABASE_PROJECT_REF=hfmjvbjyectxiszutwen
BLBD_ADMIN_MAIL_ENABLED=false
```

Keep `RESEND_API_KEY`, `BLBD_MAIL_POSTAL_ADDRESS`,
`SUPABASE_AUTH_EMAIL_HOOK_SECRET`, Stripe keys and
`BLBD_WEBFLOW_ADMIN_ORIGIN` blank for ordinary local design work.
Keep provider flags false until the provider is actually configured.
Restart dev/rebuild after changing `NEXT_PUBLIC_*` values.

Create and verify your separate **beta** account on the
[shared beta portal](https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app/signup),
then use its email/password to sign in locally. Do recovery/verification on
that shared host too. The signed auth-mail hook in `src/lib/auth-email.ts`
accepts only its configured HTTPS app origin; adding localhost to Supabase's
redirect allowlist alone does not enable local signup/recovery mail. Local
mail-hook support would require a separate reviewed change, not disabling
the redirect guard. Do not change production redirect settings.
Admin pages additionally require a verified current grant; provider/team
invitations do not grant app access.

Regular member functionality uses the anon key with the signed-in user's
session. Privileged admin/account/mail routes may also need the **beta
server-only** `SUPABASE_SERVICE_ROLE_KEY`, supplied separately if local admin
work needs it. It bypasses RLS; never place it in a `NEXT_PUBLIC_*` variable.
Prefer reviewing on the shared beta portal when privileged local access is
unnecessary. Local sending remains off; don't add mail keys to make a button
look enabled.

## Optional Vercel CLI env retrieval

This is for an already authorized maintainer. Jonas can contribute through
GitHub without a paid Vercel seat, private MCP access or env export. Supply
only needed beta public values securely; do not send the owner's credentials.

Use only with project permission and a deliberate need for local env access.
MCP OAuth and CLI login are separate. Install the CLI if needed
(`npm install -g vercel`), then:

```sh
vercel login
vercel link --project blbd --scope illi1s-projects
vercel env pull .env.beta.local --environment=preview --git-branch=feat/admin-portal --scope illi1s-projects
```

Verify the link selects the existing project/team, not a new project.
The explicit Preview branch matters: plain `vercel env pull` defaults to
Development, which is not the isolated beta configuration.

Pull to the separate gitignored `.env.beta.local` so you don't overwrite
local settings. Inspect it privately and copy only necessary beta values to
`.env.local`; it is not automatically loaded by Next.js as a beta environment.
Keep localhost as `NEXT_PUBLIC_APP_URL`, mail disabled, mail secrets blank,
and native admin transport blank. The shared branch may have mail enabled.
Sensitive variables may not be exported; obtain missing required beta secrets
through the approved secure channel, not from Production.
See [Vercel env CLI reference](https://vercel.com/docs/cli/env).

## Maintainer: feature-branch previews

The default contribution route uses local/fork PR review and an owner-reviewed
merge to the already configured shared beta. For an optional immediate personal
preview, the initial branch is `jonas/design-first-pass`; see the exact env
table in [OWNER-SETUP.md](OWNER-SETUP.md). No new env is required for the
existing shared-beta Git pipeline. The optional hook workflow is opt-in and
targets only `feat/admin-portal`.

A personal branch based on `feat/admin-portal` gets code, not that branch's
Vercel env overrides. Before functional preview review:

1. Confirm Vercel `blbd` / `illi1s-projects`, the exact Git branch, and Preview.
2. Configure that branch's beta Supabase URL/anon key, required server secrets
   and guards. Confirm all refer to `hfmjvbjyectxiszutwen`.
3. Set its actual portal URL as `NEXT_PUBLIC_APP_URL` and
   `https://blbd.webflow.io` as `NEXT_PUBLIC_SITE_URL`.
   Check the corresponding **beta** auth redirects. The shared signed-mail hook
   also enforces its configured origin: new preview signup/recovery needs a
   separately reviewed auth-mail arrangement, not just an added redirect URL.
   Use an already verified beta account for preview password-login review.
4. Keep sending disabled on new branches and unconfigured provider flags off.
   Do not copy live send switches, production keys, contacts or auth-hook
   settings just to get a preview.
5. Deploy the preview, then verify the returned branch, commit, URL, isolation,
   login and required role checks before sharing it for functional review.

Do not run `scripts/configure-beta-preview.mjs` as laptop bootstrap.
It changes the shared `feat/admin-portal` environment, resets flags and uses
owner-specific CLI paths. It is not a portable new-branch provisioning script.

Vercel env changes affect a **new deployment**, not an already running
deployment. Rebuild/redeploy the intended Preview after changing them.
Do not repoint production aliases or use `vercel --prod` for beta review.

## Maintainer: database and integrations

Supabase projects and migrations already exist. Design onboarding requires no
database push, project creation, production data copy, or forced role changes.
For approved schema work, read [supabase/README.md](supabase/README.md), use
the repo-pinned `npx supabase`, explicitly link/verify the **beta** project and
review the migration dry run before applying anything.

[ADMIN-PORTAL.md](ADMIN-PORTAL.md) records beta admin invitations, auth-mail
hooks and mail controls. Check current beta configuration rather than assuming
Stripe/Resend are all placeholders. Production rollout, billing activation,
email provider changes, DNS, OAuth setup and Webflow publication are separate
tasks with their own review.

## Verification

- `npm run build` — compile/type-check using local configuration.
- `npm run test:admin` — local schema/admin/auth-mail logic, no real mail.
- `npm run test:native`, `npm run test:social`, `npm run test:password` —
  existing Webflow integration regressions when those surfaces change.
- Browser smoke checks with a real beta member/admin account for the screens
  being designed, including mobile widths and error/empty/loading states.

`npm run test:beta` is a **remote integration run**, creates temporary beta
fixtures and requires additional authenticated access. It is not a default
onboarding step. Sink-mail flags still send mail; don't run them for design QA.
