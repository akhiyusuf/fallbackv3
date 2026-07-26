/** M0. F5 consistency types. Algorithm is pinned in docs/ARCHITECTURE.md §6 — do not re-derive. */

import type { Id, LocalDate } from './primitives';

export type ConsistencyScope = 'per-task' | 'aggregate';

/** S25 window switcher. "counted-day" semantics — see docs/ARCHITECTURE.md §6.4. */
export type ConsistencyWindow = 'last-7' | 'last-30' | 'all-time';

/** An explicit date range window, used by F28 buckets and F30 cycle records. */
export interface DateRange {
  readonly from: LocalDate;
  /** Inclusive. */
  readonly to: LocalDate;
}

/**
 * The single result shape every consistency surface renders.
 * `percent === null` means NO DATA YET. It is NEVER 0 in that case (PRD §3.5 edge).
 */
export interface ConsistencyResult {
  readonly scope: ConsistencyScope;
  /** Rounded whole percent, round-half-up. null == no qualifying days. */
  readonly percent: number | null;
  /** Per-task: whole count of shown-up occurrences. Aggregate: exact unrounded Σ f(D). */
  readonly numerator: number;
  /** Per-task: shown-up + missed occurrences. Aggregate: count of qualifying days. */
  readonly denominator: number;
  readonly breakdown: ConsistencyBreakdown;
  /** The calendar days that the counted-day window actually spans, for display and drill-down. */
  readonly countedDates: readonly LocalDate[];
}

/**
 * S25 legend. UNITS DIFFER BY SCOPE and this is deliberate (S25 "Unit note"):
 *  - per-task:  ideal/fallback/off/missed are whole occurrence counts.
 *  - aggregate: ideal/fallback are round-half-up sums of per-day fractional credit;
 *               off is a whole count of fully-off days;
 *               missed is roundHalfUp(denominator − Σ f(D)).
 */
export interface ConsistencyBreakdown {
  readonly ideal: number;
  readonly fallback: number;
  readonly off: number;
  readonly missed: number;
}

/** One row of the S25 aggregate "How the aggregate is calculated" disclosure. */
export interface DayFraction {
  readonly date: LocalDate;
  readonly resolvedTaskIds: readonly Id[];
  readonly shownUpTaskIds: readonly Id[];
  /** |shownUp| / |resolved|. Undefined for excluded days — those are absent from the list entirely. */
  readonly fraction: number;
}

/** F28 trend graph. Granularity coarsens with history volume; never user-selectable. */
export type TrendGranularity = 'weekly' | 'monthly' | 'yearly';

export interface TrendPoint {
  readonly bucketKey: string;
  readonly label: string;
  readonly range: DateRange;
  /** null == the bucket had zero qualifying days: render a break in the line, never a fabricated 0%. */
  readonly percent: number | null;
  readonly breakdown: ConsistencyBreakdown;
}
