# BLBD environments

Current team direction: **2026-10-29**. This is the shared environment map for
onboarding, agents, and design implementation. Names and deployment URLs can
change; verify the immutable IDs and configuration before writing remotely.

## Where work belongs

Jonas is joining the team to help design the BLBD beta site in **Figma**.
Implement public website designs in **Webflow beta** while BLBD remains on
Webflow. Implement the **member and admin portal in this Next.js repo on
Vercel**. Supabase supplies auth, data, storage, and database permissions.
Do not continue the older plan to move the member/admin portal into Webflow.

| Surface | Beta / development | Production reference |
| --- | --- | --- |
| Public website / CMS | BLBD BETA, `https://blbd.webflow.io` | BLBD, `https://blbd.life` |
| Webflow site ID | `693b4fc98a599c12cbf30e36` | `69b9ae3792be3b49ef7eab96` |
| Portal / API | [Vercel beta portal](https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app) | `https://app.blbd.life` |
| Supabase project ref | `hfmjvbjyectxiszutwen` (`blbd-beta`) | `ihghsacsxvibtwoiyjag` |
| Git / Vercel target | `feat/admin-portal`, Preview | `main`, Production |

Vercel project: **`blbd`**, team/scope **`illi1s-projects`**. These are existing
resources; a new teammate does not create replacement projects or sites.
The initial laptop setup uses `http://localhost:3000` for the portal.

**`blbd-staging.vercel.app` is not beta.** The previous audit found it pointed
to the same deployment as production. Do not test beta through it or move its
alias. `blbd-life.vercel.app` is also a legacy manually managed alias, not an
environment selector. Webflow's `blbd-2.webflow.io` is the production site's
staging hostname; it is not the BLBD beta environment.

## Branches and previews

The latest beta implementation currently lives on **`feat/admin-portal`**.
Clone that branch for onboarding until it is merged and these instructions
are updated. A clone defaults to a single repository root containing
`package.json`; there is no required nested `blbd-portal/` folder and no
dependency on the owner's Windows paths or other local worktrees.

Jonas should make changes on a personal branch based on `feat/admin-portal`
and open a PR against `feat/admin-portal`. Git integration can create a
Preview when that branch is pushed, but **the beta secrets are configured
specifically for Preview / `feat/admin-portal`**. A personal branch does not
inherit those overrides. Before using its preview, a maintainer must configure
and verify isolated beta variables for that exact branch. A preview URL alone
does not establish isolation. Do not copy Production or generic Preview env
settings as a shortcut.

## Current integration context

- `public/blbd.js` is the existing Webflow membership SDK; preserve its current
  consumers. Frozen `public/v*/blbd.js` releases must not be hand-edited.
- Older native Webflow portal drafts and `public/blbd-portal.js` still exist.
  Their IDs, script bindings, and auth verification history are recorded in
  [the migration archive](webflow/portal-migration/README.md). Do not publish,
  expand, delete, or redirect members to those drafts as part of workstation setup.
- Beta native `/log-in` and `/sign-up` password integration was published and
  checked on October 26. Google/Yahoo controls exist, but provider setup and
  successful end-to-end sign-in are not established. Preserve these integrations
  until a separately reviewed navigation/auth change replaces them.
- Beta admin mail was activated on the shared branch; it is not universally a
  placeholder service. New local setups keep sending disabled and mail keys
  blank. See [ADMIN-PORTAL.md](ADMIN-PORTAL.md) for operational controls.
- The signed beta auth-mail hook accepts only its configured HTTPS portal
  origin. Complete signup/verification/recovery on the shared beta portal,
  then sign in locally with that verified account. Local/new-preview mail
  flows need a separately reviewed integration; a redirect allowlist entry
  alone does not satisfy the hook's origin check.
- A beta portal account is separate from production, Figma, Webflow, Vercel,
  GitHub, and Claude accounts. Migration `0003` defines Jonas's one-time beta
  admin invitation. Actual access requires the migration to be applied and the
  invited mailbox to sign up and verify; a revoked invitation is not restored
  by running onboarding. Never bypass verification or grant roles for design QA.

## Before a remote change

Read the target's current metadata. Match the Webflow site ID, Vercel team,
project, branch and deployment environment, and Supabase project ref to the
beta column above. Treat a mismatch as a blocker for that remote operation;
continue local design/code work while it is resolved.

Production publishes, `vercel --prod`, pushes/merges to `main`, DNS/alias
changes, migrations, and real audience mail are not workstation setup steps.
Webflow publication can release other teammates' pending changes across the
site. Inventory drafts and obtain explicit release authorization before
publishing; old session-specific approvals in historical docs do not authorize
Jonas's new session.
