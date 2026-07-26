import type { LocalDate } from '@/types';
import {
  addDays,
  addMonths,
  addYears,
  daysBetween,
  eachDay,
  endOfMonth,
  endOfWeek,
  instantToLocalDate,
  isAfter,
  isBefore,
  startOfMonth,
  startOfWeek,
  weekdayOf,
} from './dateMath';

const d = (s: string) => s as LocalDate;

describe('dateMath — private pure calendar arithmetic (see file header for why)', () => {
  test('weekdayOf matches known reference dates, Monday=1..Sunday=7', () => {
    expect(weekdayOf(d('2024-01-01'))).toBe(1); // Monday
    expect(weekdayOf(d('2024-01-07'))).toBe(7); // Sunday
    expect(weekdayOf(d('2026-07-26'))).toBe(7); // Sunday — today's date in this session
  });

  test('addDays crosses month and year boundaries, including leap day', () => {
    expect(addDays(d('2024-02-28'), 1)).toBe('2024-02-29'); // 2024 is a leap year
    expect(addDays(d('2023-02-28'), 1)).toBe('2023-03-01'); // 2023 is not
    expect(addDays(d('2023-12-31'), 1)).toBe('2024-01-01');
    expect(addDays(d('2024-01-01'), -1)).toBe('2023-12-31');
  });

  test('addMonths clamps overflowing day-of-month', () => {
    expect(addMonths(d('2024-01-31'), 1)).toBe('2024-02-29'); // clamped into Feb (leap)
    expect(addMonths(d('2023-01-31'), 1)).toBe('2023-02-28'); // clamped, non-leap
    expect(addMonths(d('2024-01-15'), 12)).toBe('2025-01-15');
  });

  test('addYears — day-366 anchor case: a leap day inside the span still lands one year later', () => {
    // Anchor 2024-01-01 (2024 is a leap year) + 366 raw days == 2025-01-01 == addYears(...,1).
    expect(addDays(d('2024-01-01'), 366)).toBe('2025-01-01');
    expect(addYears(d('2024-01-01'), 1)).toBe('2025-01-01');
  });

  test('addYears clamps Feb 29 on a non-leap target year', () => {
    expect(addYears(d('2024-02-29'), 1)).toBe('2025-02-28');
  });

  test('daysBetween is signed: positive when `to` is later', () => {
    expect(daysBetween(d('2024-01-01'), d('2024-01-08'))).toBe(7);
    expect(daysBetween(d('2024-01-08'), d('2024-01-01'))).toBe(-7);
    expect(daysBetween(d('2024-01-01'), d('2024-01-01'))).toBe(0);
  });

  test('startOfWeek / endOfWeek — Monday-start (design convention)', () => {
    expect(startOfWeek(d('2024-01-04'))).toBe('2024-01-01'); // Thursday -> that week's Monday
    expect(endOfWeek(d('2024-01-04'))).toBe('2024-01-07'); // -> that week's Sunday
  });

  test('startOfMonth / endOfMonth, including leap February', () => {
    expect(startOfMonth(d('2024-02-15'))).toBe('2024-02-01');
    expect(endOfMonth(d('2024-02-15'))).toBe('2024-02-29');
    expect(endOfMonth(d('2023-02-15'))).toBe('2023-02-28');
  });

  test('isBefore / isAfter — plain chronological string comparison', () => {
    expect(isBefore(d('2024-01-01'), d('2024-01-02'))).toBe(true);
    expect(isAfter(d('2024-01-02'), d('2024-01-01'))).toBe(true);
    expect(isBefore(d('2024-01-01'), d('2024-01-01'))).toBe(false);
  });

  test('eachDay is inclusive both ends, ascending', () => {
    expect(eachDay(d('2024-01-01'), d('2024-01-03'))).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    expect(eachDay(d('2024-01-01'), d('2024-01-01'))).toEqual(['2024-01-01']);
  });

  test('instantToLocalDate takes the calendar-date prefix', () => {
    expect(instantToLocalDate('2026-07-16T08:03:11.412Z')).toBe('2026-07-16');
  });
});
