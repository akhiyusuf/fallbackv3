import { addDays, addMonths, addYears, diffDays, eachDay, endOfMonth, endOfWeek, isAfter, isBefore, parseLocalDate, startOfMonth, startOfWeek, toLocalDate, weekdayOf } from './date';
import type { LocalDate } from '@/types';

const D = (s: string) => s as LocalDate;

describe('toLocalDate / parseLocalDate round-trip', () => {
  it('round-trips a date', () => {
    const d = D('2026-07-16');
    expect(toLocalDate(parseLocalDate(d))).toBe(d);
  });
});

describe('weekdayOf — Monday=1…Sunday=7', () => {
  it('Thu Jul 16 2026 is a Thursday (4)', () => {
    expect(weekdayOf(D('2026-07-16'))).toBe(4);
  });
  it('Mon Jul 13 2026 is Monday (1)', () => {
    expect(weekdayOf(D('2026-07-13'))).toBe(1);
  });
  it('Sun Jul 19 2026 is Sunday (7)', () => {
    expect(weekdayOf(D('2026-07-19'))).toBe(7);
  });
});

describe('addDays / addMonths / addYears', () => {
  it('adds days across a month boundary', () => {
    expect(addDays(D('2026-07-30'), 3)).toBe('2026-08-02');
  });
  it('adds months', () => {
    expect(addMonths(D('2026-01-31'), 1)).toBe('2026-02-28');
  });
  it('adds years, including a leap-day fixture', () => {
    expect(addYears(D('2024-02-29'), 1)).toBe('2025-02-28');
  });
});

describe('diffDays', () => {
  it('counts calendar days between two dates', () => {
    expect(diffDays(D('2026-07-20'), D('2026-07-16'))).toBe(4);
    expect(diffDays(D('2026-07-16'), D('2026-07-20'))).toBe(-4);
  });
});

describe('startOfWeek / endOfWeek — Monday-start', () => {
  it('Thursday resolves to its own Monday..Sunday span', () => {
    expect(startOfWeek(D('2026-07-16'))).toBe('2026-07-13');
    expect(endOfWeek(D('2026-07-16'))).toBe('2026-07-19');
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('resolves the full month span', () => {
    expect(startOfMonth(D('2026-07-16'))).toBe('2026-07-01');
    expect(endOfMonth(D('2026-07-16'))).toBe('2026-07-31');
  });
});

describe('isBefore / isAfter', () => {
  it('compares two LocalDates', () => {
    expect(isBefore(D('2026-07-01'), D('2026-07-02'))).toBe(true);
    expect(isAfter(D('2026-07-02'), D('2026-07-01'))).toBe(true);
    expect(isBefore(D('2026-07-01'), D('2026-07-01'))).toBe(false);
  });
});

describe('eachDay', () => {
  it('enumerates an inclusive range', () => {
    expect(eachDay(D('2026-07-01'), D('2026-07-03'))).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });
  it('returns empty for an inverted range', () => {
    expect(eachDay(D('2026-07-05'), D('2026-07-01'))).toEqual([]);
  });
});
