/**
 * M2 — internal, private, pure calendar arithmetic used only by `src/domain/**`.
 *
 * WHY THIS EXISTS INSTEAD OF IMPORTING `@/lib/date`: it was written while `@/lib/date`
 * still shipped ambient `declare function` stubs with no runtime body (M0 built in
 * parallel — MODULES.md Wave 1), and every domain function must be deterministic given its
 * arguments (ARCHITECTURE §12), which an unimplemented stub can't satisfy.
 *
 * `@/lib/date` has since landed for real (date-fns backed). Review pass 1 verified this
 * module byte-for-byte compatible with it (`weekdayOf`/`addMonths` cross-checked against
 * date-fns over 3,000 consecutive days, 0 mismatches; Monday=1 confirmed both sides) and
 * ruled collapsing it optional, not required — kept deliberately: every function here stays
 * a pure function of its `LocalDate` arguments with zero I/O, which is what makes this the
 * one part of the app qa-tester never has to freeze a clock to test, and it keeps
 * `src/domain` provably decoupled from M0's implementation choices (date-fns version, parse
 * strategy) rather than merely happening to agree with them today. `today()`/`now()` (the
 * only genuinely I/O-flavoured facts) are deliberately NOT reimplemented here: every domain
 * entry point that needs "today" takes it as an explicit parameter (API.md §2), sourced from
 * `@/lib/date`'s `today()` by `src/queries`, which is not subject to the "no new Date()"
 * restriction. Likewise, device-local conversion of an `Instant` (`task.createdAt`) is NOT
 * done here (see the removed `instantToLocalDate` — review pass 1 blocking item 4): a naive
 * UTC slice of an ISO instant is not the device-local date ARCHITECTURE §7 pins, and this
 * module has no way to do the conversion correctly without a real clock/timezone, which it
 * must not have. `src/queries` derives that bound via `@/lib/date`'s `toLocalDate(new
 * Date(instant))` and passes it in as plain `LocalDate` data (see `occurrence.ts`'s
 * `notBefore` parameter).
 *
 * This still satisfies "imports nothing but @/types and @/lib" (MODULES.md M2) — it imports
 * nothing at all beyond the `LocalDate`/`Weekday` *types*, a strict subset of what's allowed.
 * It never constructs a JS `Date` object and never reads the wall clock.
 */
import type { LocalDate, Weekday } from '@/types';

/** Days in each (non-leap) month, 1-indexed by placing a dummy at index 0. */
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  if (m === 2 && isLeapYear(y)) return 29;
  return DAYS_IN_MONTH[m] as number;
}

interface Ymd {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

function parse(date: LocalDate): Ymd {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  return { y, m, d };
}

function format(ymd: Ymd): LocalDate {
  const y = String(ymd.y).padStart(4, '0');
  const m = String(ymd.m).padStart(2, '0');
  const d = String(ymd.d).padStart(2, '0');
  return `${y}-${m}-${d}` as LocalDate;
}

/**
 * Days since an arbitrary fixed epoch (0000-03-01), using the well-known "days from civil"
 * algorithm (Howard Hinnant, public domain). Pure integer arithmetic, proleptic Gregorian,
 * correct for any year this app will ever see (tenure tiers run out to 50 years).
 */
function epochDay(date: LocalDate): number {
  const { y, m, d } = parse(date);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromEpochDay(z: number): LocalDate {
  const zz = z + 719468;
  const era = Math.floor((zz >= 0 ? zz : zz - 146096) / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return format({ y: m <= 2 ? y + 1 : y, m, d });
}

/** date + n days (n may be negative). */
export function addDays(date: LocalDate, n: number): LocalDate {
  return fromEpochDay(epochDay(date) + n);
}

/**
 * Exact count of days between two dates: `to` minus `from`. Positive when `to` is later.
 *
 * SIGN WARNING (review pass 1, non-blocking note): this is sign-OPPOSITE to
 * `@/lib/date`'s `diffDays(a, b)`, which wraps date-fns' `differenceInCalendarDays(a, b)`
 * = `a − b`. Nothing in this module mixes the two — `daysBetween` is private to
 * `src/domain/**`, `diffDays` is never imported here — but do not "align" one to the other
 * without updating every call site; they are two different functions with two different,
 * internally-consistent conventions, not a bug.
 */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return epochDay(to) - epochDay(from);
}

/** date + n calendar months, clamping the day-of-month into the resulting month (like date-fns). */
export function addMonths(date: LocalDate, n: number): LocalDate {
  const { y, m, d } = parse(date);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const clampedDay = Math.min(d, daysInMonth(ny, nm));
  return format({ y: ny, m: nm, d: clampedDay });
}

/** date + n calendar years, clamping Feb 29 -> Feb 28 on a non-leap target year. */
export function addYears(date: LocalDate, n: number): LocalDate {
  return addMonths(date, n * 12);
}

/** ISO weekday, Monday = 1 ... Sunday = 7 (matches `src/types/primitives.ts`). */
export function weekdayOf(date: LocalDate): Weekday {
  // epochDay(0000-03-01) is, by construction of the algorithm above, a fixed reference;
  // 1970-01-01 (a Thursday) has epochDay === 0, so (epochDay mod 7) with Thursday=4 anchors it.
  const e = epochDay(date);
  const isoFromThursdayAnchor = ((e % 7) + 7) % 7; // 0 => Thursday
  const mondayZero = (isoFromThursdayAnchor + 3) % 7; // 0 => Monday
  return (mondayZero + 1) as Weekday;
}

export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -(weekdayOf(date) - 1));
}

export function endOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 7 - weekdayOf(date));
}

export function startOfMonth(date: LocalDate): LocalDate {
  const { y, m } = parse(date);
  return format({ y, m, d: 1 });
}

export function endOfMonth(date: LocalDate): LocalDate {
  const { y, m } = parse(date);
  return format({ y, m, d: daysInMonth(y, m) });
}

export function isBefore(a: LocalDate, b: LocalDate): boolean {
  return a < b;
}

export function isAfter(a: LocalDate, b: LocalDate): boolean {
  return a > b;
}

export function isSameOrBefore(a: LocalDate, b: LocalDate): boolean {
  return a <= b;
}

/**
 * Inclusive ascending list of every date from `from` to `to`. Returns `[]` for an inverted
 * range (`from > to`) rather than looping forever — matches `@/lib/date.eachDay`'s behaviour
 * for the same input (review pass 1, non-blocking note).
 */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  if (isAfter(from, to)) return [];
  const out: LocalDate[] = [];
  let cur = from;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    out.push(cur);
    if (cur === to) break;
    cur = addDays(cur, 1);
  }
  return out;
}
