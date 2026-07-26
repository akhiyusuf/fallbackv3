/**
 * M0. Device-local calendar arithmetic — the app's only clock.
 *
 * RULE: the app has exactly one notion of "today" — the DEVICE-LOCAL calendar date.
 * No module may call `new Date()` directly for business logic; go through here so the
 * qa-tester can freeze the clock (see docs/ARCHITECTURE.md §7).
 *
 * Implementation note: `LocalDate` components are read/written using the Date object's
 * LOCAL getters/setters (never the UTC ones), so a `LocalDate` string always reflects the
 * device's own calendar day regardless of DST or timezone.
 */
import {
  addDays as dfAddDays,
  addMonths as dfAddMonths,
  addYears as dfAddYears,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth as dfEndOfMonth,
  endOfWeek as dfEndOfWeek,
  getISODay,
  startOfMonth as dfStartOfMonth,
  startOfWeek as dfStartOfWeek,
} from 'date-fns';

import type { Instant, LocalDate, Weekday } from '@/types';

export function today(): LocalDate {
  return toLocalDate(new Date());
}

export function now(): Instant {
  return new Date().toISOString() as Instant;
}

export function toLocalDate(d: Date): LocalDate {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` as LocalDate;
}

export function parseLocalDate(d: LocalDate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, day ?? 1);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return toLocalDate(dfAddDays(parseLocalDate(d), n));
}

export function addMonths(d: LocalDate, n: number): LocalDate {
  return toLocalDate(dfAddMonths(parseLocalDate(d), n));
}

export function addYears(d: LocalDate, n: number): LocalDate {
  return toLocalDate(dfAddYears(parseLocalDate(d), n));
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  return differenceInCalendarDays(parseLocalDate(a), parseLocalDate(b));
}

export function weekdayOf(d: LocalDate): Weekday {
  return getISODay(parseLocalDate(d)) as Weekday;
}

/** ISO week, Monday-start — matches the design's WeekdayPicker convention. */
export function startOfWeek(d: LocalDate): LocalDate {
  return toLocalDate(dfStartOfWeek(parseLocalDate(d), { weekStartsOn: 1 }));
}

export function endOfWeek(d: LocalDate): LocalDate {
  return toLocalDate(dfEndOfWeek(parseLocalDate(d), { weekStartsOn: 1 }));
}

export function startOfMonth(d: LocalDate): LocalDate {
  return toLocalDate(dfStartOfMonth(parseLocalDate(d)));
}

export function endOfMonth(d: LocalDate): LocalDate {
  return toLocalDate(dfEndOfMonth(parseLocalDate(d)));
}

/** `LocalDate` is a fixed-width ISO string, so lexicographic comparison is calendar-correct. */
export function isBefore(a: LocalDate, b: LocalDate): boolean {
  return a < b;
}

export function isAfter(a: LocalDate, b: LocalDate): boolean {
  return a > b;
}

export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  if (isAfter(from, to)) return [];
  return eachDayOfInterval({ start: parseLocalDate(from), end: parseLocalDate(to) }).map(toLocalDate);
}
