import type { LocalDate, Occurrence } from '@/types';
import { addDays } from './dateMath';
import { aggregateConsistency, dayFractions, perTaskConsistency } from './consistency';

const d = (s: string) => s as LocalDate;
const TASK = 'task-1' as Occurrence['taskId'];
const TASK_B = 'task-2' as Occurrence['taskId'];

function occ(taskId: Occurrence['taskId'], date: string, outcome: Occurrence['outcome']): Occurrence {
  return { taskId, date: d(date), outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 };
}

/** Builds N consecutive daily occurrences starting at `start`, cycling through `pattern`. */
function series(taskId: Occurrence['taskId'], start: string, pattern: readonly Occurrence['outcome'][]): Occurrence[] {
  let date = d(start);
  return pattern.map((outcome) => {
    const o = occ(taskId, date, outcome);
    date = addDays(date, 1);
    return o;
  });
}

describe('ARCHITECTURE.md §6.6 golden table — per-task scope (mandatory)', () => {
  test('22 ideal + 4 fallback, 4 off, 0 missed -> 100% (26/26)', () => {
    const occs = [
      ...series(TASK, '2024-01-01', Array(22).fill('ideal')),
      ...series(TASK, '2024-02-01', Array(4).fill('fallback')),
      ...series(TASK, '2024-03-01', Array(4).fill('off')),
    ];
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'all-time', today: d('2024-03-05') });
    expect(r.percent).toBe(100);
    expect(r.numerator).toBe(26);
    expect(r.denominator).toBe(26);
    expect(r.breakdown).toEqual({ ideal: 22, fallback: 4, off: 4, missed: 0 });
  });

  test('26 shown up, 4 off, 4 missed -> 87% (26/30, 86.67 rounds up)', () => {
    const occs = [
      ...series(TASK, '2024-01-01', Array(22).fill('ideal')),
      ...series(TASK, '2024-02-01', Array(4).fill('fallback')),
      ...series(TASK, '2024-03-01', Array(4).fill('off')),
      ...series(TASK, '2024-04-01', Array(4).fill('missed')),
    ];
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'all-time', today: d('2024-04-10') });
    expect(r.percent).toBe(87);
    expect(r.numerator).toBe(26);
    expect(r.denominator).toBe(30);
  });

  test('26/31 missed-not-off reads 84%; adding one more shown-up day (27/32) still reads 84%', () => {
    const base = [...series(TASK, '2024-01-01', Array(26).fill('ideal')), ...series(TASK, '2024-02-01', Array(5).fill('missed'))];
    const r1 = perTaskConsistency({ taskId: TASK, occurrences: base, window: 'all-time', today: d('2024-02-10') });
    expect(r1.numerator).toBe(26);
    expect(r1.denominator).toBe(31);
    expect(r1.percent).toBe(84);

    const grown = [...base, occ(TASK, '2024-02-10', 'ideal')];
    const r2 = perTaskConsistency({ taskId: TASK, occurrences: grown, window: 'all-time', today: d('2024-02-15') });
    expect(r2.numerator).toBe(27);
    expect(r2.denominator).toBe(32);
    expect(r2.percent).toBe(84);
  });

  test('1/8 rounds to 13% (round-half-up tie)', () => {
    const occs = [occ(TASK, '2024-01-01', 'ideal'), ...series(TASK, '2024-01-02', Array(7).fill('missed'))];
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'all-time', today: d('2024-01-10') });
    expect(r.numerator).toBe(1);
    expect(r.denominator).toBe(8);
    expect(r.percent).toBe(13);
  });

  test('pending today, single due task, not off -> % identical to today not existing', () => {
    const withoutToday = [...series(TASK, '2024-01-01', Array(5).fill('ideal'))];
    const withPendingToday = [...withoutToday, occ(TASK, '2024-01-06', 'pending')];
    const rWithout = perTaskConsistency({ taskId: TASK, occurrences: withoutToday, window: 'all-time', today: d('2024-01-06') });
    const rWith = perTaskConsistency({ taskId: TASK, occurrences: withPendingToday, window: 'all-time', today: d('2024-01-06') });
    expect(rWith).toEqual(rWithout);
  });

  test('numerator === denominator - missed at every read', () => {
    const occs = [...series(TASK, '2024-01-01', ['ideal', 'fallback', 'missed', 'off', 'ideal'])];
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'all-time', today: d('2024-01-10') });
    expect(r.numerator).toBe(r.denominator - r.breakdown.missed);
  });

  test('only as-needed routines exist (no occurrences at all) -> "no data yet", never 0%', () => {
    const r = perTaskConsistency({ taskId: TASK, occurrences: [], window: 'all-time', today: d('2024-01-01') });
    expect(r.percent).toBeNull();
    expect(r.denominator).toBe(0);
  });

  test('every elapsed due day off -> "no data yet", never 0% / never divide-by-zero', () => {
    const occs = series(TASK, '2024-01-01', Array(5).fill('off'));
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'all-time', today: d('2024-01-10') });
    expect(r.percent).toBeNull();
    expect(r.denominator).toBe(0);
    expect(r.breakdown.off).toBe(5);
  });
});

describe('ARCHITECTURE.md §6.6 golden table — aggregate scope (mandatory)', () => {
  test('aggregate 3-day anchor: 2/2, 1/3, all-off -> 67% (Sigma f = 1.333 / 2), NOT 50%', () => {
    const occs: Occurrence[] = [
      // Day 1: 2 due, both shown up -> f = 1.0
      occ(TASK, '2024-05-01', 'ideal'),
      occ(TASK_B, '2024-05-01', 'ideal'),
      // Day 2: 3 due, 1 shown up, 2 missed -> f = 0.333...
      occ(TASK, '2024-05-02', 'ideal'),
      occ(TASK_B, '2024-05-02', 'missed'),
      occ('task-3' as Occurrence['taskId'], '2024-05-02', 'missed'),
      // Day 3: fully off -> excluded from the denominator entirely
      occ(TASK, '2024-05-03', 'off'),
      occ(TASK_B, '2024-05-03', 'off'),
    ];
    const r = aggregateConsistency({ occurrences: occs, window: 'all-time', today: d('2024-05-03') });
    expect(r.denominator).toBe(2);
    expect(r.numerator).toBeCloseTo(1 + 1 / 3, 9);
    expect(r.percent).toBe(67);
  });

  test('aggregate day: 1 done + 1 pending -> f = 1.0 (pending excluded per-task, not per-day)', () => {
    const occs: Occurrence[] = [occ(TASK, '2024-06-01', 'ideal'), occ(TASK_B, '2024-06-01', 'pending')];
    const r = aggregateConsistency({ occurrences: occs, window: 'all-time', today: d('2024-06-01') });
    expect(r.denominator).toBe(1);
    expect(r.numerator).toBe(1);
    expect(r.percent).toBe(100);
  });

  test('aggregate day: 2 due, 1 off, 1 shown up -> f = 1.0, not 1/2', () => {
    const occs: Occurrence[] = [occ(TASK, '2024-06-01', 'off'), occ(TASK_B, '2024-06-01', 'fallback')];
    const r = aggregateConsistency({ occurrences: occs, window: 'all-time', today: d('2024-06-01') });
    expect(r.denominator).toBe(1);
    expect(r.numerator).toBe(1);
    expect(r.breakdown.off).toBe(0); // NOT fully off — the day is still counted, off task excluded silently
  });

  test('pending-today aggregate case: 1 done + 1 pending-today -> f = 1/1 = 1.0', () => {
    const occs: Occurrence[] = [occ(TASK, '2024-06-01', 'ideal'), occ(TASK_B, '2024-06-01', 'pending')];
    const r = aggregateConsistency({ occurrences: occs, window: 'all-time', today: d('2024-06-01') });
    expect(r.percent).toBe(100);
  });

  test('only as-needed routines exist -> "no data yet", never 0%', () => {
    const r = aggregateConsistency({ occurrences: [], window: 'all-time', today: d('2024-01-01') });
    expect(r.percent).toBeNull();
  });

  test('every elapsed due day fully off -> "no data yet", never 0%', () => {
    const occs: Occurrence[] = [occ(TASK, '2024-06-01', 'off'), occ(TASK, '2024-06-02', 'off')];
    const r = aggregateConsistency({ occurrences: occs, window: 'all-time', today: d('2024-06-02') });
    expect(r.percent).toBeNull();
    expect(r.breakdown.off).toBe(2);
  });

  test('display rounding: Ideal/Fallback are each round-half-up of their own credit sum; Missed is the rounded remainder', () => {
    // 3 counted days, each a two-task day with one ideal + one missed => f=0.5 each day.
    const occs: Occurrence[] = [];
    for (const day of ['2024-07-01', '2024-07-02', '2024-07-03']) {
      occs.push(occ(TASK, day, 'ideal'), occ(TASK_B, day, 'missed'));
    }
    const r = aggregateConsistency({ occurrences: occs, window: 'all-time', today: d('2024-07-03') });
    expect(r.denominator).toBe(3);
    expect(r.numerator).toBeCloseTo(1.5, 9);
    expect(r.breakdown.ideal).toBe(2); // roundHalfUp(1.5)
    expect(r.breakdown.fallback).toBe(0);
    expect(r.breakdown.missed).toBe(2); // roundHalfUp(3 - 1.5) = roundHalfUp(1.5) = 2
  });
});

describe('§6.4 counted-day window — off days extend raw span without consuming a slot', () => {
  test('a "30 days" window can span more than 30 raw calendar days when off days fall inside it', () => {
    // 30 shown-up days, with 5 off days interleaved just before "today".
    const occs = [...series(TASK, '2024-01-01', Array(30).fill('ideal')), ...series(TASK, '2024-01-31', Array(5).fill('off'))];
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'last-30', today: d('2024-02-05') });
    expect(r.denominator).toBe(30);
    expect(r.numerator).toBe(30);
    expect(r.percent).toBe(100);
    expect(r.breakdown.off).toBe(5); // tallied, without consuming any of the 30 slots
  });

  test('history shorter than N truncates instead of fabricating days', () => {
    const occs = series(TASK, '2024-01-01', Array(5).fill('ideal'));
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'last-30', today: d('2024-01-06') });
    expect(r.denominator).toBe(5);
    expect(r.percent).toBe(100);
  });

  test('an explicit DateRange window (F28/F30) has no N cap — every qualifying day in range counts', () => {
    const occs = series(TASK, '2024-01-01', ['ideal', 'missed', 'off', 'fallback', 'ideal']);
    const r = perTaskConsistency({
      taskId: TASK,
      occurrences: occs,
      window: { from: d('2024-01-01'), to: d('2024-01-05') },
      today: d('2024-01-10'),
    });
    expect(r.denominator).toBe(4); // 5 days minus the 1 off
    expect(r.numerator).toBe(3);
  });
});

describe('dayFractions — powers S25 disclosure table', () => {
  test('excludes days with zero resolved non-off occurrences from the list entirely', () => {
    const occs: Occurrence[] = [
      occ(TASK, '2024-05-01', 'ideal'),
      occ(TASK_B, '2024-05-01', 'ideal'),
      occ(TASK, '2024-05-02', 'ideal'),
      occ(TASK_B, '2024-05-02', 'missed'),
      occ('task-3' as Occurrence['taskId'], '2024-05-02', 'missed'),
      occ(TASK, '2024-05-03', 'off'),
      occ(TASK_B, '2024-05-03', 'off'),
    ];
    const rows = dayFractions(occs);
    expect(rows.map((r) => r.date)).toEqual(['2024-05-01', '2024-05-02']);
    expect(rows[0]!.fraction).toBe(1);
    expect(rows[1]!.fraction).toBeCloseTo(1 / 3, 9);
  });
});
