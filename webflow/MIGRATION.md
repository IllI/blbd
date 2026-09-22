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
matches. The two Playfair Display TTF files still need custom-font setup.

No pages, CMS content, membership code, payment configuration, or publication
state were changed. Asset placement, alt text, folder organization, responsive
rendering, and font installation require follow-up during Designer integration.

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
Products (1), SKUs (1), and Profiles (1). Destination has Blog Posts (3) and
Member Blogs (0). Counts reflect the inspection date, not a continuing sync.

Source `featured-image` differs from destination `main-image`; source posts
also reference category collections absent in the destination. References and
image IDs must be mapped, not copied verbatim between sites. Two source draft
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
page settings, and custom fonts. The destination had 21 pages at inspection.

The repository explicitly names Google and Facebook OAuth. Yahoo is a user
requirement, not a verified configured provider. Validate its intended path
before adding a button or claiming it works. Verify ordinary email/password
signup separately, including confirmation and password recovery.

After integration, check desktop/mobile appearance and all functional flows
above on the destination. Obtain approval before whole-site publishing, since
publication can also ship other existing drafts. This migration is incomplete
until those checks and the page/template transfer are done.
