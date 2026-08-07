// One-off: make "Your name" / "Your email" optional on both forms (small
// team, required fields just slow people down). Run again after editing
// OPTIONAL_TITLES if more fields should stop being required.
//
// Run: node scripts/google-backlog/make-optional.mjs

import { google } from 'googleapis';
import { getAuthedClient, readState } from './lib.mjs';

const OPTIONAL_TITLES = new Set(['Your name', 'Your email']);

async function makeOptional(forms, formId, label) {
  const { data: form } = await forms.forms.get({ formId });

  const requests = [];
  form.items.forEach((item, index) => {
    const question = item.questionItem?.question;
    if (!question || !OPTIONAL_TITLES.has(item.title) || question.required !== true) return;
    requests.push({
      updateItem: {
        item: { ...item, questionItem: { ...item.questionItem, question: { ...question, required: false } } },
        location: { index },
        updateMask: 'questionItem.question.required',
      },
    });
  });

  if (requests.length === 0) {
    console.log(`${label}: nothing to change.`);
    return;
  }

  await forms.forms.batchUpdate({ formId, requestBody: { requests } });
  console.log(`${label}: made ${requests.length} field(s) optional.`);
}

async function main() {
  const state = readState();
  const auth = await getAuthedClient();
  const forms = google.forms({ version: 'v1', auth });

  await makeOptional(forms, state.bugForm.formId, state.bugForm.title);
  await makeOptional(forms, state.featureForm.formId, state.featureForm.title);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
