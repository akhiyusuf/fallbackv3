/**
 * Mutation-testing survivors for `internal.ts` (review/sonnet/32-mutation-testing.md). Each test
 * pins one behaviour that a one-line change to the source left unnoticed by the existing suite.
 * Fake repositories and a controllable clock, like `endedAndRetired.test.tsx`.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});

jest.mock('@/db', () => require('./testSupport/dbMock'));

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import type { DayLog, Instant, LocalDate, Step, TaskWithSteps } from '@/types';

import {
  deletionDay,
  markAwayDaysOff,
  recordStartDate,
  recordToKeep,
  resolveOneOccurrence,
  resolveRecordOccurrences,
  resolveTaskOccurrences,
  retireDeleted,
} from './internal';
import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';

const d = (s: string) => s as LocalDate;

beforeEach(() => {
  fake.reset();
  clock.today = '2024-06-01';
  clock.now = '2024-06-01T12:00:00.000Z';
});

afterEach(() => {
  jest.restoreAllMocks();
});

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `mt-task-${idCounter}`) as TaskWithSteps['id'];
  const idealStep: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fallbackStep: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null };
  return {
    id,
    type: 'routine',
    name: 'Walk',
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
    createdAt: '2024-05-25T12:00:00.000Z' as Instant,
    updatedAt: '2024-05-25T12:00:00.000Z' as Instant,
    deletedAt: null,
    endedOn: null,
    idealSteps: [idealStep],
    fallbackSteps: [fallbackStep],
    ...overrides,
  } as TaskWithSteps;
}

function dayLog(task: TaskWithSteps, date: string, patch: Partial<DayLog> = {}): DayLog {
  return {
    id: `${task.id}-${date}` as DayLog['id'],
    taskId: task.id,
    date: d(date),
    chipState: 'done',
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: `${date}T10:00:00.000Z` as Instant,
    updatedAt: `${date}T10:00:00.000Z` as Instant,
    ...patch,
  };
}

async function logDay(task: TaskWithSteps, date: string, chip: 'done' | 'fallback' = 'done', patch: Partial<DayLog> = {}) {
  await repos.logs.upsert(dayLog(task, date, { chipState: chip, ...patch }));
}

describe('internal.ts mutation survivors', () => {
  test('I02: a deleted habit\'s record keeps a day logged today even when its deletion day is still ahead (clock set back)', async () => {
    const task = makeTask({ deletedAt: '2024-06-10T12:00:00.000Z' as Instant });
    fake.seedTask(task);
    await logDay(task, '2024-05-31');
    await logDay(task, '2024-06-01'); // today, logged
    const occs = await resolveRecordOccurrences(repos, d('2024-06-01'), d('2024-06-01'));
    const mine = occs.filter((o) => o.taskId === task.id).map((o) => [o.date, o.outcome]);
    expect(mine).toContainEqual(['2024-05-31', 'ideal']);
    expect(mine).toContainEqual(['2024-06-01', 'ideal']);
  });

  test('I10: asking for a pushed occurrence from a day that did not push into this one returns the day\'s own occurrence', async () => {
    const task = makeTask();
    await logDay(task, '2024-06-01', 'done', { movedToDate: d('2024-06-02'), chipState: null, isManualOverride: false });
    const own = await resolveOneOccurrence(repos, task, d('2024-06-02'), d('2024-06-02'), d('2024-05-30'));
    expect(own.pushedFrom).toBeUndefined();
    const pushed = await resolveOneOccurrence(repos, task, d('2024-06-02'), d('2024-06-02'), d('2024-06-01'));
    expect(pushed.pushedFrom).toBe('2024-06-01');
  });

  test('I13: a deleted habit\'s record never reaches past its deletion day', async () => {
    const task = makeTask({ deletedAt: '2024-06-01T12:00:00.000Z' as Instant });
    fake.seedTask(task);
    await logDay(task, '2024-05-30');
    await logDay(task, '2024-06-05'); // a stray row after the deletion day, on today
    const occs = await resolveRecordOccurrences(repos, d('2024-06-05'), d('2024-06-05'));
    const dates = occs.filter((o) => o.taskId === task.id).map((o) => o.date);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((x) => x <= '2024-06-01')).toBe(true);
  });

  test('I26: what a deleted habit leaves in the record when removed for good stops at its deletion day', async () => {
    clock.today = '2024-06-05';
    const task = makeTask({ deletedAt: '2024-06-01T12:00:00.000Z' as Instant });
    fake.seedTask(task);
    await logDay(task, '2024-05-30');
    await logDay(task, '2024-06-05'); // a stray row on today, after the deletion day
    const keep = await recordToKeep(repos, task, d('2024-06-05'), '2024-06-05T12:00:00.000Z' as Instant);
    expect(keep.length).toBeGreaterThan(0);
    expect(keep.every((k) => k.date <= '2024-06-01')).toBe(true);
    expect(keep.some((k) => k.date === '2024-05-30' && k.outcome === 'ideal')).toBe(true);
  });

  test('I19: a habit restored while the clear-out runs is skipped, and the clear-out carries on', async () => {
    const a = makeTask({ deletedAt: '2024-04-01T12:00:00.000Z' as Instant });
    const b = makeTask({ deletedAt: '2024-04-02T12:00:00.000Z' as Instant });
    fake.seedTask(a);
    fake.seedTask(b);
    const real = repos.tasks.deleteForever.bind(repos.tasks);
    let calls = 0;
    jest.spyOn(repos.tasks, 'deleteForever').mockImplementation(async (id, keep) => {
      calls += 1;
      if (calls === 1) return { ok: false as const, error: { code: 'NOT_FOUND' as const, message: 'restored meanwhile' } };
      return real(id, keep);
    });
    const result = await retireDeleted(repos, 'all', '2024-06-01T12:00:00.000Z' as Instant);
    expect(result).toEqual({ ok: true, value: 1 });
    expect(calls).toBe(2);
  });

  test('I22: the record starts on the EARLIEST day of any habit, deleted ones and retired days included', async () => {
    fake.seedTask(makeTask({ createdAt: '2024-05-20T12:00:00.000Z' as Instant }));
    fake.seedTask(makeTask({ createdAt: '2024-05-10T12:00:00.000Z' as Instant, deletedAt: '2024-05-28T12:00:00.000Z' as Instant }));
    expect(await recordStartDate(repos)).toBe('2024-05-10');
    await repos.retiredDays.add([{ date: d('2024-05-05'), outcome: 'ideal', retiredAt: '2024-05-30T12:00:00.000Z' as Instant }]);
    expect(await recordStartDate(repos)).toBe('2024-05-05');
  });

  test('I23: a retired day carries the chip it was logged with, so the record still reads done or fallback', async () => {
    const at = '2024-05-30T12:00:00.000Z' as Instant;
    await repos.retiredDays.add([
      { date: d('2024-05-01'), outcome: 'ideal', retiredAt: at },
      { date: d('2024-05-02'), outcome: 'fallback', retiredAt: at },
      { date: d('2024-05-03'), outcome: 'missed', retiredAt: at },
    ]);
    const occs = await resolveRecordOccurrences(repos, d('2024-06-01'), d('2024-06-01'));
    const retired = occs.filter((o) => String(o.taskId).startsWith('retired:'));
    expect(retired.map((o) => [o.date, o.outcome, o.chipState])).toEqual([
      ['2024-05-01', 'ideal', 'done'],
      ['2024-05-02', 'fallback', 'fallback'],
      ['2024-05-03', 'missed', null],
    ]);
  });

  test('I25: an Event backdated before the day it was created still has its own day', async () => {
    const task = makeTask({ type: 'event', cadence: null, eventDate: d('2024-05-20'), createdAt: '2024-05-25T12:00:00.000Z' as Instant });
    const occs = await resolveTaskOccurrences(repos, task, d('2024-06-01'), d('2024-06-01'));
    expect(occs.map((o) => [o.date, o.outcome])).toEqual([['2024-05-20', 'missed']]);
  });

  test('I31: a Course that starts before the day it was created still resolves from its start date', async () => {
    const task = makeTask({
      type: 'course',
      cadence: { kind: 'daily' },
      startDate: d('2024-05-20'),
      endDate: d('2024-05-23'),
      createdAt: '2024-05-25T12:00:00.000Z' as Instant,
    });
    const occs = await resolveTaskOccurrences(repos, task, d('2024-06-01'), d('2024-06-01'));
    expect(occs.map((o) => o.date)).toEqual(['2024-05-20', '2024-05-21', '2024-05-22', '2024-05-23']);
  });

  test('I29: days away are marked off only on the days the habit is actually due', async () => {
    // Monday-only habit; 2024-05-27 and 2024-06-03 are Mondays.
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1] }, createdAt: '2024-01-01T12:00:00.000Z' as Instant });
    fake.seedTask(task);
    const r = await markAwayDaysOff(repos, task, d('2024-05-27'), d('2024-06-09'));
    expect(r.ok).toBe(true);
    const marks = await repos.offDays.listRange(d('2024-05-01'), d('2024-06-30'));
    expect(marks.map((m) => m.date).sort()).toEqual(['2024-05-27', '2024-06-03']);
    expect(marks.every((m) => m.taskId === task.id)).toBe(true);
  });

  test('I30: the deletion day is the one stored with the habit, not re-derived from the instant', () => {
    const stored = makeTask({ deletedAt: '2024-06-10T12:00:00.000Z' as Instant, deletedOn: d('2024-06-08') });
    expect(deletionDay(stored)).toBe('2024-06-08');
    const derived = makeTask({ deletedAt: '2024-06-10T12:00:00.000Z' as Instant });
    expect(deletionDay(derived)).toBe('2024-06-10');
    expect(deletionDay(makeTask())).toBeNull();
  });
});
