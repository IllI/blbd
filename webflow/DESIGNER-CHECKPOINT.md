# Designer checkpoint — 2026-09-25

Tracking: issue #2 / draft PR #3. Browser access now works through connected
Chrome, but the user requested CLI-first work to control usage. Do not resume
large browser snapshots or replay the completed Designer inspection.

## Applied destination draft edits

These changes were made in the real `blbd-2` Designer, not local HTML files.
Each changed link was read back in the canvas after editing. Nothing was
published. Persisted state after a full Designer reload has not been checked.

| Scope | Link | Before | After |
| --- | --- | --- | --- |
| Home | Hero Learn More | `#` | `/join` |
| Home | Our Mission Learn More | `#` | `/about-us` |
| Home | About Us Learn More | `#` | `/about-us` |
| Home | How it Works Learn More | `#` | `/about-us` |
| Home CTA instance | Sign Up | `#` | `/sign-up` |
| Shared Footer | Home | `#` | `/` |
| Shared Footer | About Us | `https://about-us` | `/about-us` |
| Shared Footer | Join | `https://join` | `/join` |
| Shared Footer | Blog | `#` | `/blog` |
| Shared Footer | Contact | `#` | `/contact` |

Webflow reports 11 instances of the shared Footer. Existing contact details,
styles, navbar, membership scripts, forms, and auth/payment bindings were not
changed. Source `/author` links were mapped to the existing destination
`/about-us` route; the destination's real Contact page was retained instead of
the source's Coming Soon route.

The footer logo link wrapper was selected but **not changed**. It still needs
its `#` link corrected. Legal/admin links were not repointed to missing pages.

## Observed page inventory

Source static pages: Home, Home Premium, About Us, Join, Blog, Coming Soon,
Privacy Policy; Admin folder with Styleguide, Changelog, Licences.

Source CMS templates: Profiles, Blog Post Premia, Blog Categories Premia,
Blog Categories, Blog Posts. Source also has legacy ecommerce and Webflow
user-account pages; do not copy their authentication or checkout behavior over
the current membership layer.

Destination static page list: Home, About Us, Join, Sign Up, Blog, Members,
Member Blog, User Examples, Resources, Features, Community, Contact, Profile,
Upcoming Events, Goals, Login, a second entry named Members, Coming Soon.
The duplicate Members labels need slug inspection before any change.

Destination CMS templates: Blog Categories, Blog Categories Premia,
Member Blogs, Blog Posts. Their content is migrated; template layouts are not
yet ported/verified. The homepage already contains much of the source layout;
do not replace it wholesale.

## CLI-only continuation boundary

Run `node scripts/verify-webflow-migration.mjs` for a compact, read-only CMS
preservation check, and `node scripts/migrate-webflow-fonts.mjs` to verify fonts.
Transfers have already completed; do not repeat writes merely to show progress.
Keep full command output in local logs and report only counts/errors.

Installed Webflow CLI 2.2.0 has CMS/assets/sites commands but no Designer page
layout-copy commands. The CLI credential returns HTTP 403 for page requests.
A Chrome login does not expand those API scopes. Page structure/styles still
require an appropriate authorized Designer/MCP capability or a separately
approved, tightly bounded UI workflow. Do not invent private API endpoints or
extract browser session credentials to work around this boundary.

Remaining work: source-only pages, CMS layouts and bindings, footer/logo/legal
links, responsive comparison, signed-in portal checks and Google/Yahoo setup.
Ordinary email signup must remain supported. Whole-site Webflow publication
still requires separate approval.
