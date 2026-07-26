/**
 * M2. Resolves one (task, date) into an OccurrenceOutcome. The single source of
 * truth for chip -> outcome mapping and for "missed" (docs/ARCHITECTURE.md §6.1-6.2).
 */
import type { ChipState, DayLog, LocalDate, Occurrence, OffDayMark, TaskWithSteps } from '@/types';
import { isBefore } from './dateMath';
import { dueIdealStepIds, isDue } from './occurrence';

/**
 * F3 auto-log rule, and F12's multi-dose extension: all due ideal steps complete (and every
 * dose handled, for a Course) -> 'done'; >=1 ideal step done, or some but not all doses ->
 * 'fallback'; nothing done -> 'todo'. A task with no ideal steps due (untracked, or a due
 * occurrence with zero scheduled steps) has nothing to auto-complete and stays 'todo' until a
 * manual chip tap.
 */
function computeAutoChip(
  dueIdealIds: readonly string[],
  completedStepIds: readonly string[],
  dosesRequired: number,
  dosesCompleted: number,
): 'todo' | 'done' | 'fallback' {
  const completed = new Set(completedStepIds);
  const totalIdeal = dueIdealIds.length;
  const completedIdealCount = dueIdealIds.filter((id) => completed.has(id)).length;
  const dosesOk = dosesRequired <= 1 || dosesCompleted >= dosesRequired;
  const hasAutoLoggableWork = totalIdeal > 0 || dosesRequired > 1;

  if (!hasAutoLoggableWork) return 'todo'; // manual-chip-only task (no ideal steps, no doses)

  const allIdealComplete = totalIdeal === 0 || completedIdealCount === totalIdeal;
  if (allIdealComplete && dosesOk) return 'done';
  if (completedIdealCount > 0 || dosesCompleted > 0) return 'fallback';
  return 'todo';
}

/** ARCHITECTURE.md §6.1 — the ONE place the chip -> outcome mapping lives. */
function mapChipToOutcome(chip: ChipState, date: LocalDate, today: LocalDate): Occurrence['outcome'] {
  switch (chip) {
    case 'done':
      return 'ideal';
    case 'fallback':
      return 'fallback';
    case 'skip':
      return 'missed'; // resolves missed on ANY day, including today
    case 'todo':
    default:
      // "To do / no row" -> pending while the date is today (or hasn't arrived yet); missed
      // once the day has ended. A not-yet-arrived future due date reads the same as today —
      // neither has "ended" yet, so neither can be a real miss.
      return isBefore(date, today) ? 'missed' : 'pending';
  }
}

const notDueOccurrence = (task: TaskWithSteps, date: LocalDate, chipState: ChipState | null): Occurrence => ({
  taskId: task.id,
  date,
  outcome: 'not-due',
  dueIdealStepIds: [],
  completedStepIds: [],
  chipState,
  dosesRequired: 0,
  dosesCompleted: 0,
});

export function resolveOccurrence(input: {
  task: TaskWithSteps;
  date: LocalDate;
  today: LocalDate;
  /** The log row keyed by exactly `(task.id, date)`, if any. */
  log: DayLog | null;
  offMarks: readonly OffDayMark[];
  /** See `occurrence.ts`'s `isDue` doc comment — the device-local creation-day bound, supplied by the caller. */
  notBefore?: LocalDate;
  /**
   * F7 snooze/move (review pass 1, blocking item 6). A log row from a DIFFERENT date whose
   * own `movedToDate` equals `date` — i.e. an occurrence that was relocated INTO this date.
   * "Snooze/move affects the occurrence, not the cadence" (MODULES M4): the occurrence's
   * whole record (chip/steps/doses) travels with it, so when present this date is treated
   * as due even if the cadence wouldn't naturally place it here, and the moved log's own
   * data — not `log`'s — drives the outcome.
   */
  movedInLog?: DayLog | null;
}): Occurrence {
  const { task, date, today, log, offMarks, notBefore, movedInLog } = input;

  // This date's own occurrence was relocated elsewhere: it vacates this date entirely,
  // regardless of cadence due-ness — never "missed" here, on any day (SCHEMA §4 `moved_to_date`).
  if (log && log.movedToDate !== null) {
    return notDueOccurrence(task, date, log.chipState);
  }

  const due = movedInLog != null ? true : isDue(task, date, notBefore);
  if (!due) {
    return notDueOccurrence(task, date, log?.chipState ?? null);
  }

  // A moved-IN occurrence carries its own record with it; otherwise this date's own log applies.
  const effectiveLog = movedInLog ?? log;

  const dueIdealIds = dueIdealStepIds(task, date, notBefore);
  const completedStepIds = effectiveLog ? effectiveLog.completedStepIds.filter((id) => dueIdealIds.includes(id)) : [];
  const dosesRequired = task.dosesPerDay;
  const dosesCompleted = effectiveLog?.dosesCompleted ?? 0;

  const isOff = offMarks.some((m) => m.date === date && (m.taskId === null || m.taskId === task.id));
  if (isOff) {
    return {
      taskId: task.id,
      date,
      outcome: 'off',
      dueIdealStepIds: dueIdealIds,
      completedStepIds,
      chipState: effectiveLog?.chipState ?? null,
      dosesRequired,
      dosesCompleted,
    };
  }

  const autoChip = computeAutoChip(dueIdealIds, completedStepIds, dosesRequired, dosesCompleted);
  // A manual chip wins until the user changes it again (docs/SCHEMA.md §4 `is_manual_override`).
  const effectiveChip: ChipState =
    effectiveLog && effectiveLog.isManualOverride && effectiveLog.chipState !== null ? effectiveLog.chipState : autoChip;

  return {
    taskId: task.id,
    date,
    outcome: mapChipToOutcome(effectiveChip, date, today),
    dueIdealStepIds: dueIdealIds,
    completedStepIds,
    chipState: effectiveChip,
    dosesRequired,
    dosesCompleted,
  };
}

/** Auto-log rule (F3): all due ideal steps complete -> ideal; >=1 but not all -> fallback; 0 -> todo. */
export function autoChipState(occurrence: Occurrence): 'todo' | 'done' | 'fallback' {
  return computeAutoChip(occurrence.dueIdealStepIds, occurrence.completedStepIds, occurrence.dosesRequired, occurrence.dosesCompleted);
}
