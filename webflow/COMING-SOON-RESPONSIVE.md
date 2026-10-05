# Original Coming Soon responsive draft — 2026-10-05

Applied to **BLBD original**, site `693b4fc98a599c12cbf30e36`, page
`693b4fcb8a599c12cbf30eca`. This is the page intended for the temporary
blbd.life homepage, not the beta Coming Soon page.

## Scope and status

Native Designer draft edits are already applied. No Webflow publish,
homepage assignment, domain change, auth change, or Vercel deployment was
performed. Merging the tracking PR does not apply or publish these edits.

The page now uses 24 isolated `CS ...` classes rather than changing shared
Section/Content/Heading/Image classes used on other pages. Three content
grids have bounded desktop columns and a single-column tablet/phone layout.
Headings scale using rem-based `clamp`, content can shrink inside grids,
and long words cannot force horizontal overflow. Photography uses full-width
responsive sizing and rounded corners; the hero has an intentional desktop
portrait/mobile landscape crop. The original sunset image keeps its ratio.

The logo/header, green/lavender hero treatment, section spacing, reading
line-height, closing copy, and centered update form were polished. Inputs
use 16px text and at least 48px height at normal text size, and keyboard focus
indicators are explicit. One primary H1 remains, followed by section headings.
Only an absent space after `Dying:` was corrected in the existing copy.

## Verification

- Final Webflow tree/style exports passed `scripts/verify-coming-soon-draft.mjs`:
  all copy preserved (normalizing colon whitespace), 14 image/form/component
  nodes retained with unchanged settings/attributes, 38 verified class
  attachments, 24 verified native styles, and 5 verified heading levels.
- Actual Chrome/Webflow Designer canvas checks covered widths 320, 393, 667,
  991, 1395, 1440, and 1920px. None had horizontal overflow or content beyond
  the page bounds. At 320px all three photos are 280px wide, not thumbnails;
  at 393px they are approximately 353px wide.
- The 320px canvas also passed Webflow's 32px root text-zoom preview (200%):
  no horizontal overflow; headings and form text enlarged without clipping.
  Normal text sizing was restored afterward.
- All four visible images loaded in the actual canvas. The preexisting CTA
  component is hidden and remains unchanged; its hidden placeholder image
  is not counted as a visible-image failure.
- Existing Contact Form identity, Name/Email input IDs, required flags,
  input types, action/method/redirect, and success/error messages are retained.
  No test submission was sent, and email delivery was not certified.
- `npm run build` passes, with the existing unused `Alert` import warning.

## Files and replay precautions

`coming-soon-responsive.mjs` exports the native CSS/actions manifest.
Importing it performs no writes and has no publication operation. To verify
fresh headless reads:

```text
node scripts/verify-coming-soon-draft.mjs before-tree.json after-tree.json after-styles.json
```

The arguments are full MCP response exports for `get_all_elements` and
`query_styles` (including main/medium/small/tiny and focus/focus-visible).
Keep the original before export locally for comparison/rollback. Existing
classes were not deleted, so reverting the affected elements' class lists
and heading levels from the before export restores their prior presentation.

If replaying writes, do not blindly create duplicate classes. Reuse/update
existing `CS ...` styles and batch element actions conservatively. Webflow
can return a successful outer MCP envelope while individual actions fail
with `RATE_LIMITED`; inspect every action's error/result. This happened on
the initial attachment attempt and was recovered using six-action batches
with a 30-second pause after each successful batch. Final reads, not the
outer success flag, established completion. Refresh the Designer after
headless edits before reviewing the canvas.

## Launch gate

Publishing is a separate decision: Webflow publication normally ships the
whole site's unpublished changes. Confirm the intended domain, temporary
homepage switch, and whole-site draft scope with the owner before launch.
This layout pass does not certify the source site's legacy User Accounts or
the beta portal's migration/auth acceptance gates; issue #2/PR #3 remain open.
