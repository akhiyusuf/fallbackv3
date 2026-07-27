/** M4 — small display-only date formatters ("Mar 3", "Thu Jul 16"). Never used for logic. */
import { parseLocalDate, weekdayOf } from '@/lib/date';
import type { LocalDate } from '@/types';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function shortDateLabel(date: LocalDate): string {
  const d = parseLocalDate(date);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

export function todayLongLabel(date: LocalDate): string {
  const wd = weekdayOf(date);
  return `Today, ${WEEKDAY_ABBR[wd - 1]} ${shortDateLabel(date)}`;
}
