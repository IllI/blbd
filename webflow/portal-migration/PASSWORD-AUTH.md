# Native email/password auth — beta only

The published beta forms still use Webflow's retired User Accounts handler.
The social loader does not supply password behavior. Preserve the existing
native UI; `public/blbd-auth.js` binds just `/log-in` and `/sign-up` forms.

## Transport and security

- Normal top-level URL-encoded **POST** to the stable beta backend's
  `/auth/password`. Passwords never go in URLs, browser storage or Webflow
  form submissions. No cross-site cookie fetch or session-token handoff.
- Beta project guard, exact beta Webflow `Origin`, fixed canonical beta portal
  host, streamed 8 KiB body limit, duplicate-field checks, validation and
  best-effort IP throttling. Supabase's own auth limits continue to apply.
- Login uses the existing per-request Supabase SSR client. The resulting
  cookies belong to the portal host. Successful login goes to its working
  dashboard or a safe portal `next`; it does **not** authenticate the separate
  Webflow origin. This is the same temporary portal fallback as social auth,
  not a claim that the native member-page cutover is complete.
- Signup requires name, email, an 8-character password and privacy acceptance.
  Marketing is optional; the checkbox records metadata only, not an automatic
  newsletter subscription. Untrusted role, tier and verification inputs are
  discarded. Existing RLS/admin bootstrap rules are unchanged.
- Confirmation uses the signed beta auth-email hook and first-party PKCE
  `/auth/callback`, with the verifier created on the same portal host. No
  email-confirmation requirement is disabled.
- Errors return fixed codes only to the native form. Existing native error
  and verification blocks provide feedback; no UI is generated or restyled.
  Legacy form handlers are bypassed, double submission is blocked, and browser
  Back restores the submit control. Public marketing navigation is untouched.

## Installation gate

As of October 26, 2026 this controller is **not installed/published in Webflow**.
The old remote MCP connection timed out twice during initialization. The local
fallback token lacks `custom_code:read`. A supported Webflow plugin was offered
as a reconnection path. Do not claim native password forms are repaired live
until registration, readback, beta publication and verification are completed.

The backend Preview is **READY** at
`https://blbd-idskqr2bb-illi1s-projects.vercel.app` (commit `2f05259`), and the
stable beta branch alias serves the new route. Register the separate inline
loader `password-bootstrap.js`; its immutable controller returned 200 with
anonymous CORS and SHA-256 `VM/+QTyQGqi+gzrHn0j7+na+UdMUewZf8ULllaj+v5E=`.
Apply it only to auth page IDs
`693b4fcb8a599c12cbf30eb7` and `693b4fcb8a599c12cbf30eb8` on beta site
`693b4fc98a599c12cbf30e36`. Preserve `blbdbetasocialloader` and all other code.
Inventory pending beta edits and obtain current whole-site publishing approval;
the October 21 publish approval already covered the previous release.

## Verification

- `npm run test:password`: shipped route/controller tests, hostile/opaque
  origins, canonical-host isolation, size/duplicate validation, consent,
  safe redirects, generic errors and original native form behavior.
- `node scripts/verify-native-auth.mjs`: isolated live login/session and
  role/profile preservation checks, fictional temporary account, no email.
- `node scripts/verify-native-auth.mjs --mail-sink`: additionally creates
  one temporary signup at an independently validated generated Resend test-sink
  address. Checks hook acceptance and unverified-login denial; removes fixtures.
  It does not claim to have opened the emailed link in a browser.
- Run social, native-portal, auth-email and build checks before committing.
  Post-install browser and real-account confirmation checks remain required.

Google/Yahoo app credentials are a separate blocker tracked in issue #8.

## October 26 verification results

- Password route/controller, social, native-portal and signed auth-email tests
  passed; Next.js production build/typecheck passed.
- Applied the controller in a DOM test to the **actual fetched published** login
  and signup markup. Both bound correctly, with all visible input/button classes
  and both social links preserved. This did not install it in Webflow or perform
  responsive browser visual QA.
- The existing live beta regression suite passed all **15** admin/newsletter
  checks, without sending mail; its QA fixtures were removed.
- The new deployed route passed **13** live checks, including a usable portal
  cookie session, incorrect-password denial, hostile/opaque Origin rejection,
  server privacy validation, no form-based admin escalation and preservation of
  a populated avatar URL, display name, membership tier and role.
- One real signup request used only this run's generated `delivered+...@resend.dev`
  test sink. The signed mail hook accepted it, the account remained unverified,
  marketing consent stayed false and login was denied pending confirmation.
  Both temporary auth accounts were deleted. No real subscriber/member inbox
  received a test, and no production database/site/deployment was changed.
- The test's first run selected `tier` instead of the actual `membership_tier`
  column. It failed before login and cleaned its fixture; the corrected full run
  passed. Do not infer a production profile defect from that QA assertion.

Opening an actual email confirmation link, browser visual checks, and the
post-install Webflow browser flow remain outstanding. The React beta portal
continues to be the working login/signup surface while Webflow access is restored.
