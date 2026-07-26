import type { Instant, LocalDate, TaskWithSteps, Weekday } from '@/types';
import { dueIdealStepIds, isDue, occurrencesBetween } from './occurrence';
import { studyingRoutine } from './__fixtures__';

const d = (s: string) => s as LocalDate;

function makeTask(overrides: Partial<TaskWithSteps>): TaskWithSteps {
  return {
    id: 't1' as TaskWithSteps['id'],
    type: 'routine',
    name: 'Test',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: null,
    necessity: null,
    todoDoneAt: null,
    createdAt: '2024-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [],
    fallbackSteps: [],
    ...overrides,
  };
}

describe('occurrence — cadence -> occurrence set', () => {
  test('an as-needed routine is NEVER due, regardless of cadence-shaped fields', () => {
    const task = makeTask({ isAsNeeded: true, cadence: { kind: 'daily' } });
    expect(isDue(task, d('2024-06-01'))).toBe(false);
    expect(occurrencesBetween(task, d('2024-06-01'), d('2024-06-30'))).toEqual([]);
  });

  test('a To-do is never due', () => {
    const task = makeTask({ type: 'todo', cadence: null });
    expect(isDue(task, d('2024-06-01'))).toBe(false);
  });

  test('daily cadence is due every day when no notBefore bound is supplied', () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    expect(isDue(task, d('2024-06-09'))).toBe(true);
    expect(isDue(task, d('2024-06-10'))).toBe(true);
  });

  test('the caller-supplied notBefore bound (device-local creation date — see file header) excludes earlier dates', () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    const notBefore = d('2024-06-10');
    expect(isDue(task, d('2024-06-09'), notBefore)).toBe(false); // before creation
    expect(isDue(task, d('2024-06-10'), notBefore)).toBe(true);
    expect(isDue(task, d('2024-06-11'), notBefore)).toBe(true);
  });

  test('a one-off Event ignores notBefore entirely — the due date IS the whole occurrence set, even backdated', () => {
    const task = makeTask({ type: 'event', cadence: null, eventDate: d('2024-01-01') });
    expect(isDue(task, d('2024-01-01'), d('2024-06-10'))).toBe(true); // event predates notBefore, still due
  });

  test('specific-weekdays is due only on the chosen ISO weekdays', () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1, 3, 5] as Weekday[] } });
    expect(isDue(task, d('2024-06-03'))).toBe(true); // Monday
    expect(isDue(task, d('2024-06-04'))).toBe(false); // Tuesday
    expect(isDue(task, d('2024-06-05'))).toBe(true); // Wednesday
  });

  test('a one-off Event is due exactly once, on its own date', () => {
    const task = makeTask({ type: 'event', cadence: null, eventDate: d('2024-07-04') });
    expect(isDue(task, d('2024-07-03'))).toBe(false);
    expect(isDue(task, d('2024-07-04'))).toBe(true);
    expect(isDue(task, d('2024-07-05'))).toBe(false);
  });

  test('a Course is due per its cadence, only within [startDate, endDate]', () => {
    const task = makeTask({
      type: 'course',
      cadence: { kind: 'daily' },
      startDate: d('2024-06-05'),
      endDate: d('2024-06-10'),
    });
    expect(isDue(task, d('2024-06-04'))).toBe(false);
    expect(isDue(task, d('2024-06-05'))).toBe(true);
    expect(isDue(task, d('2024-06-10'))).toBe(true);
    expect(isDue(task, d('2024-06-11'))).toBe(false);
  });

  test('weekly cadence is due once every 7 days, from its anchor', () => {
    const task = makeTask({ cadence: { kind: 'weekly', weekday: 3 as Weekday, anchorDate: d('2024-06-05') } }); // Wednesday
    expect(isDue(task, d('2024-06-05'))).toBe(true);
    expect(isDue(task, d('2024-06-12'))).toBe(true);
    expect(isDue(task, d('2024-06-06'))).toBe(false);
  });

  test('bi-weekly cadence skips alternate weeks', () => {
    const task = makeTask({ cadence: { kind: 'bi-weekly', weekday: 3 as Weekday, anchorDate: d('2024-06-05') } });
    expect(isDue(task, d('2024-06-05'))).toBe(true); // week 0
    expect(isDue(task, d('2024-06-12'))).toBe(false); // week 1 — skipped
    expect(isDue(task, d('2024-06-19'))).toBe(true); // week 2
  });

  test('monthly cadence is due on the same day-of-month every month', () => {
    const task = makeTask({ cadence: { kind: 'monthly', dayOfMonth: 15, anchorDate: d('2024-01-15') } });
    expect(isDue(task, d('2024-02-15'))).toBe(true);
    expect(isDue(task, d('2024-02-14'))).toBe(false);
  });

  test('yearly cadence is due once a year, on the anchor month+day', () => {
    const task = makeTask({ cadence: { kind: 'yearly', month: 12, dayOfMonth: 25, anchorDate: d('2023-12-25') } });
    expect(isDue(task, d('2024-12-25'))).toBe(true);
    expect(isDue(task, d('2024-06-25'))).toBe(false);
  });

  test('occurrencesBetween returns exactly the due dates in the range, inclusive', () => {
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] as Weekday[] } }); // Mondays only
    expect(occurrencesBetween(task, d('2024-06-01'), d('2024-06-14'))).toEqual(['2024-06-03', '2024-06-10']);
  });

  test('occurrencesBetween returns [] for an inverted range instead of looping forever', () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    expect(occurrencesBetween(task, d('2024-06-14'), d('2024-06-01'))).toEqual([]);
  });
});

describe('dueIdealStepIds — F23/F24 per-occurrence sub-step subsetting', () => {
  const studying = studyingRoutine();
  const [dailyReading, weeklyAssignments] = studying.idealSteps;

  test('a covered weekday (Tuesday) is due for the always-on step only', () => {
    const tuesday = d('2024-06-04'); // a Tuesday
    const ids = dueIdealStepIds(studying, tuesday);
    expect(ids).toEqual([dailyReading!.id]);
  });

  test('Friday additionally requires the Friday-only step', () => {
    const friday = d('2024-06-07');
    const ids = dueIdealStepIds(studying, friday);
    expect(ids.sort()).toEqual([dailyReading!.id, weeklyAssignments!.id].sort());
  });

  test('a non-due date (weekend) has no due ideal steps at all', () => {
    const saturday = d('2024-06-08');
    expect(dueIdealStepIds(studying, saturday)).toEqual([]);
  });
});
