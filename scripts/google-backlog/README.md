# BLBD backlog — Google Forms + Sheets automation

Creates two Google Forms ("BLBD Bug Report", "BLBD Feature Request") and
automatically syncs their responses into the team's
[BLBD Website Backlog](https://docs.google.com/spreadsheets/d/1ejvtm2G5Qk_dircWzGpjvgYwYstELg1BsJJRgHOqtCk/edit)
spreadsheet — a non-technical alternative to filing GitHub issues directly.

## Why this isn't Google's built-in "link to spreadsheet" feature

Worth explaining since it's not the first thing you'd reach for: Google
Forms has a native "link responses to a spreadsheet" button, but it's
UI-only — the Forms REST API's `linkedSheetId` field is explicitly
**read-only** (confirmed against Google's own API reference), so nothing
running from a script can set it. It also only lets you pick or create a
whole new tab, not target specific columns in an existing one.

The common workaround (plenty of tutorials on this) is an Apps Script
trigger bound to the form. That works, but it means deploying and
authorizing a second thing (the Apps Script API, its own project-linking
step, and a `scripts.run` "API executable" deployment that's genuinely
fiddly on a personal Google account vs. a Workspace one).

Instead, `sync-responses.mjs` polls `forms.responses.list` (a fully
documented, ordinary REST endpoint) and appends anything new straight into
the exact **Bugs** / **Features** tabs and columns we define — no Apps
Script, no extra API, no extra consent screen, and full control over the
layout from the start instead of whatever tab name Google would auto-pick.
Trade-off: it's pull-based, not an instant push — see "Keeping it live"
below for closing that gap.

## One-time setup

1. **OAuth client** — `.secrets/google-oauth-client.json` (gitignored, never
   commit it) needs, in [Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):
   - Authorized redirect URI `http://localhost:53682/oauth2callback` — done.
   - Google Forms API + Google Sheets API enabled — done.
   - If the OAuth consent screen is in **Testing** mode, the Google account
     you'll sign in with needs to be added under **Test users**, or the
     consent screen blocks it outright. Worth double-checking if the first
     run fails at the "Google hasn't verified this app" screen.
2. **Spreadsheet access** — that same Google account needs Editor access on
   the BLBD Website Backlog sheet (`setup-sheet.mjs` and `sync-responses.mjs`
   both write to it).

## Running it

```bash
cd blbd-portal
node scripts/google-backlog/create-forms.mjs   # creates both forms
node scripts/google-backlog/setup-sheet.mjs    # creates the Bugs/Features tabs
node scripts/google-backlog/sync-responses.mjs # pulls responses in
```

First run opens a URL to sign in and grant consent (Forms create + Forms
read-responses + Sheets scopes, requested together so any one script can
reuse the same cached token); it's saved to
`.secrets/google-oauth-token.json` (gitignored) so later runs don't
re-prompt.

`create-forms.mjs` prints each form's edit link (for tweaking questions in
the Forms UI) and fill link (to hand out to the team). `setup-sheet.mjs`
lays down headers matching each form's questions plus four tracking
columns: **Status** (dropdown, defaults to "New"), **GitHub Issue #**,
**Notes**, and a hidden **Response ID** (bookkeeping, used to avoid
double-adding a response on repeat syncs). All three scripts are safe to
re-run.

## Keeping it live

`sync-responses.mjs` only pulls responses that exist *right now* — run it
again whenever you want the sheet caught up. Two ways to make that
"automatic" rather than something someone remembers to run:

```bash
# Long-running poll loop — leave a terminal open, checks every 60s:
node scripts/google-backlog/sync-responses.mjs --watch
node scripts/google-backlog/sync-responses.mjs --watch --interval 120

# Or schedule it (Windows Task Scheduler, cron, a GitHub Action on a
# schedule trigger, etc.) to run `node scripts/google-backlog/sync-responses.mjs`
# every few minutes instead of leaving a terminal open.
```

## Files

- `lib.mjs` — OAuth client + token caching, shared by every script here.
- `forms-spec.mjs` — the actual question sets for both forms. Edit this to
  change the fields; re-run `create-forms.mjs` to create fresh forms (it
  doesn't update existing ones — delete the old form manually first if
  replacing it) then `setup-sheet.mjs` again to match the new columns.
- `sheet-schema.mjs` — the shared column layout (`setup-sheet.mjs` and
  `sync-responses.mjs` both import this, so they can't drift apart).
- `state.json` — form IDs, question IDs, and links from the last
  `create-forms.mjs` run. Not sensitive (no secrets in it), fine to commit
  so the team can find the forms again.
- `create-forms.mjs`, `setup-sheet.mjs`, `sync-responses.mjs` — see above.

## Future: auto-creating GitHub issues from rows

Not built yet. The **Status** and **GitHub Issue #** columns exist
specifically to make this easy later — e.g. a script that reads rows where
`GitHub Issue #` is blank, creates an issue via `gh issue create` or the
GitHub API in `IllI/blbd`, and writes the issue number back into that row.
Could hang off the same `--watch` loop or its own schedule once wanted.
