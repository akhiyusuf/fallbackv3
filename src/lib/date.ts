/**
 * M0. Device-local calendar arithmetic. STUB — M0 implements.
 *
 * RULE: the app has exactly one notion of "today" — the DEVICE-LOCAL calendar date.
 * No module may call `new Date()` directly for business logic; go through here so the
 * qa-tester can freeze the clock (see docs/ARCHITECTURE.md §7).
 */
import type { LocalDate, Instant, Weekday } from '@/types';

export declare function today(): LocalDate;
export declare function now(): Instant;
export declare function toLocalDate(d: Date): LocalDate;
export declare function parseLocalDate(d: LocalDate): Date;
export declare function addDays(d: LocalDate, n: number): LocalDate;
export declare function addMonths(d: LocalDate, n: number): LocalDate;
export declare function addYears(d: LocalDate, n: number): LocalDate;
export declare function diffDays(a: LocalDate, b: LocalDate): number;
export declare function weekdayOf(d: LocalDate): Weekday;
/** ISO week, Monday-start — matches the design's WeekdayPicker convention. */
export declare function startOfWeek(d: LocalDate): LocalDate;
export declare function endOfWeek(d: LocalDate): LocalDate;
export declare function startOfMonth(d: LocalDate): LocalDate;
export declare function endOfMonth(d: LocalDate): LocalDate;
export declare function isBefore(a: LocalDate, b: LocalDate): boolean;
export declare function isAfter(a: LocalDate, b: LocalDate): boolean;
export declare function eachDay(from: LocalDate, to: LocalDate): LocalDate[];
