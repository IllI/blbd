# Original Coming Soon — mobile-only correction

Original BLBD site `693b4fc98a599c12cbf30e36`, Coming Soon page
`693b4fcb8a599c12cbf30eca`. Draft edits only; no publication, homepage
assignment, domain, membership/auth, or beta-site changes.

## Desktop restoration

The initial responsive pass replaced class chains and changed heading levels,
affecting the desktop design. That pass is superseded. Original element class
chains and heading levels were restored directly from the pre-edit native
tree, not recreated from screenshots. Original shared classes were never
deleted or edited. The saved Story title's inline Strong wrapper and exact
punctuation were restored; only that previously removed Strong/String pair
requires newly generated node IDs. All other original nodes stay in place.

The original logo/header, two-column desktop layout, photography, typography,
gradients, spacing, orange submit button, and rounded transparent inputs remain.
Old `CS ...` classes are left unattached rather than deleted.

## Phone-only patch

`coming-soon-responsive.mjs` now creates empty base classes/combo classes,
adds declarations **only** to `small` (<=767px) and `tiny` (<=478px),
and appends them to original class chains. No main, medium, large, xl,
xxl, or base pseudo-state declarations are written.

Phone grids stack, text has readable sizing and line-height, photos use the
available width, and fields retain comfortable touch targets. Original form
IDs, settings, required fields, success/error messages, assets, inline emphasis,
and all text remain unchanged. Phone-only transparent section backgrounds
reveal the existing full-height Main Wrapper gradient. Desktop gradients remain
exactly as originally designed.

## Read-only regression checks

Run:

```text
node scripts/verify-coming-soon-draft.mjs original-tree.json corrected-tree.json corrected-styles.json original-styles.json original-inherited-styles.json
```

The verifier checks exact text and inline structure, original node/settings/
attribute preservation, original class chains plus mobile modifiers, original
CSS equality, empty desktop/tablet modifiers, and saved phone declarations.
Final style exports must include original styles by ID and all `CS Mobile`
classes, with all seven breakpoints.

`coming-soon-original-assignments.json` stores original affected class chains
and heading levels; `restoreActions()` restores them. It does not reconstruct
the page or replace unaffected elements. Importing the manifest is read-only.
Before replaying writes, query existing classes; never blindly duplicate them.
Inspect individual MCP action errors even when the envelope succeeds. Use
small throttled batches and refresh the Designer before visual verification.

## Verified correction — 2026-10-05

- Final native reads passed: 146 original nodes preserved, exact page copy and
  inline formatting restored, 82 original style entries compared unchanged,
  and all 17 modifiers restricted to phone declarations.
- At 1395px desktop and 820px tablet, all 27 measured page elements matched
  the restored baseline exactly: position, size, typography, image geometry,
  grid columns, background, and corner radius.
- 320px, 393px, and 667px phone canvases have no horizontal overflow. At 320px,
  all three photographs are 280px wide and load successfully. The mobile
  section backgrounds are transparent over the original full-height gradient.
- 320px at 200% text zoom also has no horizontal overflow; zoom was reset.
- Name, Email, and Submit retain 48px touch targets at normal mobile text size.
  No form submission was sent. Membership/auth code was not changed.
- Build passes with the pre-existing unused Alert import warning.

## Launch gate

Webflow publication normally ships the entire site's unpublished work.
Explicit owner confirmation remains required before publishing or changing
the homepage. Merging PR #3 does not publish Webflow draft styles.
