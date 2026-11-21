/**
 * M2. F5 at both scopes, plus F28 buckets and F30 cycle windows — ONE implementation,
 * windowed differently. Pinned algorithm: docs/ARCHITECTURE.md §6.
 *
 * Both entry points are pure functions of an already-resolved `occurrences` array (produced
 * by `dayState.resolveOccurrence`, one entry per DUE (task, date) — never-due dates simply
 * never appear, which is exactly the "excluded entirely, neither counted nor tallied" rule
 * for §6.4's window walk, so no separate raw-calendar iteration is needed here). The caller
 * (`src/queries`) is responsible for supplying every occurrence relevant to the window being
 * asked for; this module does the windowing, walking and rounding.
 */
import { roundHalfUp, toPercent } from '@/lib/number';
import type {
  ConsistencyBreakdown,
  ConsistencyResult,
  ConsistencyWindow,
  DateRange,
  DayFraction,
  Id,
  LocalDate,
  Occurrence,
} from '@/types';

const RESOLVED = new Set(['ideal', 'fallback', 'missed']);
const SHOWN_UP = new Set(['ideal', 'fallback']);

/**
 * The day an occurrence counts for (thirtieth pass). A habit pushed to tomorrow counts for the day it
 * was pushed FROM: done tomorrow, that day was kept; not done, that day was missed. Its XP is keyed
 * the same way. Counting it on the day it landed made one habit read 1 of 3 on its own and 1 of 2
 * under all habits (a day with its own and the pushed occurrence is one calendar day but two
 * occurrences), and left the pushed-from day out of the record entirely.
 */
export function countingDate(o: Occurrence): LocalDate {
  return o.pushedFrom ?? o.date;
}

function isDateRange(w: ConsistencyWindow | DateRange): w is DateRange {
  return typeof w === 'object';
}

/** N for a counted-day walk. `null` = no cap (all-time). */
function countCap(w: ConsistencyWindow): number | null {
  if (w === 'last-7') return 7;
  if (w === 'last-30') return 30;
  return null; // all-time
}

function sortDatesDesc<T extends { date: LocalDate }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ------------------------------------------------------------------ per-task scope (§6.2) */

export function perTaskConsistency(input: {
  taskId: Id;
  occurrences: readonly Occurrence[];
  window: ConsistencyWindow | DateRange;
  today: LocalDate;
}): ConsistencyResult {
  const { occurrences, window, today } = input;
  const mine = occurrences.filter((o) => o.taskId === input.taskId && o.outcome !== 'not-due' && !(o.date > today));

  let rows: readonly Occurrence[];
  let cap: number | null;
  const counted = mine.map((o) => ({ o, date: countingDate(o) }));
  if (isDateRange(window)) {
    rows = sortDatesDesc(counted.filter((r) => r.date >= window.from && r.date <= window.to)).map((r) => r.o);
    cap = null;
  } else {
    rows = sortDatesDesc(counted).map((r) => r.o);
    cap = countCap(window);
  }

  let denom = 0;
  let idealCount = 0;
  let fallbackCount = 0;
  let missedCount = 0;
  let offCount = 0;
  const countedDates: LocalDate[] = [];

  for (const o of rows) {
    if (cap !== null && denom >= cap) break;
    if (o.outcome === 'pending') continue; // excluded entirely — neither counted nor tallied
    if (o.outcome === 'off') {
      offCount++; // skipped without consuming a slot, but tallied
      continue;
    }
    denom++;
    countedDates.push(countingDate(o));
    if (o.outcome === 'ideal') idealCount++;
    else if (o.outcome === 'fallback') fallbackCount++;
    else if (o.outcome === 'missed') missedCount++;
  }

  const numerator = idealCount + fallbackCount;
  const breakdown: ConsistencyBreakdown = { ideal: idealCount, fallback: fallbackCount, off: offCount, missed: missedCount };

  return {
    scope: 'per-task',
    percent: toPercent(numerator, denom),
    numerator,
    denominator: denom,
    breakdown,
    countedDates: countedDates.reverse(), // chronological, ascending
  };
}

/* ------------------------------------------------------------------ aggregate scope (§6.3) */

/**
 * Splits `total` whole days among shares that add up to it (within floating error): each share is
 * rounded down, then the days left over go to the shares cut the most, the earlier share first on a
 * tie. The result always sums to `total`.
 */
export function apportion(shares: readonly number[], total: number): number[] {
  const clean = shares.map((x) => Math.max(0, Math.round(x * 1e9) / 1e9));
  const out = clean.map((x) => Math.floor(x));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = clean
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && order.length > 0; k = (k + 1) % order.length, left--) out[order[k]!.i]! += 1;
  return out;
}

function groupByDate(occurrences: readonly Occurrence[]): Map<LocalDate, Occurrence[]> {
  const map = new Map<LocalDate, Occurrence[]>();
  for (const o of occurrences) {
    if (o.outcome === 'not-due') continue;
    const date = countingDate(o);
    const bucket = map.get(date);
    if (bucket) bucket.push(o);
    else map.set(date, [o]);
  }
  return map;
}

export function aggregateConsistency(input: {
  occurrences: readonly Occurrence[];
  window: ConsistencyWindow | DateRange;
  today: LocalDate;
}): ConsistencyResult {
  const { occurrences, window, today } = input;
  const byDate = groupByDate(occurrences.filter((o) => !(o.date > today)));
  let dates = [...byDate.keys()].sort().reverse(); // descending

  let cap: number | null;
  if (isDateRange(window)) {
    dates = dates.filter((d) => d >= window.from && d <= window.to);
    cap = null;
  } else {
    cap = countCap(window);
  }

  let denom = 0;
  let idealCreditSum = 0;
  let fallbackCreditSum = 0;
  let offDayCount = 0;
  const countedDates: LocalDate[] = [];
  let fullDays = 0;
  let partialDays = 0;
  let missedDays = 0;

  for (const date of dates) {
    if (cap !== null && denom >= cap) break;
    const dueToday = byDate.get(date) ?? [];
    const resolvedNonOff = dueToday.filter((o) => RESOLVED.has(o.outcome));

    if (resolvedNonOff.length > 0) {
      // A counted day (|R(D)| > 0). Off-ness and pending-ness compose PER TASK, never per day —
      // the off/pending tasks are simply excluded from R(D); the day is still counted on the
      // strength of its other, resolved tasks.
      const total = resolvedNonOff.length;
      const idealHere = resolvedNonOff.filter((o) => o.outcome === 'ideal').length;
      const fallbackHere = resolvedNonOff.filter((o) => o.outcome === 'fallback').length;
      denom++;
      countedDates.push(date);
      idealCreditSum += idealHere / total;
      fallbackCreditSum += fallbackHere / total;
      const shownUpHere = idealHere + fallbackHere;
      if (shownUpHere === total) fullDays++;
      else if (shownUpHere === 0) missedDays++;
      else partialDays++;
      continue;
    }

    // |R(D)| === 0: either every due task that day was off (a "fully off" day — tallied, not
    // counted), or the remainder were merely pending (a transient day — excluded entirely,
    // exactly like a day with nothing due at all).
    if (dueToday.length > 0 && dueToday.every((o) => o.outcome === 'off')) {
      offDayCount++;
    }
  }

  const numerator = idealCreditSum + fallbackCreditSum; // Σ f(D), carried at full precision
  // Display rounding (twenty-seventh pass, the human's call): ideal + fallback + missed always add up
  // to the days counted. Rounding each on its own could not promise that (a day split between an
  // ideal and a fallback read "1 ideal, 1 fallback" out of 1 day), so whole days are shared out by
  // largest remainder.
  const [ideal = 0, fallback = 0, missed = 0] = apportion([idealCreditSum, fallbackCreditSum, denom - numerator], denom);
  const breakdown: ConsistencyBreakdown = { ideal, fallback, off: offDayCount, missed };

  return {
    scope: 'aggregate',
    percent: toPercent(numerator, denom),
    numerator,
    denominator: denom,
    breakdown,
    countedDates: countedDates.reverse(),
    days: { full: fullDays, partial: partialDays, missed: missedDays },
  };
}

/** Powers S25's "How the aggregate is calculated" disclosure table. */
export function dayFractions(occurrences: readonly Occurrence[]): DayFraction[] {
  const byDate = groupByDate(occurrences);
  const dates = [...byDate.keys()].sort(); // ascending
  const out: DayFraction[] = [];

  for (const date of dates) {
    const dueToday = byDate.get(date) ?? [];
    const resolved = dueToday.filter((o) => RESOLVED.has(o.outcome));
    if (resolved.length === 0) continue; // excluded days are absent from the list entirely
    const shownUp = resolved.filter((o) => SHOWN_UP.has(o.outcome));
    out.push({
      date,
      resolvedTaskIds: resolved.map((o) => o.taskId),
      shownUpTaskIds: shownUp.map((o) => o.taskId),
      fraction: shownUp.length / resolved.length,
    });
  }

  return out;
}
