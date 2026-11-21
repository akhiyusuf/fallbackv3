/**
 * M5 — verbatim copy for S25-S30, transcribed from
 * design-input/fallback-handoff/uploads/ALLSCREENS_1.md.
 *
 * Per achievements.ts's own PROVENANCE NOTE: only `AchievementDef.label` is design-pinned
 * rendered copy. `description`/`lockedHint` on that catalogue are M2's own working copy for
 * reconciliation testing, NOT this screen's pinned strings. S27's exact locked-detail lines
 * are transcribed here instead, in `SHOWING_UP_LOCKED_HINT`. Only four locked-hint lines are
 * given verbatim by the spec (the "showing-up" category); fallback-wins/milestones locked
 * hints are not pinned by the design pass, so `OTHER_LOCKED_HINT` below is this module's own
 * reasonable, non-pinned copy (judgment call — see build report).
 */

import type { DayCounts } from '@/types';

import { dayCountsLine } from './dayCountsLine';

export const S25_COPY = {
  appBarTitle: 'Your consistency',
  scopeTabs: { perTask: 'One task', aggregate: 'All tasks' } as const,
  windowTabs: { last7: '7 days', last30: '30 days', allTime: 'All time' } as const,
  taskSelectLabel: 'Task',
  explainer: 'Off days are neutral, and a fallback still counts as showing up.',
  historyLink: 'Full history',
  historySub: 'Your trend since day one',
  numeralLabel: 'showed up',
  disclosureIntro: 'Each day counts by the share of its due tasks you showed up for. A worked example:',
  disclosureHeader: 'How the all-tasks number is calculated',
  disclosureColumns: ['Day', 'Due tasks', 'Shown up', 'Day fraction'] as const,
  emptyHeadline: 'No data yet',
  emptySubcopy: 'Once a due day resolves (ideal, fallback, or missed), your consistency will show up here.',
  errorMessage: "Couldn't load your consistency right now.",
  retryLabel: 'Try again',
  offNotePerTask: (n: number) => `${n} ${n === 1 ? 'day was' : 'days were'} off, not counted either way.`,
  offNoteAggregate: (n: number) => `${n} ${n === 1 ? 'day was' : 'days were'} fully off, not counted either way.`,
  perTaskSubcopy: (ideal: number, fallback: number, numerator: number, denominator: number) =>
    `${ideal} ideal + ${fallback} fallback = ${numerator} of ${denominator} counted days`,
  /** Twenty-ninth pass: whole days, never a weighted "≈27.5 of 30" (see dayCountsLine.ts). */
  aggregateSubcopy: (days: DayCounts, period: string) => dayCountsLine(days, period),
  aggregateUnitCaption: 'A full day had every habit due done, ideal or fallback. A partial day had some of them.',
  /** ALLSCREENS 2008-2012: appended when the counted-day window truncates because the task's
   *  whole history so far is shorter than the fixed 7/30-day preset. */
  truncatedWindowNote: (windowDays: number) => `This task's whole history so far is shorter than ${windowDays} days.`,
  /** ALLSCREENS 1557-1568 / 2034-2040: the aggregate disclosure is a STANDALONE illustrative
   *  fixture — a 3-day toy example from PRD §3.5/§6 — never the user's own live history. Pinned
   *  verbatim, including the total line. */
  disclosureFixtureRows: [
    'Wed: 2 of 2 tasks shown up, counts as 1.0',
    'Thu: 1 of 3 tasks shown up (2 missed), counts as 0.33',
    'Fri: every due task was off, not counted',
  ] as const,
  disclosureFixtureTotal: 'Total: 1.33 ÷ 2 counted days = 67%',
} as const;

/** Shared helper: whole numbers render bare, fractional ones to one decimal place. */
export function formatOneDecimal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const S26_COPY = {
  title: 'All-time trend',
  intro: 'How often you showed up, across your whole history. Same maths as your consistency screen, zoomed out.',
  granularityTag: { weekly: 'Week by week', monthly: 'Month by month', yearly: 'Year by year' } as const,
  dataNote: 'Stretches with nothing due show as a break in the line, never as 0%.',
  emptyHeadline: 'No data yet',
  emptySubcopy: 'Your trend will appear as history builds.',
  errorMessage: "Couldn't load your trend right now.",
  retryLabel: 'Try again',
  graphAccessibilityLabel: 'Your all-time consistency trend',
} as const;

export const S27_COPY = {
  title: 'Achievements',
  cadenceLabel: { weekly: 'Weekly XP', monthly: 'Monthly XP' } as const,
  resetsOnPrefix: 'Resets on',
  resetCadenceLabel: 'Resets',
  cadenceOptions: [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ] as const,
  tabs: { all: 'All', earned: 'Earned', locked: 'Locked' } as const,
  categoryHeaders: {
    'showing-up': 'Showing up',
    'fallback-wins': 'Fallback wins',
    milestones: 'Milestones',
    tenure: 'Tenure',
  } as const,
  recordsLink: 'Cycle records',
  recordsSub: 'A recap of each finished cycle',
  badgesHeading: 'Badges',
  noneEarned: 'None earned yet.',
  noneLocked: 'All earned.',
  lifetimeSubline: (xp: number) => `${xp} XP all time`,
  newUserBanner: 'Show up once, ideal or fallback, and your first badge is on its way.',
  errorMessage: "Couldn't load your achievements right now.",
  retryLabel: 'Try again',
  earnedDetail: (dateLabel: string) => `Earned ${dateLabel}.`,
  tenureLockedDetail: (dateLabel: string, relative: string) => `Unlocks on ${dateLabel}, ${relative} from your first day.`,
} as const;

/** S27 spec's exact locked-detail lines (ALLSCREENS_1.md 2407-2414) — the "showing-up" category only. */
export const SHOWING_UP_LOCKED_HINT: Record<string, string> = {
  'showing-up-7': 'Show up 7 days total, ideal or fallback.',
  'showing-up-30': 'Show up 30 days total.',
  'showing-up-50': 'Show up 50 days total.',
  'showing-up-200': 'Show up 200 days total.',
};

/** Not pinned by the design pass — this module's own reasonable copy (judgment call). */
export const OTHER_LOCKED_HINT: Record<string, string> = {
  'fallback-safety-net': 'Log your first fallback.',
  'fallback-never-zero': 'Log 10 fallbacks.',
  'fallback-saved-25': 'Log 25 fallbacks.',
  'fallback-comeback': 'Show up on a task the day right after it was missed.',
  'milestone-100-done': 'Complete 100 occurrences, ideal or fallback.',
  'milestone-course-x3': 'Run 3 Courses through to their end date.',
  'milestone-full-week': 'Show up on every due day for a full week.',
};

/** S27's tenure tier relative-offset phrasing, used both in the locked-detail line and to
 *  derive the absolute unlock date via `@/lib/date` (calendar arithmetic, not domain math). */
export const TENURE_OFFSETS: Record<string, { readonly relative: string; readonly kind: 'days' | 'months' | 'years'; readonly amount: number }> = {
  'tenure-first-day': { relative: 'day one', kind: 'days', amount: 0 },
  'tenure-1-week': { relative: '1 week', kind: 'days', amount: 7 },
  'tenure-1-month': { relative: '1 month', kind: 'months', amount: 1 },
  'tenure-2-months': { relative: '2 months', kind: 'months', amount: 2 },
  'tenure-6-months': { relative: '6 months', kind: 'months', amount: 6 },
  'tenure-1-year': { relative: '1 year', kind: 'years', amount: 1 },
  'tenure-2-years': { relative: '2 years', kind: 'years', amount: 2 },
  'tenure-5-years': { relative: '5 years', kind: 'years', amount: 5 },
  'tenure-10-years': { relative: '10 years', kind: 'years', amount: 10 },
  'tenure-20-years': { relative: '20 years', kind: 'years', amount: 20 },
  'tenure-50-years': { relative: '50 years', kind: 'years', amount: 50 },
};

export const S28_COPY = {
  levelUpHeadline: (level: number) => `You're now Level ${level}.`,
  levelUpSubhead: (title: string) => `New title: ${title}.`,
  /**
   * ALLSCREENS' exact body copy is pinned only to its own worked example ("And you just crossed
   * 100 tasks done…" — Level 8 / 100-done demo). This screen's route contract (celebrate.tsx's
   * header) only ever hands us post-crossing lifetime XP, never a completed-occurrence count, so
   * that fact is never witnessable here — rendering it for every level-up would be false for
   * nearly all of them (review pass 1, blocking item 5). Every level-up therefore gets this
   * tone-matched, non-pinned body instead (judgment call, same category as `OTHER_LOCKED_HINT`).
   */
  levelUpBody: (level: number) => `Level ${level}. That's real consistency showing up, not luck.`,
  /** Not pinned by the design pass (the spec's "3 fresh badges" is that same worked example's
   *  count) — this module has no reachable-badges count to report, so this is generic,
   *  tone-matched forward copy (judgment call). */
  forwardLine: 'More badges are within reach.',
  tenureHeadline: (label: string) => `You've reached ${label}.`,
  badgeHeadline: (label: string) => `Badge earned: ${label}.`,
  /** Pinned verbatim ONLY for the 1-year tier — the design's own worked example (ALLSCREENS S28
   *  Copy). Rendering this sentence for any other tier is incoherent (a 1-week badge followed by
   *  "A full year with Fallback" — review pass 1, blocking item 5). */
  tenureBodyPinned: "A full year with Fallback, however those days went. It measures time, not performance.",
  /** Not pinned by the design pass — tone-matched copy for every tenure tier other than 1-year,
   *  deliberately generic (never restates a specific duration the headline didn't earn) —
   *  judgment call, same category as `OTHER_LOCKED_HINT`. */
  tenureBodyGeneric: "Calendar time with Fallback, however those days went. It measures time, not performance.",
  dismissButton: 'Nice',
} as const;

/** Only the 1-year tenure tier gets the spec's pinned body copy (review pass 1, blocking item 5). */
export function tenureBodyFor(badgeKey: string | undefined): string {
  return badgeKey === 'tenure-1-year' ? S28_COPY.tenureBodyPinned : S28_COPY.tenureBodyGeneric;
}

export const S29_COPY = {
  title: 'Cycle records',
  currentHeading: 'This cycle',
  pastHeading: 'Past cycles',
  inProgressPrefix: 'In progress',
  xpSoFarSuffix: 'XP so far',
  finalizesNote: (dateLabel: string) => `Ends ${dateLabel}, then it moves to past cycles.`,
  archivedTag: 'Archived',
  emptyHeadline: 'No recaps yet',
  emptySubcopyMonthly: 'Your first recap arrives at the end of this month.',
  emptySubcopyWeekly: 'Your first recap arrives at the end of this week.',
  errorMessage: "Couldn't load your cycle records right now.",
  retryLabel: 'Try again',
  shortCycleNote: 'Short cycle, cadence changed part-way.',
  badgeCount: (n: number) => `${n} ${n === 1 ? 'badge' : 'badges'}`,
  cyclingXpPrefix: 'Cycle XP',
} as const;

export const S30_COPY = {
  title: 'Cycle detail',
  archivedSuffix: 'Archived',
  cyclingXpRowPrefix: 'XP this cycle',
  badgesHeader: 'Badges unlocked this cycle',
  noBadges: 'No new badges this cycle',
  shortCycleNote: 'Short cycle, cadence changed part-way.',
  errorMessage: "Couldn't load this cycle right now.",
  retryLabel: 'Try again',
  // Honest approximation — see build report's contract-gap note: `CycleRecord` carries only
  // the ROUNDED breakdown, not the raw unrounded numerator/denominator S25's "≈X.X of Y"
  // wording needs, so this avoids presenting a false decimal.
  subline: (shownUp: number, denominator: number) => `About ${shownUp} of ${denominator} counted days (weighted by that day's tasks)`,
} as const;
