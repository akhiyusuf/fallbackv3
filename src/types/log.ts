/** M0. Per-day logs, off-day marks, occurrence outcomes. PRD §3.3 / §3.4 / §3.5. */

import type { Id, Instant, LocalDate } from './primitives';

/**
 * The four user-selectable chip states (PRD §6). "Missed" is NOT a chip state —
 * it is a DERIVED history label (see OccurrenceOutcome).
 */
export type ChipState = 'todo' | 'done' | 'fallback' | 'skip';

/**
 * PRD-pinned chip -> outcome mapping (the advisory finding the architect closed):
 *   done     -> ideal     (a showing-up state)
 *   fallback -> fallback  (a showing-up state)
 *   skip     -> missed    (resolved missed on ANY day, including today)
 *   todo     -> pending while the day is today; missed once the day has ended
 */
export type OccurrenceOutcome =
  | 'ideal'
  | 'fallback'
  | 'missed'
  | 'off'
  | 'pending'
  | 'not-due';

export const SHOWN_UP_OUTCOMES = ['ideal', 'fallback'] as const;
export const RESOLVED_OUTCOMES = ['ideal', 'fallback', 'missed'] as const;

/** One persisted log row per (taskId, date). Absent row == never touched. */
export interface DayLog {
  readonly id: Id;
  readonly taskId: Id;
  readonly date: LocalDate;
  /** null == no chip has ever been set for this occurrence. */
  readonly chipState: ChipState | null;
  /** true when the user set the chip explicitly; a manual override wins over step auto-log until changed. */
  readonly isManualOverride: boolean;
  /** Ideal step ids completed on this occurrence. */
  readonly completedStepIds: readonly Id[];
  /** F12: how many doses of a multi-dose Course are handled on this day. */
  readonly dosesCompleted: number;
  /** F7 snooze/move: when set, this occurrence was relocated to another date. Affects the occurrence, not the cadence. */
  readonly movedToDate: LocalDate | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

/** F4. Two grains: whole-day (`taskId === null`) and task-day. */
export interface OffDayMark {
  readonly id: Id;
  readonly date: LocalDate;
  /** null => whole day off; otherwise the single task marked off that day. */
  readonly taskId: Id | null;
  /** Snapshot of the chip state at mark time so un-marking restores exactly what was logged. */
  readonly priorChipState: ChipState | null;
  readonly createdAt: Instant;
}

/** F27. Reference-only "used it" entry. Zero effect on consistency and on XP of either kind. */
export interface AsNeededUse {
  readonly id: Id;
  readonly taskId: Id;
  readonly date: LocalDate;
  /** null when the routine defined no ideal/fallback. */
  readonly marker: 'ideal' | 'fallback' | null;
  readonly createdAt: Instant;
}

/** One resolved occurrence of one task on one calendar day — the atom every metric is built from. */
export interface Occurrence {
  readonly taskId: Id;
  readonly date: LocalDate;
  readonly outcome: OccurrenceOutcome;
  /** Ideal step ids due on THIS occurrence (F23/F24). Empty for untracked tasks. */
  readonly dueIdealStepIds: readonly Id[];
  readonly completedStepIds: readonly Id[];
  readonly chipState: ChipState | null;
  readonly dosesRequired: number;
  readonly dosesCompleted: number;
}
