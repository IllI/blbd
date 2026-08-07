// Pulls new responses from both forms and appends them as rows in the
// Bugs/Features tabs — this IS the "automatically populates the
// spreadsheet" part. De-dupes on the hidden "Response ID" column, so it's
// safe to run repeatedly (cron, Task Scheduler, or --watch below).
//
// Run once:      node scripts/google-backlog/sync-responses.mjs
// Run on a loop: node scripts/google-backlog/sync-responses.mjs --watch [--interval 60]

import { google } from 'googleapis';
import { getAuthedClient, readState } from './lib.mjs';
import { headerFor, colLetter } from './sheet-schema.mjs';

function answerValue(response, questionId) {
  const answer = response.answers?.[questionId];
  const value = answer?.textAnswers?.answers?.map((a) => a.value).join(', ');
  return value ?? '';
}

async function listAllResponses(forms, formId) {
  const responses = [];
  let pageToken;
  do {
    const { data } = await forms.forms.responses.list({ formId, pageToken, pageSize: 100 });
    responses.push(...(data.responses ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return responses;
}

async function syncForm({ forms, sheets, spreadsheetId, formState, tabTitle }) {
  const header = headerFor(formState);
  const responseIdCol = header.indexOf('Response ID');

  const { data: existing } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabTitle}'!${colLetter(responseIdCol)}2:${colLetter(responseIdCol)}`,
  });
  const alreadySynced = new Set((existing.values ?? []).map((row) => row[0]).filter(Boolean));

  const responses = await listAllResponses(forms, formState.formId);
  const newRows = responses
    .filter((r) => !alreadySynced.has(r.responseId))
    .sort((a, b) => new Date(a.createTime) - new Date(b.createTime))
    .map((r) => [
      r.createTime,
      ...formState.questions.map((q) => answerValue(r, q.id)),
      'New', // Status
      '', // GitHub Issue #
      '', // Notes
      r.responseId,
    ]);

  if (newRows.length === 0) {
    console.log(`${tabTitle}: no new responses.`);
    return 0;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: newRows },
  });

  console.log(`${tabTitle}: added ${newRows.length} new response(s).`);
  return newRows.length;
}

async function runOnce(forms, sheets, state) {
  const bugCount = await syncForm({
    forms,
    sheets,
    spreadsheetId: state.targetSpreadsheetId,
    formState: state.bugForm,
    tabTitle: 'Bugs',
  });
  const featureCount = await syncForm({
    forms,
    sheets,
    spreadsheetId: state.targetSpreadsheetId,
    formState: state.featureForm,
    tabTitle: 'Features',
  });
  return bugCount + featureCount;
}

async function main() {
  const state = readState();
  if (!state.bugForm || !state.featureForm) {
    throw new Error('No forms in state.json — run create-forms.mjs first.');
  }

  const args = process.argv.slice(2);
  const watch = args.includes('--watch');
  const intervalIdx = args.indexOf('--interval');
  const intervalSeconds = intervalIdx !== -1 ? Number(args[intervalIdx + 1]) : 60;

  const auth = await getAuthedClient();
  const forms = google.forms({ version: 'v1', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  await runOnce(forms, sheets, state);

  if (!watch) return;

  console.log(`\nWatching for new responses every ${intervalSeconds}s. Ctrl+C to stop.`);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    try {
      await runOnce(forms, sheets, state);
    } catch (err) {
      console.error('Sync error (will retry next interval):', err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
