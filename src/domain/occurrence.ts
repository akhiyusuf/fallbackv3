/**
 * M2. Cadence -> occurrence set, and F23/F24 due-sub-step resolution.
 * As-needed routines (F27) have NO cadence and NO occurrence set: `isDue` is always false.
 */
import type { Cadence, Id, LocalDate, TaskWithSteps } from '@/types';
import { addDays, daysBetween, isAfter, isSameOrBefore, weekdayOf } from './dateMath';

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

/**
 * `notBefore` — the creation-day lower bound, as DEVICE-LOCAL `LocalDate` **data**, supplied
 * by the caller. This is deliberately NOT derived in here from `task.createdAt` (review pass
 * 1, blocking item 4): `createdAt` is a UTC `Instant`, and a naive substring slice of it
 * yields the UTC calendar date, not the device-local date ARCHITECTURE §7 pins — west of UTC
 * that hides a just-created task from Today until tomorrow; east of UTC it fabricates
 * exactly the pre-existence "missed" day this bound exists to prevent. `src/domain` has no
 * clock and no timezone, so it cannot do that conversion correctly; `src/queries` does it via
 * `@/lib/date`'s `toLocalDate(new Date(instant))` and passes the result in as plain data.
 * Omitting `notBefore` applies no lower bound at all (a legitimate, honest pure-cadence
 * answer) rather than silently falling back to a wrong one.
 */
export function isDue(task: TaskWithSteps, date: LocalDate, notBefore?: LocalDate): boolean {
  if (task.type === 'todo') return false;
  if (task.isAsNeeded) return false; // F27 — never due, by construction (no cadence, no occurrence set)

  if (task.type === 'event' && task.eventDate !== null) {
    // one-off Event: exactly one occurrence, its own date — the date itself IS the whole
    // occurrence set, so no creation-day bound applies even if the event was backdated to
    // before the task record was created (a user-chosen date, not a fabricated one).
    return date === task.eventDate;
  }

  if (task.type === 'course') {
    if (!task.cadence || !task.startDate || !task.endDate) return false;
    if (!isSameOrBefore(task.startDate, date)) return false;
    if (!isSameOrBefore(date, task.endDate)) return false;
    return cadenceDue(task.cadence, date);
  }

  // Routine (tracked, non-as-needed) and repeating Event both rely on cadence + the task's
  // own start — see `notBefore`'s doc comment for why that bound lives outside this module.
  if (!task.cadence) return false;
  if (notBefore !== undefined && !isSameOrBefore(notBefore, date)) return false;
  return cadenceDue(task.cadence, date);
}

/** Returns `[]` for an inverted range (`from > to`) instead of looping forever. */
export function occurrencesBetween(task: TaskWithSteps, from: LocalDate, to: LocalDate, notBefore?: LocalDate): LocalDate[] {
  if (isAfter(from, to)) return [];
  const out: LocalDate[] = [];
  let cur = from;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (isDue(task, cur, notBefore)) out.push(cur);
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
export function dueIdealStepIds(task: TaskWithSteps, date: LocalDate, notBefore?: LocalDate): Id[] {
  if (!isDue(task, date, notBefore)) return [];
  const wd = weekdayOf(date);
  return task.idealSteps.filter((s) => s.dueWeekdays === null || s.dueWeekdays.includes(wd)).map((s) => s.id);
}
