/** Round 4: `apportion` and the aggregate breakdown always add up to the days counted. */
import type { LocalDate, Occurrence } from '@/types';
import { addDays } from './dateMath';
import { aggregateConsistency, apportion } from './consistency';

const d = (s: string) => s as LocalDate;
const T = (n: number) => `task-${n}` as Occurrence['taskId'];

function occ(n: number, date: string, outcome: Occurrence['outcome']): Occurrence {
  return { taskId: T(n), date: d(date), outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 };
}
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Small deterministic generator, so a failure can be replayed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('apportion', () => {
  it('a single share takes the whole total', () => {
    expect(apportion([5], 5)).toEqual([5]);
    expect(apportion([0], 0)).toEqual([0]);
    expect(apportion([2.9999999], 3)).toEqual([3]);
  });

  it('zero total and empty input are all zeros / empty, never NaN', () => {
    expect(apportion([0, 0, 0], 0)).toEqual([0, 0, 0]);
    expect(apportion([], 0)).toEqual([]);
    expect(apportion([-1e-15, 0, 0], 0)).toEqual([0, 0, 0]);
  });

  it('floating error: shares that sum to 2.9999999 or 3.0000001 still give 3 whole days', () => {
    for (const shares of [
      [1 / 3 + 1 / 3, 1 / 3, 0],
      [0.1 + 0.2, 1.4 + 1.3, 0],
      [0.9999999999, 0.9999999999, 1.0000000002],
      [1.4999999999, 1.5000000001, 0],
    ]) {
      const out = apportion(shares, 3);
      expect(sum(out)).toBe(3);
      out.forEach((n) => expect(Number.isInteger(n)).toBe(true));
    }
    // A negative sliver (denom - numerator = -2e-16) is clamped, not subtracted.
    expect(apportion([1.5, 1.5, -2.2e-16], 3)).toEqual([2, 1, 0]);
  });

  it('a tie goes to the earlier share (ideal before fallback before missed)', () => {
    expect(apportion([0.5, 0.5, 0], 1)).toEqual([1, 0, 0]);
    expect(apportion([1.5, 1.5, 0], 3)).toEqual([2, 1, 0]);
    expect(apportion([1 / 3, 1 / 3, 1 / 3], 1)).toEqual([1, 0, 0]);
  });

  it('is deterministic and does not change its input', () => {
    const shares = [2.25, 1.5, 0.25];
    const copy = [...shares];
    const a = apportion(shares, 4);
    expect(apportion(shares, 4)).toEqual(a);
    expect(shares).toEqual(copy);
  });

  it('order-stable: permuting the shares moves each result with its share, except which of equal remainders wins', () => {
    const shares = [2.25, 1.5, 0.25];
    const base = apportion(shares, 4);
    for (const perm of [[0, 2, 1], [1, 0, 2], [2, 1, 0], [1, 2, 0], [2, 0, 1]]) {
      const out = apportion(perm.map((i) => shares[i]!), 4);
      perm.forEach((from, to) => expect(out[to]).toBe(base[from]));
    }
  });

  it('random shares that add up to the total: sums to total, within one of each share, over 5000 draws', () => {
    const next = rng(2026);
    for (let k = 0; k < 5000; k++) {
      const total = Math.floor(next() * 120);
      const n = 1 + Math.floor(next() * 4);
      const cuts = Array.from({ length: n - 1 }, () => next() * total).sort((a, b) => a - b);
      const shares: number[] = [];
      let prev = 0;
      for (const c of [...cuts, total]) {
        shares.push(c - prev);
        prev = c;
      }
      const out = apportion(shares, total);
      expect(sum(out)).toBe(total);
      out.forEach((v, i) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(Math.abs(v - shares[i]!)).toBeLessThan(1 + 1e-6);
      });
    }
  });

  it('shares that are whole numbers are returned untouched', () => {
    expect(apportion([22, 4, 0], 26)).toEqual([22, 4, 0]);
  });
});

describe('aggregate breakdown adds up to the days counted', () => {
  const today = d('2026-03-31');

  it('3 days, each with one ideal and one fallback task: 3 days counted, ideal + fallback + missed = 3', () => {
    const occs: Occurrence[] = [];
    for (let i = 0; i < 3; i++) {
      const date = addDays(d('2026-03-01'), i);
      occs.push(occ(1, date, 'ideal'), occ(2, date, 'fallback'));
    }
    const r = aggregateConsistency({ occurrences: occs, window: 'last-30', today });
    expect(r.denominator).toBe(3);
    expect(r.percent).toBe(100);
    expect(r.breakdown.missed).toBe(0);
    expect(r.breakdown.ideal + r.breakdown.fallback + r.breakdown.missed).toBe(3);
    expect(r.breakdown).toEqual({ ideal: 2, fallback: 1, off: 0, missed: 0 });
  });

  it('1 day, one ideal and one fallback: reads as 1 day, not "1 ideal and 1 fallback"', () => {
    const r = aggregateConsistency({ occurrences: [occ(1, '2026-03-05', 'ideal'), occ(2, '2026-03-05', 'fallback')], window: 'last-30', today });
    expect(r.denominator).toBe(1);
    expect(r.breakdown.ideal + r.breakdown.fallback + r.breakdown.missed).toBe(1);
  });

  it('a day with an ideal, a fallback and a miss (thirds) over 3 days still sums to 3', () => {
    const occs: Occurrence[] = [];
    for (let i = 0; i < 3; i++) {
      const date = addDays(d('2026-03-01'), i);
      occs.push(occ(1, date, 'ideal'), occ(2, date, 'fallback'), occ(3, date, 'missed'));
    }
    const r = aggregateConsistency({ occurrences: occs, window: 'last-30', today });
    expect(r.denominator).toBe(3);
    expect(r.breakdown.ideal + r.breakdown.fallback + r.breakdown.missed).toBe(3);
    expect(r.percent).toBe(67);
  });

  it('off tasks and fully-off days are tallied apart and never change the sum of the other three', () => {
    const occs = [
      occ(1, '2026-03-01', 'ideal'), occ(2, '2026-03-01', 'off'),
      occ(1, '2026-03-02', 'off'), occ(2, '2026-03-02', 'off'),
      occ(1, '2026-03-03', 'fallback'), occ(2, '2026-03-03', 'missed'),
    ];
    const r = aggregateConsistency({ occurrences: occs, window: 'last-30', today });
    expect(r.denominator).toBe(2);
    expect(r.breakdown.off).toBe(1);
    expect(r.breakdown.ideal + r.breakdown.fallback + r.breakdown.missed).toBe(2);
  });

  it('only fully-off days: nothing counted, all three counts are 0', () => {
    const r = aggregateConsistency({ occurrences: [occ(1, '2026-03-01', 'off')], window: 'last-30', today });
    expect(r.denominator).toBe(0);
    expect(r.breakdown).toEqual({ ideal: 0, fallback: 0, off: 1, missed: 0 });
  });

  it('random histories: the three counts always equal the counted days, each within one of its exact share, in last-7, last-30, all-time and a range', () => {
    const next = rng(99);
    const outcomes: Occurrence['outcome'][] = ['ideal', 'fallback', 'missed', 'off', 'pending'];
    for (let k = 0; k < 400; k++) {
      const occs: Occurrence[] = [];
      const days = 1 + Math.floor(next() * 60);
      for (let i = 0; i < days; i++) {
        const date = addDays(d('2026-01-15'), i);
        const tasks = Math.floor(next() * 5);
        for (let t = 1; t <= tasks; t++) occs.push(occ(t, date, outcomes[Math.floor(next() * outcomes.length)]!));
      }
      for (const window of ['last-7', 'last-30', 'all-time', { from: d('2026-02-01'), to: d('2026-02-28') }] as const) {
        const r = aggregateConsistency({ occurrences: occs, window, today: d('2026-03-31') });
        const { ideal, fallback, missed } = r.breakdown;
        expect(ideal + fallback + missed).toBe(r.denominator);
        expect(ideal + fallback).toBeGreaterThanOrEqual(Math.floor(r.numerator + 1e-9) - 0);
        expect(Math.abs(ideal + fallback - r.numerator)).toBeLessThan(1 + 1e-6);
        for (const v of [ideal, fallback, missed]) expect(Number.isInteger(v) && v >= 0).toBe(true);
      }
    }
  });
});
