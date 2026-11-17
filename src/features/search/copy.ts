/**
 * M3. Verbatim copy for S14 — `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`
 * (S14 — Filter & Search). No paraphrasing; every string here is a direct quote from that file.
 */

export const S14_COPY = {
  title: 'Search',
  searchPlaceholder: 'Search tasks',
  typeGroupLabel: 'Type',
  importanceGroupLabel: 'Importance',
  necessityGroupLabel: 'Necessity',
  clearAll: 'Clear all',

  typeRoutine: 'Routine',
  typeEvent: 'Event',
  typeCourse: 'Course',
  typeTodo: 'To-do',

  importanceHigh: 'High',
  importanceMed: 'Med',
  importanceLow: 'Low',

  necessityMustDo: 'Must-do',
  necessityRecommended: 'Recommended',
  necessityOptional: 'Optional',

  asNeededTag: 'As-needed',

  noMatchesHeadline: 'No matches.',
  noMatchesSubcopy: 'Try a different search term, or clear a filter.',
  nothingToSearchHeadline: 'Nothing to search yet.',
  nothingToSearchSubcopy: "Once you add a task, it'll show up here.",

  backLabels: {
    today: 'Back to Today',
    routines: 'Back to Routines',
    events: 'Back to Events',
    courses: 'Back to Courses',
    todos: 'Back to To-dos',
  },
} as const;

export function resultsCountLabel(n: number): string {
  return `${n} result${n === 1 ? '' : 's'}`;
}
