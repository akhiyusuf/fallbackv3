/**
 * End routine vs Delete, through the real query hooks against FakeRepos. Ending stops a habit
 * and keeps it in the app; deleting takes it out of the app. Either way its past days stay in the
 * consistency record (and in badges and the trend), the days after it stopped are never misses,
 * and coming back (Start again, Restore) marks the days away off.
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

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Instant, LocalDate, Step, TaskWithSteps } from '@/types';

import { aggregateConsistency } from '@/domain';

import { resolveRecordOccurrences } from './internal';
import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { useDeleteForever, useDeleteTask, useEmptyRecentlyDeleted, useEndTask, useLogState, useRestoreTask, useSnoozeOccurrence, useStartAgain } from './mutations';
import { useAchievements, useConsistency, useConsistencyDisclosure, useRecentlyDeleted, useTask, useTaskOccurrences, useToday, useTrend } from './reads';

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: true },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(client: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const activeUnmounts: Array<() => void> = [];
const activeClients: QueryClient[] = [];

async function rh<T>(hook: () => T, client: QueryClient) {
  activeClients.push(client);
  const r = await renderHook(hook, { wrapper: makeWrapper(client) });
  activeUnmounts.push(r.unmount);
  return r;
}

afterEach(async () => {
  await act(async () => {
    activeUnmounts.forEach((fn) => fn());
  });
  activeUnmounts.length = 0;
  activeClients.forEach((c) => c.clear());
  activeClients.length = 0;
});

beforeEach(() => {
  fake.reset();
  clock.today = '2024-06-01';
  clock.now = '2024-06-01T12:00:00.000Z';
});

/** Runs one mutation hook and returns what it resolved to. */
async function mutate<TArg, TRes>(useHook: () => { mutateAsync: (a: TArg) => Promise<TRes> }, arg: TArg): Promise<TRes> {
  const { result } = await rh(useHook, freshClient());
  let out!: TRes;
  await act(async () => {
    out = await result.current.mutateAsync(arg);
  });
  return out;
}

/** Reads one query on a NEW client, so it is fetched from the repositories as they stand now. */
async function readNow<T>(useHook: () => { data: T | undefined; isSuccess: boolean; isError: boolean }): Promise<T> {
  const { result } = await rh(useHook, freshClient());
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result.current.data as T;
}

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `rd-task-${idCounter}`) as TaskWithSteps['id'];
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
    createdAt: '2023-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2023-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [idealStep],
    fallbackSteps: [fallbackStep],
    ...overrides,
  } as TaskWithSteps;
}


/** Logs a day for a task, the way the person would have (done = ideal, fallback = fallback). */
async function logDay(task: TaskWithSteps, date: string, chip: 'done' | 'fallback') {
  await repos.logs.upsert({
    id: `${task.id}-${date}` as never,
    taskId: task.id,
    date: date as LocalDate,
    chipState: chip,
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: `${date}T10:00:00.000Z` as Instant,
    updatedAt: `${date}T10:00:00.000Z` as Instant,
  });
}

/** A daily routine started on May 25, done on 25-27, fallback on 28, missed on 29-30, 31 not logged. */
async function seedHabit(name = 'Walk'): Promise<TaskWithSteps> {
  const task = makeTask({ name, createdAt: '2024-05-25T08:00:00.000Z' as Instant });
  fake.seedTask(task);
  for (const d of ['2024-05-25', '2024-05-26', '2024-05-27']) await logDay(task, d, 'done');
  await logDay(task, '2024-05-28', 'fallback');
  return task;
}

const aggregate = () => readNow(() => useConsistency({ scope: 'aggregate', window: 'all-time' }));
/** Aggregate consistency over a chosen date range, read from the same record the app reads. */
async function lastWeek(from: string, to: string) {
  const occs = await resolveRecordOccurrences(repos, clock.today as LocalDate, clock.today as LocalDate);
  return aggregateConsistency({ occurrences: occs, window: { from: from as LocalDate, to: to as LocalDate }, today: clock.today as LocalDate });
}

/* ------------------------------------------------------------------ End routine */

describe('End routine', () => {
  it('with today not logged: it ends yesterday, its past still counts, and it is due on nothing from today', async () => {
    const task = await seedHabit();
    const before = await aggregate();
    const result = await mutate(useEndTask, task.id);
    expect(result).toEqual({ ok: true, value: '2024-05-31' });
    expect((await readNow(() => useTask(task.id)))!.endedOn).toBe('2024-05-31');

    // Today: not on the list at all.
    const today = await readNow(() => useToday('2024-06-01' as LocalDate));
    expect(today.filter((o) => o.date === '2024-06-01')).toEqual([]);
    // The record is exactly what it was (today was open, never counted either way).
    expect(await aggregate()).toEqual(before);

    // Weeks later, the days after it ended are still not misses.
    const atEnd = await lastWeek('2024-05-25', '2024-05-31');
    clock.today = '2024-06-20';
    clock.now = '2024-06-20T12:00:00.000Z';
    const later = await lastWeek('2024-05-25', '2024-06-20');
    expect(later.denominator).toBe(atEnd.denominator);
    expect(later.numerator).toBe(atEnd.numerator);
  });

  it('with today already logged: it ends today, and today counts', async () => {
    const task = await seedHabit();
    await logDay(task, '2024-06-01', 'done');
    const result = await mutate(useEndTask, task.id);
    expect(result).toEqual({ ok: true, value: '2024-06-01' });
    const occs = await readNow(() => useTaskOccurrences(task.id, { from: '2024-05-31' as LocalDate, to: '2024-06-02' as LocalDate }));
    expect(occs.map((o) => [o.date, o.outcome])).toEqual([
      ['2024-05-31', 'missed'],
      ['2024-06-01', 'ideal'],
    ]);
  });

  it('ending twice keeps the first end date', async () => {
    const task = await seedHabit();
    await mutate(useEndTask, task.id);
    clock.today = '2024-06-05';
    clock.now = '2024-06-05T12:00:00.000Z';
    expect(await mutate(useEndTask, task.id)).toEqual({ ok: true, value: '2024-05-31' });
  });

  it('logging a day after it ended is refused', async () => {
    const task = await seedHabit();
    await mutate(useEndTask, task.id);
    const result = await mutate(useLogState, { taskId: task.id, date: '2024-06-01' as LocalDate, chip: 'done' as const });
    expect(result.ok).toBe(false);
  });

  it('a deleted task cannot be ended', async () => {
    const task = await seedHabit();
    await mutate(useDeleteTask, task.id);
    expect((await mutate(useEndTask, task.id)).ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ Start again */

describe('Start again', () => {
  it('brings it back from today, and the days it was ended are off (neither missed nor done)', async () => {
    const task = await seedHabit();
    await mutate(useEndTask, task.id); // ended May 31
    const recordAtEnd = await lastWeek('2024-05-25', '2024-05-31');
    clock.today = '2024-06-10';
    clock.now = '2024-06-10T12:00:00.000Z';
    expect((await mutate(useStartAgain, task.id)).ok).toBe(true);
    expect((await readNow(() => useTask(task.id)))!.endedOn).toBeNull();

    const gap = await readNow(() => useTaskOccurrences(task.id, { from: '2024-06-01' as LocalDate, to: '2024-06-10' as LocalDate }));
    expect(gap.filter((o) => o.date < '2024-06-10').every((o) => o.outcome === 'off')).toBe(true);
    expect(gap.find((o) => o.date === '2024-06-10')?.outcome).toBe('pending');
    // The pause adds nothing to the record: same days counted, same days shown up.
    const now = await lastWeek('2024-05-25', '2024-06-09');
    expect(now.denominator).toBe(recordAtEnd.denominator);
    expect(now.numerator).toBe(recordAtEnd.numerator);
    // And it is due again today.
    const today = await readNow(() => useToday('2024-06-10' as LocalDate));
    expect(today.some((o) => o.taskId === task.id && o.date === '2024-06-10')).toBe(true);
  });

  it('started again the same day it ended: nothing is marked off', async () => {
    const task = await seedHabit();
    await logDay(task, '2024-06-01', 'done');
    await mutate(useEndTask, task.id); // ended today
    expect((await mutate(useStartAgain, task.id)).ok).toBe(true);
    const occs = await readNow(() => useTaskOccurrences(task.id, { from: '2024-05-25' as LocalDate, to: '2024-06-01' as LocalDate }));
    expect(occs.some((o) => o.outcome === 'off')).toBe(false);
  });

  it('on something that was never ended: nothing changes', async () => {
    const task = await seedHabit();
    expect((await mutate(useStartAgain, task.id)).ok).toBe(true);
    expect((await readNow(() => useTask(task.id)))!.endedOn ?? null).toBeNull();
  });
});

/* ------------------------------------------------------------------ Delete keeps the record */

describe('deleting keeps the consistency record', () => {
  it('soft delete: past days still count; the unlogged deletion day does not', async () => {
    const task = await seedHabit();
    const before = await aggregate();
    await mutate(useDeleteTask, task.id);
    expect(await aggregate()).toEqual(before);
    // A month on, the days after the deletion are not misses.
    clock.today = '2024-06-20';
    clock.now = '2024-06-20T12:00:00.000Z';
    const later = await lastWeek('2024-05-25', '2024-06-20');
    expect(later.denominator).toBe(before.denominator);
    expect(later.numerator).toBe(before.numerator);
  });

  it('soft delete on a day already logged: that day counts', async () => {
    const task = await seedHabit();
    await logDay(task, '2024-06-01', 'fallback');
    await mutate(useDeleteTask, task.id);
    clock.today = '2024-06-02';
    clock.now = '2024-06-02T12:00:00.000Z';
    const r = await lastWeek('2024-06-01', '2024-06-01');
    expect(r.denominator).toBe(1);
    expect(r.numerator).toBeGreaterThan(0);
  });

  it('delete forever: the record is unchanged, and only settled days are kept, with no name', async () => {
    const task = await seedHabit();
    await mutate(useDeleteTask, task.id);
    const before = await aggregate();
    const perDay = async () => (await readNow(useConsistencyDisclosure)).map((d) => [d.date, d.fraction]);
    const disclosureBefore = await perDay();
    expect((await mutate(useDeleteForever, task.id)).ok).toBe(true);
    expect(await readNow(() => useTask(task.id))).toBeNull();
    expect(await aggregate()).toEqual(before);
    // Same days, same fractions; only the name behind them is gone.
    expect(await perDay()).toEqual(disclosureBefore);
    const kept = await repos.retiredDays.list();
    expect(kept.map((d) => [d.date, d.outcome])).toEqual([
      ['2024-05-25', 'ideal'],
      ['2024-05-26', 'ideal'],
      ['2024-05-27', 'ideal'],
      ['2024-05-28', 'fallback'],
      ['2024-05-29', 'missed'],
      ['2024-05-30', 'missed'],
      ['2024-05-31', 'missed'],
    ]);
    expect(JSON.stringify(kept)).not.toContain('Walk');
  });

  it('Delete all forever keeps every item’s days', async () => {
    const a = await seedHabit('A');
    const b = await seedHabit('B');
    await mutate(useDeleteTask, a.id);
    await mutate(useDeleteTask, b.id);
    const before = await aggregate();
    expect(await mutate(useEmptyRecentlyDeleted, undefined)).toEqual({ ok: true, value: 2 });
    expect(await aggregate()).toEqual(before);
    expect((await repos.retiredDays.list()).length).toBe(14);
  });

  it('the 30-day expiry keeps the days too', async () => {
    const task = await seedHabit();
    await mutate(useDeleteTask, task.id);
    const before = await aggregate();
    clock.today = '2024-07-05';
    clock.now = '2024-07-05T12:00:00.000Z';
    expect(await readNow(useRecentlyDeleted)).toEqual([]);
    expect(await repos.tasks.get(task.id)).toBeNull();
    const after = await lastWeek('2024-05-25', '2024-07-05');
    expect(after.denominator).toBe(before.denominator);
    expect(after.numerator).toBe(before.numerator);
  });

  it('badges keep counting the deleted habit’s days (fallback wins, comebacks)', async () => {
    const task = await seedHabit();
    await mutate(useDeleteTask, task.id);
    await mutate(useDeleteForever, task.id);
    const badges = (await readNow(useAchievements)).map((u) => u.key);
    expect(badges).toContain('fallback-safety-net');
  });

  it('the trend still starts from the deleted habit’s first day', async () => {
    const task = await seedHabit();
    await mutate(useDeleteTask, task.id);
    await mutate(useDeleteForever, task.id);
    const trend = await readNow(useTrend);
    expect(trend.length).toBeGreaterThan(0);
    expect(trend[0]!.range.from <= '2024-05-25').toBe(true);
    expect(trend.some((p) => p.percent !== null)).toBe(true);
  });
});

/* ------------------------------------------------------------------ Restore */

describe('restoring after some days away', () => {
  it('the days it was deleted are off, so they are not misses', async () => {
    const task = await seedHabit();
    await mutate(useDeleteTask, task.id); // deleted June 1, unlogged
    const before = await aggregate();
    clock.today = '2024-06-05';
    clock.now = '2024-06-05T12:00:00.000Z';
    expect((await mutate(useRestoreTask, task.id)).ok).toBe(true);
    const gap = await readNow(() => useTaskOccurrences(task.id, { from: '2024-06-01' as LocalDate, to: '2024-06-05' as LocalDate }));
    expect(gap.map((o) => [o.date, o.outcome])).toEqual([
      ['2024-06-01', 'off'],
      ['2024-06-02', 'off'],
      ['2024-06-03', 'off'],
      ['2024-06-04', 'off'],
      ['2024-06-05', 'pending'],
    ]);
    const after = await lastWeek('2024-05-25', '2024-06-04');
    expect(after.denominator).toBe(before.denominator);
  });

  it('a deletion day that was logged keeps its log, not an off mark', async () => {
    const task = await seedHabit();
    await logDay(task, '2024-06-01', 'done');
    await mutate(useDeleteTask, task.id);
    clock.today = '2024-06-03';
    clock.now = '2024-06-03T12:00:00.000Z';
    await mutate(useRestoreTask, task.id);
    const occs = await readNow(() => useTaskOccurrences(task.id, { from: '2024-06-01' as LocalDate, to: '2024-06-02' as LocalDate }));
    expect(occs.map((o) => [o.date, o.outcome])).toEqual([
      ['2024-06-01', 'ideal'],
      ['2024-06-02', 'off'],
    ]);
  });

  it('Undo straight after deleting marks nothing off: today is open again', async () => {
    const task = await seedHabit();
    await mutate(useDeleteTask, task.id);
    await mutate(useRestoreTask, task.id);
    const occs = await readNow(() => useTaskOccurrences(task.id, { from: '2024-06-01' as LocalDate, to: '2024-06-01' as LocalDate }));
    expect(occs.map((o) => o.outcome)).toEqual(['pending']);
  });

  // Found by the year simulation (review/sonnet/24-simulation.md, seed 2): a weekday habit pushed
  // from Friday lands on Saturday, a day it is not naturally due, so marking the days away off by
  // cadence alone missed it and coming back read Saturday as a miss.
  it('restore does not turn a day pushed before the delete into a miss', async () => {
    clock.today = '2024-05-31'; // a Friday
    clock.now = '2024-05-31T12:00:00.000Z';
    const task = makeTask({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] }, createdAt: '2024-05-20T08:00:00.000Z' as Instant });
    fake.seedTask(task);
    expect((await mutate(useSnoozeOccurrence, { taskId: task.id, date: '2024-05-31' as LocalDate })).ok).toBe(true);
    await mutate(useDeleteTask, task.id);
    clock.today = '2024-06-03'; // Monday
    clock.now = '2024-06-03T12:00:00.000Z';
    expect((await mutate(useRestoreTask, task.id)).ok).toBe(true);
    const occs = await readNow(() => useTaskOccurrences(task.id, { from: '2024-05-31' as LocalDate, to: '2024-06-02' as LocalDate }));
    expect(occs.some((o) => o.outcome === 'missed')).toBe(false);
  });
});
