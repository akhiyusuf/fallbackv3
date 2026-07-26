/**
 * M2. F13 badge catalogue + F29 tenure ladder. Reconciliation is idempotent and
 * upsert-only: a backward clock never revokes an earned badge.
 *
 * Labels below are exact copy from S27 (SCHEMA.md §7) — verbatim, not re-cased or re-worded.
 * Conditions marked *(design-witnessed)* are confirmed by S27's own ledger; the rest are
 * architect-authored defaults a designer may re-word freely without touching this logic.
 *
 * PROVENANCE NOTE for M5 (review pass 2 non-blocking item): only the `label` fields above are
 * design-pinned rendered copy. `description`/`lockedHint` are this catalogue's OWN working
 * copy for reconciliation/testing purposes, close to but not verbatim S27's locked-detail
 * lines ("Locked — show up 7 days total, ideal or fallback." etc., ALLSCREENS 2407-2414). M5
 * must render its own screen copy from `src/features/progress/copy.ts`, not from these two
 * fields — they are not the pinned strings.
 */
import type { AchievementDef, AchievementUnlock, Id, Instant, LocalDate, Occurrence } from '@/types';
import { addDays, addMonths, addYears, isSameOrBefore, startOfWeek } from './dateMath';

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    key: 'showing-up-7',
    category: 'showing-up',
    label: '7 days',
    description: 'Showed up on 7 days.',
    lockedHint: 'Show up on 7 days, ideal or fallback.',
  },
  {
    key: 'showing-up-30',
    category: 'showing-up',
    label: '30 days',
    description: 'Showed up on 30 days.',
    lockedHint: 'Show up on 30 days, ideal or fallback.',
  },
  {
    key: 'showing-up-50',
    category: 'showing-up',
    label: '50 shown up',
    description: 'Showed up on 50 days.',
    lockedHint: 'Show up on 50 days, ideal or fallback.',
  },
  {
    key: 'showing-up-200',
    category: 'showing-up',
    label: '200 shown up',
    description: 'Showed up on 200 days.',
    lockedHint: 'Show up on 200 days, ideal or fallback.',
  },
  {
    key: 'fallback-safety-net',
    category: 'fallback-wins',
    label: 'Safety net',
    description: 'Logged your first fallback.',
    lockedHint: 'Log a fallback for the first time.',
  },
  {
    key: 'fallback-never-zero',
    category: 'fallback-wins',
    label: 'Never zero',
    description: 'Logged 10 fallbacks.',
    lockedHint: 'Log 10 fallbacks.',
  },
  {
    key: 'fallback-saved-25',
    category: 'fallback-wins',
    label: 'Saved 25×',
    description: 'Logged 25 fallbacks.',
    lockedHint: 'Log 25 fallbacks.',
  },
  {
    key: 'fallback-comeback',
    category: 'fallback-wins',
    // INTERPRETATION, recorded for qa-tester (review pass 1, accepted judgement call, "record
    // it explicitly so qa-tester tests the intended behaviour rather than guessing"): SCHEMA
    // §7 places this in the TASK-LEVEL "fallback-wins" block (same block as the other
    // occurrence-count badges), so this implementation reads it as TASK-LEVEL adjacency — the
    // SAME task missed on day D and shown up on day D+1. The design witness (ALLSCREENS
    // 2697-2699, Maya's ledger) reads DAY-LEVEL instead (any task missed on D, any task shown
    // up on D+1) and the two readings diverge on a mixed day where one task misses while
    // another, on the same day, shows up. Both are defensible; this module commits to
    // task-level. A qa fixture asserting the day-level reading is testing a DIFFERENT,
    // not-yet-built behaviour, not a bug in this one.
    label: 'Comeback',
    description: 'The same task showed up the day right after it was missed.',
    lockedHint: 'Show up on a task the day right after it was missed.',
  },
  {
    key: 'milestone-100-done',
    category: 'milestones',
    label: '100 done',
    description: 'Completed 100 occurrences, ideal or fallback.',
    lockedHint: 'Complete 100 occurrences, ideal or fallback.',
  },
  {
    key: 'milestone-course-x3',
    category: 'milestones',
    label: 'Course ×3',
    description: 'Ran 3 Courses through to their end date.',
    lockedHint: 'Run 3 Courses through to their end date.',
  },
  {
    key: 'milestone-full-week',
    category: 'milestones',
    label: 'Full week',
    description: 'A full 7/7 week — every due day resolved to shown up.',
    lockedHint: 'Show up on every due day for a full week.',
  },
  { key: 'tenure-first-day', category: 'tenure', label: 'First day', description: 'Day one.', lockedHint: 'Automatic on day one.' },
  { key: 'tenure-1-week', category: 'tenure', label: '1 Week', description: '1 week since you started.', lockedHint: '1 week after you started.' },
  { key: 'tenure-1-month', category: 'tenure', label: '1 Month', description: '1 month since you started.', lockedHint: '1 month after you started.' },
  { key: 'tenure-2-months', category: 'tenure', label: '2 Months', description: '2 months since you started.', lockedHint: '2 months after you started.' },
  { key: 'tenure-6-months', category: 'tenure', label: '6 Months', description: '6 months since you started.', lockedHint: '6 months after you started.' },
  { key: 'tenure-1-year', category: 'tenure', label: '1 Year', description: '1 year since you started.', lockedHint: '1 year after you started.' },
  { key: 'tenure-2-years', category: 'tenure', label: '2 Years', description: '2 years since you started.', lockedHint: '2 years after you started.' },
  { key: 'tenure-5-years', category: 'tenure', label: '5 Years', description: '5 years since you started.', lockedHint: '5 years after you started.' },
  { key: 'tenure-10-years', category: 'tenure', label: '10 Years', description: '10 years since you started.', lockedHint: '10 years after you started.' },
  { key: 'tenure-20-years', category: 'tenure', label: '20 Years', description: '20 years since you started.', lockedHint: '20 years after you started.' },
  { key: 'tenure-50-years', category: 'tenure', label: '50 Years', description: '50 years since you started.', lockedHint: '50 years after you started.' },
];

const SHOWN_UP = new Set(['ideal', 'fallback']);

function groupByDate(occurrences: readonly Occurrence[]): Map<LocalDate, Occurrence[]> {
  const map = new Map<LocalDate, Occurrence[]>();
  for (const o of occurrences) {
    if (o.outcome === 'not-due') continue;
    const bucket = map.get(o.date);
    if (bucket) bucket.push(o);
    else map.set(o.date, [o]);
  }
  return map;
}

const TENURE_TIERS: readonly { key: string; unlockedOn: (anchor: LocalDate) => LocalDate }[] = [
  { key: 'tenure-first-day', unlockedOn: (a) => a },
  { key: 'tenure-1-week', unlockedOn: (a) => addDays(a, 7) },
  { key: 'tenure-1-month', unlockedOn: (a) => addMonths(a, 1) },
  { key: 'tenure-2-months', unlockedOn: (a) => addMonths(a, 2) },
  { key: 'tenure-6-months', unlockedOn: (a) => addMonths(a, 6) },
  { key: 'tenure-1-year', unlockedOn: (a) => addYears(a, 1) },
  { key: 'tenure-2-years', unlockedOn: (a) => addYears(a, 2) },
  { key: 'tenure-5-years', unlockedOn: (a) => addYears(a, 5) },
  { key: 'tenure-10-years', unlockedOn: (a) => addYears(a, 10) },
  { key: 'tenure-20-years', unlockedOn: (a) => addYears(a, 20) },
  { key: 'tenure-50-years', unlockedOn: (a) => addYears(a, 50) },
];

export function reconcileAchievements(input: {
  occurrences: readonly Occurrence[];
  tenureAnchor: LocalDate;
  today: LocalDate;
  alreadyUnlocked: readonly AchievementUnlock[];
  /**
   * Extension: Courses that have run through to their own end date (milestone-course-x3),
   * each with that TRUE condition date — review pass 1 fixed a defect where this unlocked
   * with `unlockedOn: today` (the observation date) instead, which breaks F30's "badges
   * unlocked in this cycle" attribution (a badge earned mid-cycle but only reconciled next
   * foreground would misattribute to the wrong cycle). Caller supplies the id only for
   * traceability; it plays no role in the condition itself.
   */
  completedCourses?: readonly { readonly id: Id; readonly endDate: LocalDate }[];
  /**
   * Extension: this module is pure and has no clock of its own — `createdAt` on a NEWLY
   * unlocked badge (the date the app happened to observe it, per SCHEMA.md §7) is stamped
   * with this caller-supplied instant. `unlockedOn` (the TRUE condition date) is always
   * computed from the data, never from `now`.
   */
  now: Instant;
}): AchievementUnlock[] {
  const { occurrences, tenureAnchor, today, alreadyUnlocked, completedCourses = [], now } = input;
  const alreadyKeys = new Set(alreadyUnlocked.map((u) => u.key));
  const qualifying = new Map<string, LocalDate>(); // key -> true condition date

  // ---- showing-up tiers: cumulative SHOWN-UP DAYS (a day counts once if ANY due, non-off
  // task that day resolved ideal/fallback — design-witnessed as day-level, not event-level).
  const byDate = groupByDate(occurrences);
  const shownUpDatesAsc = [...byDate.entries()]
    .filter(([, os]) => os.some((o) => SHOWN_UP.has(o.outcome)))
    .map(([d]) => d)
    .sort();
  const showingUpTiers: readonly [string, number][] = [
    ['showing-up-7', 7],
    ['showing-up-30', 30],
    ['showing-up-50', 50],
    ['showing-up-200', 200],
  ];
  for (const [key, n] of showingUpTiers) {
    if (shownUpDatesAsc.length >= n) qualifying.set(key, shownUpDatesAsc[n - 1] as LocalDate);
  }

  // ---- fallback-wins: task-level occurrence counts.
  const fallbackDatesAsc = occurrences
    .filter((o) => o.outcome === 'fallback')
    .map((o) => o.date)
    .sort();
  const fallbackTiers: readonly [string, number][] = [
    ['fallback-safety-net', 1],
    ['fallback-never-zero', 10],
    ['fallback-saved-25', 25],
  ];
  for (const [key, n] of fallbackTiers) {
    if (fallbackDatesAsc.length >= n) qualifying.set(key, fallbackDatesAsc[n - 1] as LocalDate);
  }

  // ---- fallback-comeback: showed up on the calendar day right after a missed day, same task.
  const byTask = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    if (o.outcome === 'not-due') continue;
    const bucket = byTask.get(o.taskId);
    if (bucket) bucket.push(o);
    else byTask.set(o.taskId, [o]);
  }
  outer: for (const taskOccs of byTask.values()) {
    const sorted = [...taskOccs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i] as Occurrence;
      const next = sorted[i + 1] as Occurrence;
      if (cur.outcome === 'missed' && SHOWN_UP.has(next.outcome) && addDays(cur.date, 1) === next.date) {
        qualifying.set('fallback-comeback', next.date);
        break outer;
      }
    }
  }

  // ---- milestone-100-done: 100 completed occurrences (ideal or fallback), cumulative.
  const doneDatesAsc = occurrences
    .filter((o) => SHOWN_UP.has(o.outcome))
    .map((o) => o.date)
    .sort();
  if (doneDatesAsc.length >= 100) qualifying.set('milestone-100-done', doneDatesAsc[99] as LocalDate);

  // ---- milestone-course-x3: unlocks on the TRUE condition date — the 3rd course's own end
  // date, not whenever the app happened to next reconcile and notice.
  if (completedCourses.length >= 3) {
    const endDatesAsc = [...completedCourses].map((c) => c.endDate).sort();
    qualifying.set('milestone-course-x3', endDatesAsc[2] as LocalDate);
  }

  // ---- milestone-full-week: an ISO week (Mon-Sun) where every one of the 7 days is a
  // counted day (R(D) > 0) with f(D) === 1.0.
  const weekBuckets = new Map<LocalDate, { date: LocalDate; f: number }[]>();
  for (const [date, os] of byDate) {
    const resolved = os.filter((o) => o.outcome === 'ideal' || o.outcome === 'fallback' || o.outcome === 'missed');
    if (resolved.length === 0) continue;
    const shownUp = resolved.filter((o) => SHOWN_UP.has(o.outcome)).length;
    const week = startOfWeek(date);
    const bucket = weekBuckets.get(week);
    const entry = { date, f: shownUp / resolved.length };
    if (bucket) bucket.push(entry);
    else weekBuckets.set(week, [entry]);
  }
  for (const [week, days] of weekBuckets) {
    if (days.length === 7 && days.every((d) => d.f === 1)) {
      const lastDay = days.reduce((a, b) => (a.date > b.date ? a : b));
      qualifying.set('milestone-full-week', lastDay.date);
      break; // first qualifying week is enough — badge is binary, not stacking
    }
    void week;
  }

  // ---- tenure ladder: calendar-elapsed only, consistency-independent.
  for (const tier of TENURE_TIERS) {
    const unlockedOn = tier.unlockedOn(tenureAnchor);
    if (isSameOrBefore(unlockedOn, today)) qualifying.set(tier.key, unlockedOn);
  }

  const result: AchievementUnlock[] = [];
  for (const [key, unlockedOn] of qualifying) {
    if (alreadyKeys.has(key)) continue; // upsert-only, never revoked, never re-dated
    result.push({ key, unlockedOn, createdAt: now });
  }
  return result;
}
