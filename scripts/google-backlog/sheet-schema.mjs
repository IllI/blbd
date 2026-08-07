// Shared column layout between setup-sheet.mjs and sync-responses.mjs so
// the two can never drift out of sync with each other.

export const TRAILING_COLUMNS = ['Status', 'GitHub Issue #', 'Notes', 'Response ID'];
export const STATUS_OPTIONS = ['New', 'Triaged', 'In Progress', 'Done', "Won't Fix"];

export function headerFor(formState) {
  return ['Timestamp', ...formState.questions.map((q) => q.title), ...TRAILING_COLUMNS];
}

export function colLetter(index) {
  let s = '';
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
