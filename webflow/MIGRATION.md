# Original BLBD design migration

Tracking: https://github.com/IllI/blbd/issues/2

Source: `blbd` (`693b4fc98a599c12cbf30e36`). Destination: `blbd-2`
(`69b9ae3792be3b49ef7eab96`). Use the original site's designs while retaining
the working membership integration. Do not replace pages wholesale.

## Completed on 2026-09-22

The asset migration copied 48 images into the destination and verified the
downloaded destination bytes against each source using MD5. Eleven source
entries matched existing destination content or another source image already
copied. All 59 source image entries therefore have verified destination
matches. This covered the site asset list; CMS-owned image files were handled
separately on September 24.

At that stage no pages, CMS content, membership code, payment configuration,
or publication state were changed. Asset placement, folder organization, and
responsive rendering still require review during Designer integration.

## CLI migration on 2026-09-24

CMS transfer uses subprocess calls to the installed `webflow` CLI with
`--json --skip-update-check --no-input`. Each command's JSON stays out of chat;
private source/destination snapshots and results are under
`.secrets/webflow-migration/`. `WEBFLOW_CLI_ENTRY` can override the path to the
installed CLI's `dist/index.js`. Existing destination items are never updated.

```sh
node scripts/migrate-webflow-cms.mjs          # inspect and plan
node scripts/migrate-webflow-cms-images.mjs   # plan missing CMS image copies
node scripts/migrate-webflow-cms-images.mjs --apply
node scripts/migrate-webflow-cms.mjs --apply  # create missing category/post drafts
node scripts/migrate-webflow-fonts.mjs        # compare custom fonts
node scripts/migrate-webflow-fonts.mjs --apply
node --test scripts/migrate-webflow-cms.test.mjs
node scripts/verify-webflow-migration.mjs     # read-only preservation check
```

The initial CMS plan captures a source snapshot even if it stops at an
unmapped image. Run the CMS image step, then resume the CMS transfer.

The CMS image step found 16 image-field files outside the site asset inventory:
12 were copied and verified, and four reused identical destination images.
Webflow also rehosts image fields and inline rich-text images in CMS storage
when creating an item. Verification compares image bytes and preserves exact
article text, markup, alt text, and category references despite changed URLs.

Both source Playfairdisplay custom fonts (normal 400 and 500, `swap`) are now
installed in the destination and their downloaded contents verified. Visual
typography checks remain part of the layout migration.

Twelve missing posts were imported as drafts (six public, six member), plus
eight category drafts (five public, three member). Optional category reference
fields were added to the existing destination post collections. Read-back
verification confirmed the three pre-existing articles retain their content
and draft/archive state; their new category field is empty. Destination totals
are nine public posts, six member posts, and eight categories in four collections.
Two overlapping source articles remain for editorial review. Nothing was published.

Two narrow API exceptions use the CLI authorization: category-reference field
creation (the CLI cannot specify its target collection) and custom fonts (no
font command exists in CLI 2.2.0). All collection and item operations and new
CMS image uploads use CLI commands.

CLI 2.2.0 quirks: an empty item list returns `No items found.` even with JSON
output; explicit numeric pagination flags fail API validation. The script
handles the empty case and uses the default 100-item page, stopping rather
than truncating if a collection reaches that limit. Interrupted writes should
be inspected before rerunning; source slugs and content comparisons prevent
overwriting existing articles. Font upload recovery details remain private.

## Repeatable asset transfer

```sh
node scripts/migrate-webflow-assets.mjs          # compare only
node scripts/migrate-webflow-assets.mjs --apply  # upload missing images
```

Uses the authenticated Webflow CLI credentials. `WEBFLOW_CLI_AUTH_FILE` can
specify their location. The source and target IDs are deliberately fixed.
An exclusive lock prevents overlapping script runs. Local inventory and
source-to-target mappings are saved under `.secrets/webflow-migration/`,
which is gitignored. In-flight upload details remain private there too.
Do not commit that directory.

Existing destination images are reused only when their content hashes match.
The script does not delete or replace destination assets and never publishes.
Fonts and non-image files are reported as pending. If an upload is interrupted,
its metadata is recorded for recovery. An expired upload signature or incomplete
asset entry can require manual recovery; do not blindly delete assets or state.

## Integration requirements

| Surface | Preserve when applying original designs |
| --- | --- |
| Site custom code | SDK script configuration and synchronous head auth snippet |
| Login and signup | Email/password forms, consent, confirmation, errors, and redirects |
| Social login | Google and requested Yahoo flow; verify provider availability and callback independently |
| Member navigation | Account dropdown, sidebar, logout, and guest redirects |
| Goals | Tier limits, editing, completion, ordering, and template bindings |
| Profiles | Profile editing, avatar upload, privacy, and public profile links |
| Community and blog | Directory, paid commenting, replies, moderation, and CMS bindings |
| Billing and email | Stripe checkout/portal returns, webhook tier updates, newsletter subscription |

The SDK accepts native Webflow form IDs, Memberstack attributes, and generic
`data-blbd-form`/`data-blbd-input` markup. Preserve or deliberately map these
contracts when applying source layouts. Keep route differences explicit:
the original login convention is `/log-in`; the SDK defaults to `/login`.
Existing member paths default to `/members`, `/goals`, `/profile`, `/community`.
See `DESIGN-TEAM.md` and `INSTALL.md` for widget/template attributes.

Postgres RLS and triggers remain the data security boundary. Visual gating
alone must not be used to secure member data or protected content.

## CMS findings and remaining decisions

Source has eight collections: Blog Posts (8 items), Blog Categories (5),
Blog Categories Premia (3), Blog Post Premia (6), Ecommerce Categories (0),
Products (1), SKUs (1), and Profiles (1). Before transfer, destination had Blog
Posts (3) and Member Blogs (0). Current transfer counts are recorded above;
these are snapshots, not a continuing sync.

Source `featured-image` differs from destination `main-image`; source posts
also referenced category collections initially absent in the destination.
References and image IDs are mapped, not copied verbatim between sites. Two source draft
articles have apparent counterparts with different slugs in the destination;
compare their content before importing. Preserve destination articles and
membership functionality. Import content as drafts for review.

Do not enable Ecommerce or replace Stripe implicitly to reproduce the source's
legacy Products/SKUs. Decide how those templates fit the membership design.

## Access and verification still required

CLI authorization reads CMS and assets for both sites, but lacks page scopes:
page requests return HTTP 403. The separate existing project API credential
can read destination pages but cannot access the source site. Designer/MCP
access is needed to inspect and migrate layouts, styles, components, interactions,
and page settings. The destination had 21 pages at initial inspection.

The repository explicitly names Google and Facebook OAuth. Yahoo is a user
requirement, not a verified configured provider. Validate its intended path
before adding a button or claiming it works. Verify ordinary email/password
signup separately, including confirmation and password recovery.

After integration, check desktop/mobile appearance and all functional flows
above on the destination. Obtain approval before whole-site publishing, since
publication can also ship other existing drafts. This migration is incomplete
until those checks and the page/template transfer are done.

## Functional recovery gate

Migration writes were paused after the guest-homepage and avatar incident.
See `REGRESSION-2026-09-24.md`. Do not resume remote migration writes until the
SDK fix is live and the existing Supabase backend/profile images are verified.
User approval to resume Supabase and deploy the isolated SDK fix was received;
that approval does not authorize whole-site Webflow publication.
