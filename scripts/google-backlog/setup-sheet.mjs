// Creates (or re-verifies) the "Bugs" and "Features" tabs in the target
// spreadsheet with headers matching the forms' questions, plus tracking
// columns. Run once after create-forms.mjs, before the first sync.
//
// Run: node scripts/google-backlog/setup-sheet.mjs
// Safe to re-run.

import { google } from 'googleapis';
import { getAuthedClient, readState } from './lib.mjs';
import { headerFor, colLetter, STATUS_OPTIONS } from './sheet-schema.mjs';

async function ensureTab(sheets, spreadsheetId, existingSheets, tabTitle, header) {
  let sheet = existingSheets.find((s) => s.properties.title === tabTitle);
  let sheetId;

  if (!sheet) {
    console.log(`Creating tab "${tabTitle}"...`);
    const { data } = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabTitle } } }] },
    });
    sheetId = data.replies[0].addSheet.properties.sheetId;
  } else {
    sheetId = sheet.properties.sheetId;
    console.log(`Tab "${tabTitle}" already exists — refreshing headers/formatting.`);
  }

  const statusColIndex = header.indexOf('Status');
  const responseIdColIndex = header.indexOf('Response ID');

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1:${colLetter(header.length - 1)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [header] },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold',
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: 2000,
              startColumnIndex: statusColIndex,
              endColumnIndex: statusColIndex + 1,
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: STATUS_OPTIONS.map((value) => ({ userEnteredValue: value })),
              },
              showCustomUi: true,
              strict: true,
            },
          },
        },
        // Response ID is bookkeeping for de-duping syncs, not for humans.
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: responseIdColIndex, endIndex: responseIdColIndex + 1 },
            properties: { hiddenByUser: true },
            fields: 'hiddenByUser',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: header.length - 1 },
          },
        },
      ],
    },
  });
}

async function main() {
  const state = readState();
  if (!state.bugForm || !state.featureForm) {
    throw new Error('No forms in state.json — run create-forms.mjs first.');
  }

  const auth = await getAuthedClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = state.targetSpreadsheetId;

  const { data: spreadsheet } = await sheets.spreadsheets.get({ spreadsheetId });

  await ensureTab(sheets, spreadsheetId, spreadsheet.sheets, 'Bugs', headerFor(state.bugForm));
  await ensureTab(sheets, spreadsheetId, spreadsheet.sheets, 'Features', headerFor(state.featureForm));

  console.log('\nDone. Next: node scripts/google-backlog/sync-responses.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
