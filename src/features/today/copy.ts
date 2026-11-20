/**
 * M3. Verbatim copy for S09 — `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`
 * (S09 — Today). No paraphrasing; every string here is a direct quote from that file.
 *
 * The stat-chip / re-entry-stat templates embed two DYNAMIC numbers (a rounded percent and
 * an "X of the last N days" pair) — the surrounding words are verbatim, the numbers are
 * computed from `useConsistency`'s live result, never hardcoded. See S09's own
 * "Display-format note": N is the fixed lookback window named by the phrase itself (this
 * app's pinned `ConsistencyWindow` only offers `'last-30'`, so N = 30 here — the mockup's own
 * "31" is that fixture's specific illustrative value, not a literal string to reproduce).
 */

export const S09_COPY = {
  title: 'Today',
  statLabel: 'Showing up',
  statHelper: 'Share of due days you did the ideal or the fallback.',
  dueSection: 'Due today',
  firstHabitBody: 'Do the ideal or the fallback today. Either one counts.',
  offToggleLabel: 'Emergency day off',
  offToggleA11y: 'Emergency day off, the whole day',
  offToggleSub: 'The whole day. Nothing due today counts against you.',
  offOnToast: "Emergency day off. Nothing counts against you.",
  offUnmarkToast: "Today's mark removed. Your prior log is back.",
  achievementsTeaser: 'Achievements',
  noDataStat: 'No data yet',

  blankSlateHeadline: 'Nothing planned for today yet.',
  blankSlateSubcopy: 'A blank slate. Add one small thing. Something beats nothing.',
  blankSlateAction: 'Add your first task',

  nothingDueHeadline: 'Nothing due right now.',
  nothingDueSubcopy: 'Enjoy the open day, or add something new.',
  nothingDueAction: 'Add a task',

  offTodayMeta: 'Off today',
  pushedFromYesterday: 'From yesterday',

  reentryHeadline: "No workout yesterday. That's okay.",
  reentrySubcopy: "Rest is part of the rhythm. One off day doesn't undo anything.",
  reentryCta: 'Even the fallback counts',
  reentryStatPrefix: 'Your consistency is intact: ',
  reentryStatSuffix: ' you showed up, ideal or fallback.',

  readFailure: "Couldn't load today's tasks. Your data is safe on this device.",
  retry: 'Try again',
  chipRevertToast: "Couldn't save that. Try again.",

  assistantLabel: 'Fallback AI assistant',
  searchLabel: 'Search',
  settingsLabel: 'Settings',
  addTaskLabel: 'Add task',

  firstHabitBannerPrefix: 'Your first habit is set.',
  firstHabitBannerSuffix: '',
} as const;

/**
 * "{x} of the last {n} days", or "{x} of {counted} days in the last {n}" when only some of those
 * days had something due. The percent beside it is x / counted, so the words must name `counted`:
 * "17 of the last 30 days" next to 83% reads as a mistake.
 */
function daysPhrase(x: number, counted: number, windowDays: number): string {
  const c = Math.round(counted);
  return c >= windowDays ? `${x} of the last ${windowDays} days` : `${x} of ${c} ${c === 1 ? 'day' : 'days'} in the last ${windowDays}`;
}

/** Builds the stat-chip detail line. */
export function statLine(x: number, counted: number, windowDays: number): string {
  return daysPhrase(x, counted, windowDays);
}

/** Builds the re-entry-state re-worded stat line — see this file's header note. */
export function reentryStatLine(percent: number, x: number, counted: number, windowDays: number): string {
  return `${S09_COPY.reentryStatPrefix}${percent}% · ${daysPhrase(x, counted, windowDays)}${S09_COPY.reentryStatSuffix}`;
}
