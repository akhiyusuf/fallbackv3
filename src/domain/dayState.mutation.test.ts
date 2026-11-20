/**
 * Mutation-testing survivors for `dayState.ts` (review/sonnet/32-mutation-testing.md).
 * Each test pins a behaviour that a one-line change to the source used to leave unnoticed.
 */
import type { DayLog, Instant, LocalDate, TaskWithSteps } from '@/types';
import { autoChipState, resolveOccurrence, resolvePushedOccurrence } from './dayState';

const d = (s: string) => s as LocalDate;

function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
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
    priorityRank: null,
    isNote: false,
    snoozable: true,
    createdAt: '2024-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    endedOn: null,
    idealSteps: [{ id: 'ideal-1' as never, taskId: 't1' as never, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null }],
    fallbackSteps: [{ id: 'fallback-1' as never, taskId: 't1' as never, role: 'fallback', text: 'Min', position: 0, dueWeekdays: null }],
    ...overrides,
  };
}

function log(overrides: Partial<DayLog>): DayLog {
  return {
    id: 'log-1' as DayLog['id'],
    taskId: 't1' as DayLog['taskId'],
    date: d('2024-06-01'),
    chipState: null,
    isManualOverride: false,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: '2024-06-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-06-01T00:00:00.000Z' as Instant,
    ...overrides,
  };
}

describe('dayState mutation survivors', () => {
  test('S04: a Course day with doses but no due ideal step still auto-logs from the doses alone', () => {
    const base = { taskId: 't1' as never, date: d('2024-06-01'), outcome: 'pending' as const, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 3 };
    expect(autoChipState({ ...base, dosesCompleted: 3 })).toBe('done');
    expect(autoChipState({ ...base, dosesCompleted: 1 })).toBe('fallback');
    expect(autoChipState({ ...base, dosesCompleted: 0 })).toBe('todo');
  });

  test('S11: a non-manual (auto) chip never overrides the steps: stale "done" with nothing ticked reads pending', () => {
    const o = resolveOccurrence({
      task: makeTask(),
      date: d('2024-06-01'),
      today: d('2024-06-01'),
      log: log({ chipState: 'done', isManualOverride: false, completedStepIds: [] }),
      offMarks: [],
    });
    expect(o.chipState).toBe('todo');
    expect(o.outcome).toBe('pending');
  });

  test('S12: a ticked step that is not due that day is not reported as completed', () => {
    // 2024-06-04 is a Tuesday. Step A is Monday-only, step B is every day.
    const task = makeTask({
      idealSteps: [
        { id: 'A' as never, taskId: 't1' as never, role: 'ideal', text: 'A', position: 0, dueWeekdays: [1] },
        { id: 'B' as never, taskId: 't1' as never, role: 'ideal', text: 'B', position: 1, dueWeekdays: null },
      ],
    });
    const o = resolveOccurrence({
      task,
      date: d('2024-06-04'),
      today: d('2024-06-04'),
      log: log({ date: d('2024-06-04'), completedStepIds: ['A' as never] }),
      offMarks: [],
    });
    expect(o.dueIdealStepIds).toEqual(['B']);
    expect(o.completedStepIds).toEqual([]);
    expect(o.outcome).toBe('pending');
  });

  test('S16: the visitor occurrence reports the SOURCE day it was pushed from', () => {
    // Saturday-only habit, pushed from Sat 06-01 to Sun 06-02 (not a natural day).
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [6] } });
    const source = log({ date: d('2024-06-01'), movedToDate: d('2024-06-02') });
    const o = resolveOccurrence({ task, date: d('2024-06-02'), today: d('2024-06-02'), log: null, offMarks: [], movedInLog: source });
    expect(o.pushedFrom).toBe('2024-06-01');
    expect(o.date).toBe('2024-06-02');
  });

  test('S17: the pushed occurrence beside a day\'s own reports the source day', () => {
    const source = log({ date: d('2024-06-01'), movedToDate: d('2024-06-02') });
    const o = resolvePushedOccurrence({ task: makeTask(), date: d('2024-06-02'), today: d('2024-06-02'), sourceLog: source, offMarks: [] });
    expect(o.pushedFrom).toBe('2024-06-01');
    expect(o.date).toBe('2024-06-02');
  });
});
