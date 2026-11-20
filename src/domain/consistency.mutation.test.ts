/**
 * Mutation-testing survivors for `consistency.ts` (review/sonnet/32-mutation-testing.md).
 */
import type { LocalDate, Occurrence } from '@/types';
import { addDays } from './dateMath';
import { aggregateConsistency, dayFractions, perTaskConsistency } from './consistency';

const d = (s: string) => s as LocalDate;
const A = 'task-a' as Occurrence['taskId'];
const B = 'task-b' as Occurrence['taskId'];

function occ(taskId: Occurrence['taskId'], date: string, outcome: Occurrence['outcome']): Occurrence {
  return { taskId, date: d(date), outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 };
}

function days(taskId: Occurrence['taskId'], start: string, n: number, outcome: Occurrence['outcome']): Occurrence[] {
  const out: Occurrence[] = [];
  let date = d(start);
  for (let i = 0; i < n; i++) {
    out.push(occ(taskId, date, outcome));
    date = addDays(date, 1);
  }
  return out;
}

describe('consistency mutation survivors', () => {
  test('C02: last-7 per task counts exactly 7 days when more than 7 exist', () => {
    // 10 daily days: oldest 3 missed, newest 7 ideal. A window of exactly 7 reads 100% over 7.
    const occs = [...days(A, '2024-06-01', 3, 'missed'), ...days(A, '2024-06-04', 7, 'ideal')];
    const r = perTaskConsistency({ taskId: A, occurrences: occs, window: 'last-7', today: d('2024-06-10') });
    expect(r.denominator).toBe(7);
    expect(r.percent).toBe(100);
    expect(r.countedDates).toHaveLength(7);
  });

  test('C02b: last-30 per task counts exactly 30 days when more exist', () => {
    const occs = [...days(A, '2024-01-01', 5, 'missed'), ...days(A, '2024-01-06', 30, 'ideal')];
    const r = perTaskConsistency({ taskId: A, occurrences: occs, window: 'last-30', today: d('2024-02-10') });
    expect(r.denominator).toBe(30);
    expect(r.percent).toBe(100);
  });

  test('C03: last-7 aggregate counts exactly 7 days when more than 7 exist', () => {
    const occs = [...days(A, '2024-06-01', 3, 'missed'), ...days(A, '2024-06-04', 7, 'ideal')];
    const r = aggregateConsistency({ occurrences: occs, window: 'last-7', today: d('2024-06-10') });
    expect(r.denominator).toBe(7);
    expect(r.percent).toBe(100);
    expect(r.countedDates).toHaveLength(7);
  });

  test('C13: a day fraction ignores pending/off tasks (they are not in the denominator)', () => {
    const occs = [occ(A, '2024-06-01', 'ideal'), occ(B, '2024-06-01', 'pending'), occ('task-c' as Occurrence['taskId'], '2024-06-01', 'off')];
    const out = dayFractions(occs);
    expect(out).toHaveLength(1);
    expect(out[0]?.resolvedTaskIds).toEqual([A]);
    expect(out[0]?.shownUpTaskIds).toEqual([A]);
    expect(out[0]?.fraction).toBe(1);
  });

  test('C15: a fallback counts as showing up in a day fraction', () => {
    const occs = [occ(A, '2024-06-01', 'fallback'), occ(B, '2024-06-01', 'missed')];
    const out = dayFractions(occs);
    expect(out[0]?.shownUpTaskIds).toEqual([A]);
    expect(out[0]?.fraction).toBe(0.5);
  });

  test('C14: an aggregate date range includes its first day', () => {
    const occs = [occ(A, '2024-06-01', 'ideal'), occ(A, '2024-06-02', 'missed'), occ(A, '2024-06-03', 'missed')];
    const r = aggregateConsistency({ occurrences: occs, window: { from: d('2024-06-01'), to: d('2024-06-02') }, today: d('2024-06-10') });
    expect(r.denominator).toBe(2);
    expect(r.numerator).toBe(1);
    expect(r.percent).toBe(50);
    expect(r.countedDates).toEqual([d('2024-06-01'), d('2024-06-02')]);
  });

  test('C16: per-task consistency reads only that task\'s occurrences', () => {
    const occs = [occ(A, '2024-06-01', 'ideal'), occ(B, '2024-06-01', 'missed'), occ(B, '2024-06-02', 'missed')];
    const r = perTaskConsistency({ taskId: A, occurrences: occs, window: 'all-time', today: d('2024-06-10') });
    expect(r.denominator).toBe(1);
    expect(r.percent).toBe(100);
    const rb = perTaskConsistency({ taskId: B, occurrences: occs, window: 'all-time', today: d('2024-06-10') });
    expect(rb.denominator).toBe(2);
    expect(rb.percent).toBe(0);
  });
});
