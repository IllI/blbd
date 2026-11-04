# Existing Webflow membership SDK integration

Updated **2026-10-29**. This reference maintains existing Webflow integrations.
Jonas starts with [../ONBOARDING.md](../ONBOARDING.md),
[../MCP.md](../MCP.md), and [../DESIGN.md](../DESIGN.md).

**Public site/CMS work stays in Webflow; the member/admin portal stays on
Vercel.** Do not build a second portal in Webflow or install a new global SDK
as a workstation setup step. Existing beta login/signup pages have separate
password/social loaders; inspect those before changing any script bindings.

## Identify the consumer first

Read [../ENVIRONMENTS.md](../ENVIRONMENTS.md). BLBD beta is Webflow site
`693b4fc98a599c12cbf30e36` at `blbd.webflow.io`.
`blbd-2.webflow.io` is the production site's staging hostname.
`blbd-staging.vercel.app` is a legacy production alias, **not beta**.

Inspect the page's installed scripts and attributes. Record the site ID, page,
asset deployment/version, API origin and Supabase project before editing.
Do not duplicate an existing installation or replace native beta auth with
the older SDK forms by accident. Use Webflow MCP; call `webflow_guide_tool`
first and follow its current Data/Designer/Bridge requirements.

## SDK loading reference

`public/blbd.js` is the mutable SDK; `public/vN/blbd.js` is a frozen release.
For a deliberately approved integration, use the correct environment's asset
origin, verified version and **public beta anon key**. This schematic snippet
contains placeholders and must not be pasted as-is:

```html
<script defer src="https://YOUR_VERIFIED_BETA_ASSET_HOST/vN/blbd.js"
  data-supabase-url="https://hfmjvbjyectxiszutwen.supabase.co"
  data-supabase-key="YOUR_BETA_PUBLIC_ANON_KEY"
  data-app-url="https://YOUR_VERIFIED_BETA_PORTAL_HOST"></script>
```

The SDK reads config from its script attributes, not app env files.
Use only public client credentials in browser code. Never put a service-role,
Resend, Stripe secret or Webflow API token in an attribute.

Select login/signup/member paths and post-login behavior from the actual
integration, rather than assuming defaults match the beta portal.
Navigation between Webflow and Vercel needs an explicit reviewed integration:
sessions are separate by origin and relative links stay on their current host.

`head-snippet.html` supplies pre-paint auth-state styling for consumers of
the existing SDK. Review its selectors/session assumptions before applying
it; it is not required just to start the local Next.js app.

## Preserve the existing attribute contract

[DESIGN-TEAM.md](DESIGN-TEAM.md) lists form fields, goal templates, inline
widgets and personalization attributes. They remain relevant to deployed SDK
consumers and public blog comments, even though new portal UI is built in
Next.js. The SDK supports native Webflow IDs, Memberstack attributes and the
generic `data-blbd-form` conventions; do not remove one as a styling cleanup.

The files `login-page.html`, `members-page.html`, `goals-page.html`,
`profile-page.html` and `community-page.html` are older embed blueprints,
not instructions to recreate those portal screens on Webflow. Native portal
draft IDs and auth integration history live in
[portal-migration/README.md](portal-migration/README.md), now an archive.

## Releases and verification

Cut a new, unused SDK version with `node scripts/release-sdk.mjs vN` only
when a release is requested. Never hand-edit an existing frozen version.
See [../SKILLS.md](../SKILLS.md) for build, regression and review steps.

Changing an HTML file in git does not change Webflow. Changing an installed
script/element in Webflow draft state does not publish it. Before any publish,
inventory all pending changes and obtain explicit authorization for the exact
site/target; other teammates' drafts may ship too.

After an authorized beta change, inspect the published DOM and loader URL,
then test real beta login/signup, redirect behavior, comments/other affected
widgets and mobile layout. Keep email confirmation enabled. A configured
provider or script is not proof of a successful auth flow.

## Troubleshooting

- **SDK asset fails to load:** check the exact URL, response, deployment state
  and access protection. Use the team's approved access arrangement; don't
  disable project protection as a setup shortcut.
- **Email not confirmed:** finish verification in the beta inbox; do not turn
  off confirmation or edit a user's verified state.
- **Changes missing:** identify whether only the repo, Webflow draft, pinned
  asset or published page changed. Verify the correct stage before retrying.
- **No Designer tools:** reconnect OAuth/Bridge as described in
  [../MCP.md](../MCP.md); Webflow CLI login isn't a prerequisite.
