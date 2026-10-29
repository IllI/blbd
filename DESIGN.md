# Jonas's Figma-to-beta workflow

Jonas helps design the BLBD beta experience in **Figma**. Work is reviewed
in beta before any production release. See [ENVIRONMENTS.md](ENVIRONMENTS.md)
and [MCP.md](MCP.md) for targets and connections.

## Choose the implementation surface

| Design | Build and review in |
| --- | --- |
| Public homepage, about, join, public blog/CMS layouts | Webflow beta, site `693b4fc98a599c12cbf30e36` |
| Member dashboard, goals, profiles, community, settings, billing UI | Next.js in this repo; local and isolated Vercel beta Preview |
| Admin overview, accounts, newsletter composition/review | Next.js in this repo; local and isolated Vercel beta Preview |
| Existing Webflow auth entry pages, SDK widgets, navigation between surfaces | Inspect existing bindings and coordinate the integration change; preserve current behavior |

The member/admin portal remains on **Vercel**. The older native Webflow portal
drafts are not the next implementation milestone. Figma output is design
context; generated React/CSS is not an instruction to change hosting or
replace established components.

## Prepare a handoff

For each change, record in the issue/PR:

- Shared Figma file and **exact frame/node link**, plus design version/date.
  The team must supply the initial file link; none is prescribed in this repo.
- Target surface, route/page and intended user (guest, member or admin).
- Desktop/mobile frames, component variants, spacing, typography, colors,
  assets/export instructions and interaction behavior.
- Relevant loading, empty, error, success, disabled, focus and permission states.
- Acceptance criteria and any copy/assets still awaiting a decision.

Use Figma MCP to read the actual design context and screenshot for the frame.
If unavailable, record the missing access and work from an explicitly shared
export/spec rather than inventing details. Keep private user data and secrets
out of design files and screenshots.

## Implement

For the Vercel portal, inspect `src/app/`, `src/components/` and
`src/app/globals.css` before adding markup. Reuse shared components/tokens and
vanilla CSS. Keep auth, tier gates, accessibility, verified-admin checks,
newsletter review/sending protections and server boundaries intact.
Design fixtures should be synthetic. Use real beta access for signed-in
review; never expose a service-role key or remove role checks for a mockup.

For public Webflow pages, inspect the beta site's existing components,
classes, CMS bindings and scripts with Webflow MCP. Build editable native
elements and reuse components. Preserve SDK attributes where used; their
contract is in [webflow/DESIGN-TEAM.md](webflow/DESIGN-TEAM.md).
Keep changes in draft until the intended site-wide publication is reviewed.

Navigation changes between Webflow and Vercel require actual beta URL and
auth-flow testing. A relative `/dashboard` on Webflow does not reach the
Vercel portal. Do not assume cookies or localStorage sessions transfer across
origins, and don't remove the existing beta auth loaders as a styling cleanup.

## Review and deliver

1. Compare the implementation to the Figma frames at desktop and mobile
   widths. Check keyboard focus, labels, contrast, overflow and long content.
2. Run `npm run build` for code changes and the existing tests appropriate to
   any changed behavior. Exercise the intended member/admin role in beta.
3. In the PR, include the Figma node link, target page/route, screenshots,
   validation performed, remaining gaps and the beta URL when verified.
4. Target `feat/admin-portal` while it remains the beta base. A new personal
   preview branch needs its own beta env configuration before functional QA.
5. Treat merging, Webflow publishing and production deployment as release
   steps. Webflow publication may include other teammates' drafts; inventory
   and coordinate the full pending change set first.

Owner/team follow-up needed for a new workstation: provide Jonas's shared
Figma file/frame links, invitations, and any required beta credentials through
the team's secure channel. These cannot be inferred from a clone.
