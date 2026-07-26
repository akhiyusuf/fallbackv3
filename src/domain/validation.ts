/**
 * M2. Save-time validation shared by S16/S17/S18/S19 (create) and S20 (edit) —
 * including F23/F24's no-empty-run-occurrence invariant. One implementation, two callers:
 * S20's spec explicitly says "replicate it, don't reinvent it".
 */
import { err, ok } from '@/types';
import type { Cadence, Result, StepDraft, TaskDraft, Weekday } from '@/types';

const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/** The parent task's own occurrence weekdays for the two P0 sub-step-schedulable cadences.
 *  Weekly...yearly cadences have exactly one occurrence per period — subsetting is
 *  degenerate for those and the sub-step grid doesn't apply (MODULES.md M4). */
function subSchedulableWeekdays(cadence: Cadence | null | undefined): readonly Weekday[] | null {
  if (!cadence) return null;
  if (cadence.kind === 'daily') return [1, 2, 3, 4, 5, 6, 7];
  if (cadence.kind === 'specific-weekdays') return cadence.weekdays;
  return null;
}

function requiresIdealFallback(draft: TaskDraft): boolean {
  if (draft.type === 'course') return true;
  if (draft.type === 'routine' && !draft.isAsNeeded && draft.isTracked !== false) return true;
  return false;
}

/** Returns the weekday names of every parent occurrence left with zero due ideal steps. */
export function emptyRunOccurrences(draft: TaskDraft): string[] {
  if (!requiresIdealFallback(draft)) return [];
  const parentWeekdays = subSchedulableWeekdays(draft.cadence ?? null);
  if (!parentWeekdays) return [];

  const idealSteps: readonly StepDraft[] = draft.idealSteps;
  const offending: string[] = [];
  for (const wd of parentWeekdays) {
    const covered = idealSteps.some((s) => s.dueWeekdays === null || s.dueWeekdays.includes(wd));
    if (!covered) offending.push(WEEKDAY_NAMES[wd]);
  }
  return offending;
}

export function validateTaskDraft(draft: TaskDraft): Result<TaskDraft> {
  const fields: Record<string, string> = {};

  if (draft.name.trim().length === 0) {
    fields.name = 'Name cannot be empty.';
  }

  if (requiresIdealFallback(draft)) {
    if (draft.idealSteps.length === 0) fields.idealSteps = 'Add at least one ideal step.';
    if (draft.fallbackSteps.length === 0) fields.fallbackSteps = 'Add at least one fallback step.';
  }

  const needsCadence =
    (draft.type === 'routine' && !draft.isAsNeeded) ||
    draft.type === 'course' ||
    (draft.type === 'event' && draft.eventDate == null);

  if (needsCadence && !draft.cadence) {
    fields.cadence = 'Choose how often this repeats.';
  }

  if (draft.cadence?.kind === 'specific-weekdays' && draft.cadence.weekdays.length === 0) {
    fields.cadence = 'Choose at least one day of the week.';
  }

  if (draft.type === 'course') {
    if (!draft.startDate) fields.startDate = 'Choose a start date.';
    if (!draft.endDate) fields.endDate = 'Choose an end date.';
    if ((draft.dosesPerDay ?? 1) < 1) fields.dosesPerDay = 'Must be at least 1 dose a day.';
  }

  const offendingWeekdays = emptyRunOccurrences(draft);
  if (offendingWeekdays.length > 0) {
    fields.idealSteps = `No ideal step is due on ${offendingWeekdays.join(', ')}. Every day this runs needs at least one due ideal step.`;
  }

  if (Object.keys(fields).length > 0) {
    return err({ code: 'VALIDATION_FAILED', message: 'Task draft failed validation.', fields });
  }
  return ok(draft);
}
