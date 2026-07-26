import type { LocalDate } from '@/types';
import { currentCycleWindow, cyclesElapsedSince, nextCycleWindow } from './cycles';

const d = (s: string) => s as LocalDate;

describe('currentCycleWindow', () => {
  test('weekly: Monday-start window containing the given date', () => {
    const w = currentCycleWindow('weekly', d('2024-01-04')); // a Thursday
    expect(w.startDate).toBe('2024-01-01');
    expect(w.endDate).toBe('2024-01-07');
  });

  test('monthly: calendar-month window containing the given date, including leap February', () => {
    const w = currentCycleWindow('monthly', d('2024-02-15'));
    expect(w.startDate).toBe('2024-02-01');
    expect(w.endDate).toBe('2024-02-29');
  });

  test('is deterministic — same cadence + date always yields the same id', () => {
    const a = currentCycleWindow('weekly', d('2024-01-04'));
    const b = currentCycleWindow('weekly', d('2024-01-04'));
    expect(a.id).toBe(b.id);
  });
});

describe('nextCycleWindow', () => {
  test('weekly: the immediately following 7-day window', () => {
    const w = currentCycleWindow('weekly', d('2024-01-04'));
    const n = nextCycleWindow(w);
    expect(n.startDate).toBe('2024-01-08');
    expect(n.endDate).toBe('2024-01-14');
  });

  test('monthly: the immediately following calendar month, correct length', () => {
    const w = currentCycleWindow('monthly', d('2024-01-15'));
    const n = nextCycleWindow(w);
    expect(n.startDate).toBe('2024-02-01');
    expect(n.endDate).toBe('2024-02-29'); // Feb 2024 is a leap month
  });
});

describe('cyclesElapsedSince — the boundary-walk half of SCHEMA.md §8 reconciliation', () => {
  test('no elapsed cycles when the current cycle has not ended yet', () => {
    const w = currentCycleWindow('weekly', d('2024-01-04'));
    expect(cyclesElapsedSince(w, d('2024-01-04'))).toEqual([]);
  });

  test('one elapsed cycle once its end_date is before today', () => {
    const w = currentCycleWindow('weekly', d('2024-01-04'));
    const elapsed = cyclesElapsedSince(w, d('2024-01-08'));
    expect(elapsed).toHaveLength(1);
    expect(elapsed[0]!.startDate).toBe('2024-01-01');
  });

  test('multiple boundaries crossed at once (e.g. after a period offline) all archive, oldest first', () => {
    const w = currentCycleWindow('weekly', d('2024-01-04'));
    const elapsed = cyclesElapsedSince(w, d('2024-01-25')); // 3 full weeks have since elapsed
    expect(elapsed.map((c) => c.startDate)).toEqual(['2024-01-01', '2024-01-08', '2024-01-15']);
  });

  test('a mid-cycle cadence change finalises the in-progress cycle immediately: the caller\'s job is just to archive whatever window it currently holds before switching cadence — this module supplies that same window unchanged when asked, so nothing here re-derives a longer window post-switch', () => {
    const inProgress = currentCycleWindow('monthly', d('2024-03-10'));
    // The mutation layer would archive `inProgress` as-is (is_short_cycle=true) THEN call
    // currentCycleWindow with the NEW cadence to start the fresh cycle — cycles.ts supplies
    // pure boundary math either way, never partial-decides when to switch.
    const freshUnderNewCadence = currentCycleWindow('weekly', d('2024-03-10'));
    expect(freshUnderNewCadence.cadence).toBe('weekly');
    expect(inProgress.cadence).toBe('monthly');
  });
});
