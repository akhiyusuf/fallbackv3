/** M4 — S20's header meta `Tag`, e.g. "Routine · Mon–Sat" (verbatim fixture, S20 Contents). */
import type { Cadence, Task, TaskType, Weekday } from '@/types';

const TYPE_LABEL: Record<TaskType, string> = { routine: 'Routine', event: 'Event', course: 'Course', todo: 'To-do' };

const WEEKDAY_ABBR: Record<Weekday, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Contiguous run of every selected weekday -> "Mon–Sat"; otherwise comma-abbreviated. */
function weekdaysLabel(days: readonly Weekday[]): string {
  if (days.length === 0) return 'No days selected';
  const sorted = [...days].sort((a, b) => a - b);
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (isContiguous && sorted.length > 1) return `${WEEKDAY_ABBR[sorted[0]!]}–${WEEKDAY_ABBR[sorted[sorted.length - 1]!]}`;
  return sorted.map((d) => WEEKDAY_ABBR[d]).join('/');
}

function cadenceOnlyLabel(cadence: Cadence): string {
  switch (cadence.kind) {
    case 'daily':
      return 'Daily';
    case 'specific-weekdays':
      return weekdaysLabel(cadence.weekdays);
    case 'weekly':
      return `Weekly · ${WEEKDAY_ABBR[cadence.weekday]}`;
    case 'bi-weekly':
      return `Bi-weekly · ${WEEKDAY_ABBR[cadence.weekday]}`;
    case 'monthly':
      return `Monthly · ${ordinal(cadence.dayOfMonth)}`;
    case 'bi-monthly':
      return `Bi-monthly · ${ordinal(cadence.dayOfMonth)}`;
    case 'yearly':
      return `Yearly · ${MONTH_ABBR[cadence.month - 1]} ${cadence.dayOfMonth}`;
  }
}

export function cadenceSummary(task: Pick<Task, 'type' | 'cadence' | 'isAsNeeded' | 'eventDate'>): string {
  const typeLabel = TYPE_LABEL[task.type];
  if (task.type === 'todo') return typeLabel;
  if (task.type === 'routine' && task.isAsNeeded) return `${typeLabel} · As-needed`;
  if (task.type === 'event' && task.cadence === null) return `${typeLabel} · One-time`;
  if (!task.cadence) return typeLabel;
  return `${typeLabel} · ${cadenceOnlyLabel(task.cadence)}`;
}
