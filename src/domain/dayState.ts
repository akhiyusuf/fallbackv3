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
  // A's occurrence, which is genuinely due at B via the moved-in record. A real, NON-vacated
  // log on this date still wins over the moved-in record (pass-2 N1's rule, unchanged) — a
  // vacated own log (pointer non-null) is residue: it never supplies data and never blocks
  // due-ness either.
  //
  // effectiveLog is a THREE-clause formula (ADVICE-M2.md Supplement A, S1 — REPLACES the
  // original two-clause version):
  //   (a) ownLog(D), if it exists and its own pointer is null — a real state at D always
  //       wins (pass-2 N1's rule, unchanged).
  //   (b) else null, if D is naturally due and ownLog(D) is absent — D's own occurrence is
  //       present and was never logged: a MERGE never manufactures an outcome (and never an
  //       XP award) from imported visitor data on a date the user hasn't touched. The merge
  //       keeps D's blank auto/pending state; the visitor's data stays dormant at its source
  //       (D-rule) and revives on un-move. The original (literal) formula fell through to the
  //       visitor's data here, which could mint XP for a day never touched — REJECTED by the
  //       advisor's Supplement A after M2 flagged the ambiguity rather than guessing.
  //   (c) else the moved-in record (existing latest-source tie-break) — the visitor is the
  //       ONLY occurrence present: a non-natural target, or C6's natural-but-vacated target
  //       (ownLog(D) exists as residue, so (b)'s "absent" doesn't apply — falls through here,
  //       unchanged from before this amendment).
  if (movedInLog != null) {
    let effectiveLog: DayLog | null;
    if (log && log.movedToDate === null) {
      effectiveLog = log; // (a)
    } else if (log === null && isDue(task, date, notBefore)) {
      effectiveLog = null; // (b)
    } else {
      effectiveLog = movedInLog; // (c)
    }
    return resolveDueOccurrence(task, date, today, effectiveLog, offMarks, notBefore);
  }

  // R-2: no moved-in record — THIS date's own occurrence may have relocated elsewhere, in
  // which case it vacates this date entirely, regardless of cadence due-ness — never
  // "missed" here, on any day (SCHEMA §4 `moved_to_date`). Only reached once R-1 has ruled
  // out a moved-in record — the precedence delta from pass-2's code, which checked this
  // first and could wrongly annihilate a moved-in occurrence (C6).
  if (log && log.movedToDate !== null) {
    return notDueOccurrence(task, date, log.chipState);
  }

  // R-3: ordinary natural resolution — byte-equivalent to every no-move code path before
  // this change (ADVICE-M2.md: "with no move in play, behaviour must remain
  // byte-equivalent").
  if (!isDue(task, date, notBefore)) {
    return notDueOccurrence(task, date, log?.chipState ?? null);
  }
  return resolveDueOccurrence(task, date, today, log, offMarks, notBefore);
}

/** Auto-log rule (F3): all due ideal steps complete -> ideal; >=1 but not all -> fallback; 0 -> todo. */
export function autoChipState(occurrence: Occurrence): 'todo' | 'done' | 'fallback' {
  return computeAutoChip(occurrence.dueIdealStepIds, occurrence.completedStepIds, occurrence.dosesRequired, occurrence.dosesCompleted);
}
