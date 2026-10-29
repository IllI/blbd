# Owner preparation for Jonas's contributions

Prepare these items before onboarding. Agent bootstrap lives in
[CONTRIBUTING.md](CONTRIBUTING.md); no email prompt is stored in this repo.

## Current audited baseline — 2026-10-29

- GitHub `IllI/blbd` is public and permits forks. Jonas can start without an
  invitation or the owner knowing his GitHub username.
- Vercel project `blbd`, team `illi1s-projects`, project ID
  `prj_pznncSeaqqpZWT6C0rBL7yVRXpxK`, is on **Hobby** with GitHub connected.
- `main` is the Production branch. **`feat/admin-portal` is shared beta**;
  its branch-specific Preview configuration already exists.
- The Vercel check for docs commit `253a7f2` succeeded. This verifies the
  owner's existing Git pipeline, not Jonas's future first push.
- No Deploy Hooks, Actions secrets or Actions variables were configured at
  audit time. The new optional hook workflow is disabled unless explicitly
  enabled as described below.

## Recommended path: existing public Git integration

No new Vercel env variable, hook, owner token or paid team invitation is needed
for the default path: Jonas creates a fork/PR, the owner reviews and merges to
`feat/admin-portal`, and the existing integration automatically builds shared
beta. Local setup includes GitHub CLI authentication and fork/remotes setup.

For direct pushes to upstream personal branches, invite Jonas as a **GitHub
repository collaborator**. In GitHub's repo **Settings → Collaborators → Add
people**, use his GitHub username or email and have him accept the invitation.
This can be prepared before workstation setup even if the owner does not yet
know his username. Claude discovers the signed-in account and checks upstream
write permission; it uses direct branches if granted and a fork otherwise.
This is not a Vercel team seat. Without that invitation, the fork path remains usable.
[GitHub's collaborator invitation guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)
confirms email invitations are supported.
Fork preview deployments can require Vercel owner approval; do not promise
that a hook or public repo removes all provider authorization gates.

For shared-beta review, use a normal owner-created merge of the reviewed PR.
Keep Jonas's original author credit; do not amend/rewrite his commits with the
owner's email or add empty commits as the routine contribution procedure.

Keep Production tracking `main`. Review beta changes before merging; a merge
to `main` is a production release, not a design submission.

## Ahead-of-time configuration for an optional personal preview

Claude's initial local branch name is **`jonas/design-first-pass`**. If you want
a functional Vercel preview before merging to shared beta, prepare these values
for **Preview → that exact Git branch** on the existing project. They do not
belong in `.mcp.json`, GitHub public files, or Jonas's email prompt.

| Variable | Value / source |
| --- | --- |
| `BLBD_ADMIN_ENVIRONMENT` | `beta` |
| `BLBD_BETA_SUPABASE_PROJECT_REF` | `hfmjvbjyectxiszutwen` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hfmjvbjyectxiszutwen.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Beta public anon key from the beta project |
| `SUPABASE_SERVICE_ROLE_KEY` | Beta server-only key, only for privileged portal operations |
| `NEXT_PUBLIC_APP_URL` | The actual personal preview's verified portal URL |
| `NEXT_PUBLIC_SITE_URL` | `https://blbd.webflow.io` |
| `BLBD_ADMIN_MAIL_ENABLED` | `false` |
| `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH` / `NEXT_PUBLIC_ENABLE_FACEBOOK_OAUTH` | `false` until deliberately configured |

Leave Resend/mail-hook secrets, postal address, Stripe settings and
`BLBD_WEBFLOW_ADMIN_ORIGIN` unset on a design preview. Do not inherit a generic
Preview or Production credential set as a substitute for isolated beta values.
Inspect inherited configuration as well as branch overrides. Keep local mail
off too. The shared beta branch has its own operational settings; do not reset them.

The exact preview URL becomes known when Vercel creates it. Verify/update the
branch's app URL and rebuild before functional review. Complete account signup,
verification and recovery on the shared beta portal; its signed auth-mail hook
does not accept arbitrary localhost/new-preview origins. Existing verified beta
accounts can use password login in the new preview. See [SETUP.md](SETUP.md).

Before approving a fork preview, inspect the actual repository/head branch and
the deployment's beta env selection; the PR's base branch does not confer the
base branch's env overrides. Do not claim a personal preview is ready until
its deployment and member/admin smoke checks pass. If the provider cannot apply
the intended isolation, use local review and the configured shared-beta merge path.

## Optional automatic beta Deploy Hook workflow

Use only if you deliberately need this fallback; native Git deployment already
works. The checked-in [.github/workflows/deploy-beta-hook.yml](.github/workflows/deploy-beta-hook.yml)
listens only to upstream `feat/admin-portal` pushes and skips its job unless
the GitHub Actions variable **`BLBD_BETA_DEPLOY_MODE=hook`** is set.
It performs no code checkout and uses no Vercel account token.

To prepare it:

1. On Vercel project `blbd`, open **Settings → Git → Deploy Hooks**. Create
   `github-actions-beta` bound to **`feat/admin-portal`**. Check the actual
   branch binding; the URL does not tell you which branch it deploys.
2. In upstream GitHub **Settings → Secrets and variables → Actions → Secrets**,
   add **`VERCEL_BETA_DEPLOY_HOOK_URL`** with that generated URL. Never paste it
   into chat, docs, client env, or Jonas's workstation. Its possession allows builds.
3. In the same Actions settings under **Variables**, set
   **`BLBD_BETA_DEPLOY_MODE`** to **`hook`** only when activating the fallback.
   Leave it absent or set it to `native` to keep this job disabled.
4. On the next beta push/merge, inspect the Actions job and resulting Vercel
   deployment/commit. HTTP success means a build request was accepted, not
   that the deployment is ready. Reverting the variable to `native` disables
   the extra trigger without changing the main Git integration.

The workflow validates the project URL shape but **cannot infer the secret's
branch binding**. Never configure a hook bound to `main`. Do not use
`pull_request_target` to execute PR code with this secret, distribute the hook
to contributors, or rewrite author identity to evade provider checks.

Enabling this alongside native Git deployment can produce duplicate beta
builds. Prefer the existing integration unless a specific failure requires
the fallback. Do not set `github.enabled=false` globally: Vercel documents
that this also disables Deploy Hooks. Hooks rebuild their configured branch's
latest head, not an arbitrary fork PR or a guaranteed historical SHA.
If Vercel rejects the author/configuration, inspect its status; this workflow
does not guarantee a bypass of plan or authorization rules.

## Other items to supply

- Shared Figma file/frame links and Figma/Webflow invitations.
- Beta public credentials through the team's secure channel for local login.
- A beta portal account invitation/verified signup; migration `0003` defines
  Jonas's one-time admin invitation. Check its application; don't rerun or
  weaken security for a visual test.
- Access to the shared beta review URL if protected. Use Vercel's **Share**
  controls for an external reviewer rather than purchasing a developer seat
  or disabling protection. Preview sharing is separate from private project/MCP access.

For **Anyone with the link**, Hobby permits one shareable link total per
account. Prefer sharing the stable beta review surface; check for an existing
link before creating another. Individual external-reviewer invitations have
their own limit of one collaborator at a time. These are viewing permissions,
not deployment or private project administration rights.
[Shareable link limits](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links),
[external preview invitations](https://vercel.com/docs/deployments/sharing-deployments).

## Other approaches considered

- **GitHub push webhook directly to a Deploy Hook:** the hook rebuilds its
  fixed branch and does not select a branch from the webhook payload. An
  unfiltered push webhook can rebuild beta after unrelated branch pushes.
  The checked-in Actions workflow supplies explicit repository/branch guards.
- **GitHub Actions + Vercel CLI:** Vercel documents `vercel pull`, `vercel build`
  and `vercel deploy --prebuilt` with `VERCEL_TOKEN`, `VERCEL_ORG_ID` and
  `VERCEL_PROJECT_ID` in Actions secrets. This is a valid future CI/CD option,
  not necessary for the working public-repo pipeline. If adopted, pull the
  intended branch's isolated beta env explicitly and handle resulting URLs/
  aliases; CLI deployments don't reproduce all native branch-link behavior.
  Do not disconnect the shared Git integration or disable all automatic
  deployments to implement a beta-only change: that also affects the existing
  production release path. Plan the replacement before switching triggers.
- **Making only beta public:** GitHub visibility applies to a repository,
  not individual branches. This repo is already public, so no visibility
  change is required.
- **Owner-author rewriting / stripping Git metadata:** not part of bootstrap.
  Preserve attribution and use normal reviewed merges or deliberately scoped
  deployment credentials, rather than relying on author impersonation.

Sources: [Vercel's Actions/CLI guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel),
[GitHub visibility](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories).

Official references: [Deploy Hooks](https://vercel.com/docs/deploy-hooks),
[public-repo collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration),
[preview sharing](https://vercel.com/docs/deployments/sharing-deployments).
The no-extra-seat path does not change hosting quotas or the plan's usage terms;
see [Hobby eligibility](https://vercel.com/docs/plans/hobby).
