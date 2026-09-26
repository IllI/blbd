# Designer checkpoint — 2026-09-25

Tracking: issue #2 / draft PR #3. Webflow's hosted MCP 2.1 is authenticated and
supports compact Designer reads/writes without browser snapshots. Prefer it and
the CLI for migration work; do not replay the completed browser inspection.

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
| Shared Footer | Logo wrapper | source Home page | destination Home page |

Webflow reports 11 instances of the shared Footer. Existing contact details,
styles, navbar, membership scripts, forms, and auth/payment bindings were not
changed. Source `/author` links were mapped to the existing destination
`/about-us` route; the destination's real Contact page was retained instead of
the source's Coming Soon route.

The shared Footer logo wrapper was corrected through MCP and read back as a
destination Home page link. Legal/admin links were not repointed to missing
pages.

The destination Blog page's three existing category tabs/list wrappers were
preserved. Their previously empty CMS item slots now contain cards matching the
source structure, with image, image alt text, category name, title, summary,
and collection-page links bound to the destination Blog Posts collection. The
lists are filtered, in existing page order, to Mental Health and Wellness,
Social Media and Online Presence, and Career Paths and Entrepreneurship. The
new card styles are local to the destination draft. All bindings, list sources,
and filters were read back successfully. Nothing was published.

The public Blog Posts template retained its existing destination layout. Its
placeholder category, heading, hero image, image alt text, and rich-text body
now bind to the destination Blog Posts collection. The destination Navbar and
the corrected shared Footer were added around the template and their root order
was read back as Navbar, article content, Footer.

The Member Blogs template was an empty body. It now has a source-inspired
article shell using existing destination styles, bound to the destination
Member Blogs category, name, main image, alt text, and post body fields. The
article section carries `data-blbd="member-only"` so the current membership SDK
continues to gate it; the existing Navbar and corrected shared Footer surround
the section. All bindings, the gate attribute, and root component order were
read back successfully. No scripts, auth forms, or access rules were replaced.

Both category templates were also empty bodies. Each now has a source-inspired
category heading and Blog grid using the destination collection, card styles,
and fields. The public template binds to Blog Categories and Blog Posts; the
premium template binds to Blog Categories Premia and Member Blogs and carries
`data-blbd="member-only"`. Their list sources, card links, thumbnails, alt text,
category names, titles, summaries, gate state, and Navbar/content/Footer order
were all read back. The source category templates do not filter their post
lists by the current category, so the destination intentionally matches that
behavior instead of inventing a filter.

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
Member Blogs, Blog Posts. All four are now bound and structurally verified in
the destination draft. The homepage already contains much of the source
layout; do not replace it wholesale.

## CLI/MCP continuation boundary

Run `node scripts/verify-webflow-migration.mjs` for a compact, read-only CMS
preservation check, and `node scripts/migrate-webflow-fonts.mjs` to verify fonts.
Transfers have already completed; do not repeat writes merely to show progress.
Keep full command output in local logs and report only counts/errors.

Installed Webflow CLI 2.2.0 remains the preferred path for CMS/assets/sites.
Its credential returns HTTP 403 for page requests, but the separately
authenticated hosted Webflow MCP can now inspect and modify page structure,
settings, styles, components, and CMS bindings. Use compact queries and verify
every write by reading it back. Do not invent private API endpoints or extract
browser session credentials.

Remaining work: source-only pages, legal links, responsive comparison,
signed-in portal checks and Google/Yahoo setup.
Ordinary email signup must remain supported. Whole-site Webflow publication
still requires separate approval.
