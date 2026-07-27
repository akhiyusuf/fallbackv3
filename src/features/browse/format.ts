/**
 * M3. Shared display-formatting helpers for S09–S14 — task-type labels, cadence hints,
 * weekday compression, and calendar-day labels. Pure presentation only: no due-ness / outcome
 * computation lives here (that stays M2's, consumed via `@/queries`).
 */
import { format } from 'date-fns';

import { diffDays, parseLocalDate } from '@/lib/date';
import type { Cadence, Importance, LocalDate, Necessity, TaskType, Weekday } from '@/types';

export const WEEKDAY_ABBR: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

const IMPORTANCE_LABEL: Record<Importance, string> = { high: 'High', med: 'Med', low: 'Low' };
const NECESSITY_LABEL: Record<Necessity, string> = { 'must-do': 'Must-do', recommended: 'Recommended', optional: 'Optional' };

export function importanceLabel(v: Importance): string {
  return IMPORTANCE_LABEL[v];
}
export function necessityLabel(v: Necessity): string {
  return NECESSITY_LABEL[v];
}

export function taskTypeLabel(type: TaskType): string {
  switch (type) {
    case 'routine':
      return 'Routine';
    case 'event':
      return 'Event';
    case 'course':
      return 'Course';
    case 'todo':
    default:
      return 'To-do/Note';
  }
}

/**
 * Compresses a weekday set into the design's two display conventions: a contiguous run of
 * three or more days reads as a dash range ("Mon–Fri"); everything else (including a
 * contiguous 2-day run, e.g. "Sat·Sun" per S10's own Yoga-flow fixture) is dot-joined.
 */
export function formatWeekdaySet(weekdays: readonly Weekday[]): string {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const isContiguous = sorted.every((d, i) => i === 0 || d === (sorted[i - 1] as Weekday) + 1);
  if (isContiguous && sorted.length >= 3) {
    return `${WEEKDAY_ABBR[sorted[0] as Weekday]}–${WEEKDAY_ABBR[sorted[sorted.length - 1] as Weekday]}`;
  }
  return sorted.map((d) => WEEKDAY_ABBR[d]).join('·');
}

/** Title-case cadence word for browse meta lines ("Daily", "Weekly", "Bi-weekly" …). */
export function cadenceLabel(cadence: Cadence | null): string {
  if (!cadence) return '';
  switch (cadence.kind) {
    case 'daily':
      return 'Daily';
    case 'specific-weekdays':
      return formatWeekdaySet(cadence.weekdays);
    case 'weekly':
      return 'Weekly';
    case 'bi-weekly':
      return 'Bi-weekly';
    case 'monthly':
      return 'Monthly';
    case 'bi-monthly':
      return 'Bi-monthly';
    case 'yearly':
      return 'Yearly';
    default:
      return '';
  }
}

/** Lowercase variant used inline in S09's own meta line ("Routine · daily"). */
export function cadenceHintLower(cadence: Cadence | null): string {
  const label = cadenceLabel(cadence);
  // Only lowercase the fixed cadence WORDS, never a weekday-derived string (already correctly cased).
  if (cadence?.kind === 'specific-weekdays') return label;
  return label.toLowerCase();
}

/**
 * Whether a cadence's occurrences ever land on the given weekday, independent of any specific
 * date or periodicity gap (S10's weekday-strip preview badges by WEEKDAY, not by a resolved
 * due-date) — daily and specific-weekdays answer directly; weekly/bi-weekly answer via their
 * own anchor weekday; monthly/bi-monthly/yearly have no fixed weekday and never match.
 */
export function cadenceRunsOnWeekday(cadence: Cadence | null, weekday: Weekday): boolean {
  if (!cadence) return false;
  switch (cadence.kind) {
    case 'daily':
      return true;
    case 'specific-weekdays':
      return cadence.weekdays.includes(weekday);
    case 'weekly':
    case 'bi-weekly':
      return cadence.weekday === weekday;
    default:
      return false;
  }
}

/** "Thu, Jul 16" — S09's header date subline. */
export function formatHeaderDate(date: LocalDate): string {
  return format(parseLocalDate(date), 'EEE, MMM d');
}

/** "6:00 PM" from a stored "HH:mm" 24-hour string. */
export function formatTimeOfDay(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "Today" / "Tomorrow" / "Fri, Jul 17" — S11's Upcoming section day-group headers. */
export function formatRelativeDayLabel(date: LocalDate, today: LocalDate): string {
  const delta = diffDays(date, today);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  return format(parseLocalDate(date), 'EEE, MMM d');
}
