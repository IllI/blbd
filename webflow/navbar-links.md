# Webflow Navbar & CTA link updates

These are manual Designer changes — no code. Do them in the Webflow Designer,
then publish.

## Navbar component (all 24 instances update at once — it's a component)

| Element | Old (broken) | New |
| --- | --- | --- |
| **Log in** button | Webflow native `/log-in` | `https://app.blbd.life/login` |
| **Join / Sign up** button | `/sign-up` | `https://app.blbd.life/signup` |
| Lock icon / **Log out** button | Webflow membership remnant | Delete / hide |

Set each button's link in the Settings panel → Link → **External URL**. Tick
**Open in new tab: off** (same-tab feels like one continuous site).

## CTA components

| CTA | Link |
| --- | --- |
| Primary CTA ("Join", "Get started") | `https://app.blbd.life/signup` |
| Secondary CTA ("Read the blog") | `https://blbd.life/blog` |

## Pricing / membership buttons (if present)

Point each tier button at the portal checkout with the tier preselected:

- Supporter → `https://app.blbd.life/checkout?tier=supporter`
- Member → `https://app.blbd.life/checkout?tier=member`
- Founding → `https://app.blbd.life/checkout?tier=founding`

Unauthenticated visitors hitting `/checkout` are sent to log in first, then
bounced back to checkout automatically.

## Comment embed

See `comment-embed.html` — paste into the **Blog Post CMS template**, once.

## Newsletter

See `newsletter-intercept.html` — paste into **Project Settings → Custom Code
→ Footer Code**, once. No per-form changes needed.
