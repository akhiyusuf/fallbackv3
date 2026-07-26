/**
 * M2. Cadence -> occurrence set, and F23/F24 due-sub-step resolution.
 * As-needed routines (F27) have NO cadence and NO occurrence set: `isDue` is always false.
 */
import type { Cadence, Id, LocalDate, TaskWithSteps } from '@/types';
import { addDays, daysBetween, instantToLocalDate, isSameOrBefore, weekdayOf } from './dateMath';

/**
 * A task's occurrence set never reaches back before the task itself existed — otherwise a
 * routine created today would retroactively "miss" years of history it never had a chance
 * to log (docs/ARCHITECTURE.md §6.4's "never fabricate days before the task existed", applied
 * here to the occurrence set itself, not only to window truncation).
 */
function effectiveStartDate(task: TaskWithSteps): LocalDate {
  return instantToLocalDate(task.createdAt);
}

function cadenceDue(cadence: Cadence, date: LocalDate): boolean {
  switch (cadence.kind) {
    case 'daily':
      return true;
    case 'specific-weekdays':
      return cadence.weekdays.includes(weekdayOf(date));
    case 'weekly':
      return weekdayOf(date) === cadence.weekday && isSameOrBefore(cadence.anchorDate, date);
    case 'bi-weekly': {
      if (weekdayOf(date) !== cadence.weekday || !isSameOrBefore(cadence.anchorDate, date)) return false;
      const weeks = Math.floor(daysBetween(cadence.anchorDate, date) / 7);
      return weeks % 2 === 0;
    }
    case 'monthly':
      return date.slice(8, 10) === String(cadence.dayOfMonth).padStart(2, '0') && isSameOrBefore(cadence.anchorDate, date);
    case 'bi-monthly': {
      if (date.slice(8, 10) !== String(cadence.dayOfMonth).padStart(2, '0') || !isSameOrBefore(cadence.anchorDate, date)) {
        return false;
      }
      const anchorY = Number(cadence.anchorDate.slice(0, 4));
      const anchorM = Number(cadence.anchorDate.slice(5, 7));
      const y = Number(date.slice(0, 4));
      const m = Number(date.slice(5, 7));
      const monthsElapsed = (y - anchorY) * 12 + (m - anchorM);
      return monthsElapsed % 2 === 0;
    }
    case 'yearly':
      return (
        Number(date.slice(5, 7)) === cadence.month &&
        Number(date.slice(8, 10)) === cadence.dayOfMonth &&
        isSameOrBefore(cadence.anchorDate, date)
      );
    default:
      return false;
  }
}

export function isDue(task: TaskWithSteps, date: LocalDate): boolean {
  if (task.type === 'todo') return false;
  if (task.isAsNeeded) return false; // F27 — never due, by construction (no cadence, no occurrence set)

  if (task.type === 'event' && task.eventDate !== null) {
    // one-off Event: exactly one occurrence, its own date. No createdAt lower bound needed —
    // the single due date IS the whole occurrence set.
    return date === task.eventDate;
  }

  if (task.type === 'course') {
    if (!task.cadence || !task.startDate || !task.endDate) return false;
    if (!isSameOrBefore(task.startDate, date)) return false;
    if (!isSameOrBefore(date, task.endDate)) return false;
    return cadenceDue(task.cadence, date);
  }

  // Routine (tracked, non-as-needed) and repeating Event both rely on cadence + the task's
  // own start (its occurrence set can never predate the task's own creation).
  if (!task.cadence) return false;
  if (!isSameOrBefore(effectiveStartDate(task), date)) return false;
  return cadenceDue(task.cadence, date);
}

export function occurrencesBetween(task: TaskWithSteps, from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  let cur = from;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (isDue(task, cur)) out.push(cur);
    if (cur === to) break;
    cur = addDays(cur, 1);
  }
  return out;
}

/**
 * F23/F24: ideal steps due on THIS occurrence — the union-per-day subset rule. A step whose
 * `dueWeekdays` is null is due on every parent occurrence; otherwise it's due only on the
 * listed ISO weekdays (always a subset of the parent's own occurrence weekdays, enforced at
 * save time by `validateTaskDraft`). Empty when the task isn't due that date at all.
 */
export function dueIdealStepIds(task: TaskWithSteps, date: LocalDate): Id[] {
  if (!isDue(task, date)) return [];
  const wd = weekdayOf(date);
  return task.idealSteps.filter((s) => s.dueWeekdays === null || s.dueWeekdays.includes(wd)).map((s) => s.id);
}
