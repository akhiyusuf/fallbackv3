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
  offToggleLabel: 'Mark today off',
  offOnToast: 'Today marked off — nothing due counts against your %.',
  offUnmarkToast: "Today's mark removed — your prior log is back.",
  achievementsTeaser: 'See your achievements',
  noDataStat: 'No data yet · see your dashboard →',

  blankSlateHeadline: 'Nothing planned for today yet.',
  blankSlateSubcopy: 'A blank slate. Add one small thing — something beats nothing.',
  blankSlateAction: 'Add your first task',

  nothingDueHeadline: 'Nothing due right now.',
  nothingDueSubcopy: 'Enjoy the open day, or add something new.',
  nothingDueAction: '+ Add a task',

  offTodayMeta: 'Off today',

  reentryHeadline: 'No workout yesterday — that’s okay.',
  reentrySubcopy: 'Rest is part of the rhythm. One off day doesn’t undo anything.',
  reentryCta: 'Even 10 pushups counts →',
  reentryStatPrefix: 'Your consistency is intact — ',
  reentryStatSuffix: ' you showed up — ideal or fallback.',

  readFailure: "Couldn't load today's tasks. Your data is safe on this device.",
  retry: 'Retry',
  chipRevertToast: "Couldn't save that — try again.",

  assistantLabel: 'Fallback AI assistant',
  searchLabel: 'Search',
  settingsLabel: 'Settings',
  addTaskLabel: 'Add task',

  firstHabitBannerPrefix: 'Today, ',
  firstHabitBannerSuffix: ' · your first habit is set 🌱',
} as const;

/** Builds the stat-chip primary display: "{pct}% · {x} of the last {n} days →". */
export function statLine(percent: number, x: number, windowDays: number): string {
  return `${percent}% · ${x} of the last ${windowDays} days →`;
}

/** Builds the re-entry-state re-worded stat line — see this file's header note. */
export function reentryStatLine(percent: number, x: number, windowDays: number): string {
  return `${S09_COPY.reentryStatPrefix}${percent}% · ${x} of the last ${windowDays} days${S09_COPY.reentryStatSuffix}`;
}
