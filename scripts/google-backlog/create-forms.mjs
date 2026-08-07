// Creates the Bug Report + Feature Request Google Forms via the Forms API.
// Run: node scripts/google-backlog/create-forms.mjs
// Requires .secrets/google-oauth-client.json — see README.md.

import { google } from 'googleapis';
import { getAuthedClient, writeState } from './lib.mjs';
import { BUG_FORM, FEATURE_FORM } from './forms-spec.mjs';

async function createForm(forms, spec) {
  const { data: created } = await forms.forms.create({
    requestBody: { info: { title: spec.title, documentTitle: spec.title } },
  });
  const formId = created.formId;

  const requests = [
    {
      updateFormInfo: {
        info: { description: spec.description },
        updateMask: 'description',
      },
    },
    ...spec.questions.map((item, index) => ({
      createItem: { item, location: { index } },
    })),
  ];

  await forms.forms.batchUpdate({ formId, requestBody: { requests } });
  const { data: form } = await forms.forms.get({ formId });

  // Deliberately NOT using the batchUpdate reply's createItem.itemId here —
  // that's the item's ID, which is a different value from the question's
  // own questionId (confirmed live: they never match). Response answers
  // are keyed by questionId, so that's what has to end up in state.json.
  const questions = form.items
    .filter((item) => item.questionItem?.question)
    .map((item) => ({ id: item.questionItem.question.questionId, title: item.title }));

  return {
    formId,
    title: spec.title,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    responderUri: form.responderUri,
    questions,
  };
}

async function main() {
  const auth = await getAuthedClient();
  const forms = google.forms({ version: 'v1', auth });

  console.log('Creating "BLBD Bug Report"...');
  const bug = await createForm(forms, BUG_FORM);
  console.log('Creating "BLBD Feature Request"...');
  const feature = await createForm(forms, FEATURE_FORM);

  writeState({
    bugForm: bug,
    featureForm: feature,
    targetSpreadsheetId: '1ejvtm2G5Qk_dircWzGpjvgYwYstELg1BsJJRgHOqtCk',
  });

  console.log('\nBoth forms created:\n');
  for (const f of [bug, feature]) {
    console.log(`  ${f.title}`);
    console.log(`    Edit:   ${f.editUrl}`);
    console.log(`    Fill:   ${f.responderUri}`);
  }

  console.log('\nNext:');
  console.log('  node scripts/google-backlog/setup-sheet.mjs     # creates the Bugs/Features tabs');
  console.log('  node scripts/google-backlog/sync-responses.mjs  # pulls responses into them');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
