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

/**
 * Resolves a date already known to be due (naturally, or via a moved-in record) into its
 * full outcome: off-check, auto-log rule, manual-override precedence, chip -> outcome
 * mapping. Shared by R-1 (moved-in due-ness) and R-3 (natural due-ness) in
 * `resolveOccurrence` below — one computation, two entry points, per ADVICE-M2.md Ruling 1.
 */
function resolveDueOccurrence(
  task: TaskWithSteps,
  date: LocalDate,
  today: LocalDate,
  effectiveLog: DayLog | null,
  offMarks: readonly OffDayMark[],
  notBefore: LocalDate | undefined,
): Occurrence {
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

/**
 * ADVICE-M2.md Supplement B, B1 — the ONE pure "which row is this occurrence's data?"
 * answerer. `resolveOccurrence` below (the read path) and `src/queries/internal.ts`'s
 * write-target resolver (the write path, T-1/T-2) BOTH consume this — no second
 * implementation of the clause selection may exist anywhere. F1 happened precisely because
 * reads resolved a carrier (Supplement A's clauses a/b/c) while writes addressed storage by
 * raw date-key independently; this function is what makes "which row" have exactly one
 * answer.
 *
 * `natural` is `isDue(task, date, notBefore)`, computed once by the caller (this function
 * stays a plain data triple -> decision, no task/date logic of its own).
 */
export type Carrier =
  | { readonly kind: 'own-live'; readonly log: DayLog } // Supplement A clause (a)
  | { readonly kind: 'own-create' } // Supplement A clause (b), or the plain R-3 rowless case
  | { readonly kind: 'visitor'; readonly row: DayLog } // Supplement A clause (c)
  | { readonly kind: 'none' }; // R-2 vacated source, or R-3 plainly not-due

export function designateCarrier(input: { log: DayLog | null; movedInLog: DayLog | null; natural: boolean }): Carrier {
  const { log, movedInLog, natural } = input;
  if (movedInLog != null) {
    if (log && log.movedToDate === null) return { kind: 'own-live', log }; // (a) — a real state at D always wins
    if (log === null && natural) return { kind: 'own-create' }; // (b) — merge keeps D's blank state, never manufactures one
    return { kind: 'visitor', row: movedInLog }; // (c) — the visitor is the only occurrence present
  }
  if (log && log.movedToDate !== null) return { kind: 'none' }; // R-2 — vacated, never "missed" here
  if (!natural) return { kind: 'none' }; // R-3 — plainly not-due
  if (log) return { kind: 'own-live', log };
  return { kind: 'own-create' };
}

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
   * F7 snooze/move. A log row from a DIFFERENT date whose own `movedToDate` equals `date` —
   * i.e. an occurrence relocated INTO this date (`inbound(D)` in ADVICE-M2.md Ruling 1,
   * already tie-broken to the single display winner by the caller). See
   * `resolveOneOccurrence` in `src/queries/internal.ts`, the ONLY place both `log` and
   * `movedInLog` are looked up, so every caller (read or mutation) resolves through this
   * exact same precedence — never two independent implementations.
   */
  movedInLog?: DayLog | null;
}): Occurrence {
  const { task, date, today, log, offMarks, notBefore, movedInLog } = input;

  // R-1 (ADVICE-M2.md Ruling 1, binding — supersedes the pass-2 N1 fix's check order): a
  // moved-in record confers due-ness UNCONDITIONALLY, evaluated BEFORE any vacate check.
  // This is what makes C6 resolve correctly — task due on both A and B; B->C then A->B: B's
  // own row is itself residue (pointing onward to C), but that residue must never annihilate
  // A's occurrence, which is genuinely due at B via the moved-in record.
  //
  // The carrier decision itself lives in `designateCarrier` above (Supplement B) — this
  // function only turns that decision into an `Occurrence`.
  const carrier = designateCarrier({ log, movedInLog: movedInLog ?? null, natural: isDue(task, date, notBefore) });
  switch (carrier.kind) {
    case 'own-live':
      return resolveDueOccurrence(task, date, today, carrier.log, offMarks, notBefore);
    case 'own-create':
      return resolveDueOccurrence(task, date, today, null, offMarks, notBefore);
    case 'visitor':
      return resolveDueOccurrence(task, date, today, carrier.row, offMarks, notBefore);
    case 'none':
      // R-2 (vacated source) and R-3 (plainly not-due) both land here — never "missed", on
      // any day; `log?.chipState` surfaces a vacated own log's last chip as residue metadata
      // only, exactly as before this refactor.
      return notDueOccurrence(task, date, log?.chipState ?? null);
  }
}

/** Auto-log rule (F3): all due ideal steps complete -> ideal; >=1 but not all -> fallback; 0 -> todo. */
export function autoChipState(occurrence: Occurrence): 'todo' | 'done' | 'fallback' {
  return computeAutoChip(occurrence.dueIdealStepIds, occurrence.completedStepIds, occurrence.dosesRequired, occurrence.dosesCompleted);
}
