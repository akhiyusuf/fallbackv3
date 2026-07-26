import type { LocalDate } from '@/types';
import { currentCycleWindow, cyclesElapsedSince, freshCycleWindow, nextCycleWindow } from './cycles';

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
    // The mutation layer archives `inProgress` as-is (is_short_cycle=true, ending TODAY, not
    // its natural end) THEN starts the fresh cycle via `freshCycleWindow` — see that
    // function's own tests below for why NOT `currentCycleWindow` (review pass 2, item N3).
    const freshUnderNewCadence = freshCycleWindow('weekly', d('2024-03-20'));
    expect(freshUnderNewCadence.cadence).toBe('weekly');
    expect(inProgress.cadence).toBe('monthly');
  });
});

describe('freshCycleWindow — review pass 2, blocking item N3', () => {
  test('starts EXACTLY at the given date, never snapped back to the calendar period start', () => {
    const w = freshCycleWindow('monthly', d('2024-03-20')); // mid-month
    expect(w.startDate).toBe('2024-03-20'); // NOT 2024-03-01 (what currentCycleWindow would give)
    expect(w.endDate).toBe('2024-03-31'); // still the natural period end
  });

  test('weekly: starts at the given date, ends at that week\'s natural Sunday', () => {
    const w = freshCycleWindow('weekly', d('2024-03-20')); // a Wednesday
    expect(w.startDate).toBe('2024-03-20');
    expect(w.endDate).toBe('2024-03-24'); // that week's Sunday, NOT a full 7-day span from the 20th
  });

  test('is deterministic — same cadence + startDate always yields the same id', () => {
    const a = freshCycleWindow('monthly', d('2024-03-20'));
    const b = freshCycleWindow('monthly', d('2024-03-20'));
    expect(a.id).toBe(b.id);
  });
});
