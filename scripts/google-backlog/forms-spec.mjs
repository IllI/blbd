// The question sets for both forms. Order here = column order in the sheet
// tab Google auto-generates once each form is linked to the spreadsheet
// (see README.md) — keep this in sync with finalize-sheet.mjs's HEADER
// arrays if you change it.

const text = (title, { required = true, paragraph = false } = {}) => ({
  title,
  questionItem: { question: { required, textQuestion: { paragraph } } },
});

const dropdown = (title, options, { required = true } = {}) => ({
  title,
  questionItem: {
    question: {
      required,
      choiceQuestion: { type: 'DROP_DOWN', options: options.map((value) => ({ value })) },
    },
  },
});

export const BUG_FORM = {
  title: 'BLBD Bug Report',
  description:
    "Something broken on blbd.life or the member portal? Tell us what happened — " +
    'this goes straight into the team backlog spreadsheet.',
  questions: [
    text('Your name'),
    text('Your email'),
    dropdown('Where did this happen?', [
      'blbd.life (Webflow site)',
      'Member portal (app.blbd.life)',
      'Not sure',
    ]),
    text('Bug summary (one line)'),
    text('What happened?', { paragraph: true }),
    text('What did you expect to happen?', { paragraph: true, required: false }),
    text('Steps to reproduce', { paragraph: true, required: false }),
    dropdown('Priority', ['Low', 'Medium', 'High', 'Blocking']),
    text('Link or screenshot (optional)', { required: false }),
  ],
};

export const FEATURE_FORM = {
  title: 'BLBD Feature Request',
  description:
    'Got an idea for the site or member portal? Tell us about it — this goes ' +
    'straight into the team backlog spreadsheet.',
  questions: [
    text('Your name'),
    text('Your email'),
    text('Feature title (one line)'),
    text('What problem does this solve?', { paragraph: true }),
    text('Describe the feature', { paragraph: true }),
    dropdown('How much do you want this?', [
      'Nice to have',
      'Would use often',
      'Really need this',
    ]),
    dropdown('Area', [
      'blbd.life (Webflow site)',
      'Member portal — Goals',
      'Member portal — Profile',
      'Member portal — Community',
      'Other / not sure',
    ]),
  ],
};
