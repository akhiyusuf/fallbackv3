/**
 * Edge-case campaign, area 17 (numbers), query layer. Drives the real mutation functions
 * (`__testing__`, the exact functions the `use*` hooks wrap) and read hooks against FakeRepos with
 * a mocked clock. Covers XP award and retraction, badges through real logging, and cycle archiving
 * (catch-up, idempotent retry, deleted and retired habits' days, cadence change).
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

import { on } from '@/lib/events';
import type { ChipState, Instant, LocalDate, Step, TaskWithSteps } from '@/types';

import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { useDeleteTask } from './mutations';
import { useAchievements, useConsistency, useProgress } from './reads';
import { __testing__ } from './mutations';

const { logState, markOffDay, reconcileCycleBoundaries, finalizeCycleForCadenceChange } = __testing__;

const d = (s: string) => s as LocalDate;

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

async function rh<T>(hook: () => T) {
  const client = freshClient();
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

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `num-task-${idCounter}`) as TaskWithSteps['id'];
  const idealStep: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fallbackStep: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min', position: 0, dueWeekdays: null };
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

/** Writes a logged day straight into the store (history that predates the test action). */
async function seedLog(taskId: TaskWithSteps['id'], date: string, chip: ChipState) {
  await repos.logs.upsert({
    id: `${taskId}-${date}` as never,
    taskId,
    date: date as LocalDate,
    chipState: chip,
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: clock.now as Instant,
    updatedAt: clock.now as Instant,
  });
}

/** Adds one consecutive day of history for `taskId` for each chip in `chips`, ending the day before `last`. */
async function seedRun(taskId: TaskWithSteps['id'], startDate: string, chips: ChipState[]) {
  let date = d(startDate);
  for (const chip of chips) {
    await seedLog(taskId, date, chip);
    const [y, m, dd] = [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
    date = d(new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10));
  }
}

const xpTotal = () => fake.xpAwards().reduce((s, a) => s + a.amount, 0);

describe('XP: once per occurrence, retracted on un-log, never negative, never taken by deleting', () => {
  test('logging ideal awards 10 once; the lifetime total is 10 after one log', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const res = await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    expect(res.ok).toBe(true);
    expect(xpTotal()).toBe(10);
  });

  test('un-logging (To do) retracts the award, and un-logging again never drives XP negative', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'todo' });
    expect(xpTotal()).toBe(0);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'todo' });
    expect(xpTotal()).toBe(0);
    expect(xpTotal()).toBeGreaterThanOrEqual(0);
  });

  test('ideal to fallback downgrades the single award from 10 to 6, it does not add a second award', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'fallback' });
    expect(fake.xpAwards()).toHaveLength(1);
    expect(xpTotal()).toBe(6);
  });

  test('marking the day Off never retracts XP already earned (never an XP penalty)', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    await markOffDay({ date: d('2024-06-01'), taskId: task.id, mark: true });
    expect(xpTotal()).toBe(10);
  });

  test('deleting the task (soft) never takes XP away', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    const { result } = await rh(useDeleteTask);
    await act(async () => {
      await result.current.mutateAsync(task.id);
    });
    expect(xpTotal()).toBe(10);
  });

  test('re-affirming the same chip does not add XP to the lifetime total', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    expect(xpTotal()).toBe(10);
  });

  // BUG (src/queries/mutations.ts, reconcileOccurrence, around the appendXpAward branch): an
  // unchanged re-log returns xpAwarded = 10 again (the award's amount, not the change in lifetime
  // XP), so the celebration toast and the xp:awarded event repeat "+10 XP" for a day already earned.
  test.failing('BUG: re-logging the same ideal reports xpAwarded 0 the second time, not 10', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    const again = await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    expect(again.ok && again.value.xpAwarded).toBe(0);
  });

  test('a level-up fires exactly when lifetime XP crosses 100 (99 does not, 100 does)', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await fake.repos.progress.appendXpAward({ id: 'seed' as never, taskId: null, date: d('2024-05-01'), kind: 'ideal', amount: 90, cycleId: 'cycle:monthly:2024-06-01' as never, createdAt: clock.now as Instant });
    const levels: number[] = [];
    const off = on('level:up', (e) => levels.push(e.level));
    const res = await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'fallback' });
    off();
    expect(res.ok && res.value.xpAwarded).toBe(6);
    expect(res.ok && res.value.levelUp).toMatchObject({ level: 2, xpIntoLevel: 0 });
    expect(levels).toEqual([2]);
  });
});

describe('badges through real logging', () => {
  test('seven shown-up days in a row unlock showing-up-7 dated the seventh day, and it is persisted', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await seedRun(task.id, '2024-05-25', ['done', 'done', 'done', 'done', 'done', 'done']);
    const sixth = await logState({ taskId: task.id, date: d('2024-05-31'), chip: 'done' });
    expect(sixth.ok && sixth.value.badgesUnlocked).not.toContain('showing-up-7');
    clock.today = '2024-06-01';
    const seventh = await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    expect(seventh.ok && seventh.value.badgesUnlocked).toContain('showing-up-7');
    const stored = fake.unlocks().find((u) => u.key === 'showing-up-7');
    expect(stored?.unlockedOn).toBe('2024-06-01');
  });

  test('the first fallback unlocks Safety net dated that day, not the day it was persisted later', async () => {
    const task = makeTask();
    fake.seedTask(task);
    clock.today = '2024-06-05';
    const res = await logState({ taskId: task.id, date: d('2024-06-02'), chip: 'fallback' });
    expect(res.ok && res.value.badgesUnlocked).toContain('fallback-safety-net');
    expect(fake.unlocks().find((u) => u.key === 'fallback-safety-net')?.unlockedOn).toBe('2024-06-02');
  });

  test('a badge earned by a task survives deleting that task (badges are never revoked)', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await seedRun(task.id, '2024-05-25', ['done', 'done', 'done', 'done', 'done', 'done', 'done']);
    await logState({ taskId: task.id, date: d('2024-06-01'), chip: 'done' });
    const before = fake.unlocks().map((u) => u.key);
    expect(before).toContain('showing-up-7');
    const { result } = await rh(useDeleteTask);
    await act(async () => {
      await result.current.mutateAsync(task.id);
    });
    expect(fake.unlocks().map((u) => u.key)).toContain('showing-up-7');
  });

  test('the achievements read shows a badge with its true date and counts only live history', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await seedRun(task.id, '2024-05-25', ['done', 'done', 'done', 'done', 'done', 'done', 'done']);
    const { result } = await rh(useAchievements);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const seven = (result.current.data ?? []).find((u) => u.key === 'showing-up-7');
    expect(seven?.unlockedOn).toBe('2024-05-31');
  });
});

describe('consistency read at the start of use', () => {
  test('a brand-new user with no history reads null, not 0%', async () => {
    fake.seedTask(makeTask());
    const { result } = await rh(() => useConsistency({ scope: 'aggregate', window: 'last-30' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.percent).toBeNull();
  });

  test('a single day logged reads 100%, not a fraction', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await seedLog(task.id, '2024-06-01', 'done');
    const { result } = await rh(() => useConsistency({ scope: 'aggregate', window: 'last-7' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.percent).toBe(100);
  });
});

describe('cycles: archiving through the boundary', () => {
  test('app not opened for three whole monthly cycles: a single log archives Jan, Feb, Mar once each, in order', async () => {
    fake.seedSettings({ cycleCadence: 'monthly' });
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-01-01' as never, cadence: 'monthly', startDate: d('2024-01-01'), endDate: d('2024-01-31') });
    clock.today = '2024-04-02';
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-04-02'), chip: 'done' });
    const records = fake.cycleRecords();
    expect(records.map((r) => r.startDate)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
    expect(records.map((r) => r.endDate)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
    expect((await fake.repos.cycleState.get())?.startDate).toBe('2024-04-01');
  });

  test('retrying the boundary sweep after success archives nothing new (idempotent)', async () => {
    fake.seedSettings({ cycleCadence: 'monthly' });
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-01-01' as never, cadence: 'monthly', startDate: d('2024-01-01'), endDate: d('2024-01-31') });
    clock.today = '2024-03-05';
    await reconcileCycleBoundaries();
    const count = fake.cycleRecords().length;
    expect(count).toBe(2);
    await reconcileCycleBoundaries();
    await reconcileCycleBoundaries();
    expect(fake.cycleRecords().length).toBe(count);
  });

  test('a cycle record includes days of a habit that was deleted and of one retired for good', async () => {
    fake.seedSettings({ cycleCadence: 'monthly' });
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-01-01' as never, cadence: 'monthly', startDate: d('2024-01-01'), endDate: d('2024-01-31') });
    const live = makeTask({ id: 'live-task' as never });
    const deleted = makeTask({ id: 'deleted-task' as never });
    fake.seedTask(live);
    fake.seedTask(deleted);
    // Deleted before the boundary: its January days still belong to the January record.
    await seedRun('deleted-task' as never, '2024-01-01', ['done', 'done']);
    await fake.repos.tasks.softDelete('deleted-task' as never);
    await seedRun('live-task' as never, '2024-01-01', ['done']);
    await fake.repos.tasks.deleteForever('live-task' as never, [{ date: d('2024-01-02'), outcome: 'missed', retiredAt: clock.now as Instant }]);
    clock.today = '2024-02-03';
    await reconcileCycleBoundaries();
    const jan = fake.cycleRecords().find((r) => r.startDate === '2024-01-01');
    expect(jan).toBeDefined();
    expect(jan?.breakdown).toMatchObject({ ideal: 3, missed: 1 });
    expect(jan?.consistencyPercent).toBe(75);
  });

  test('a cadence change on the first day of a cycle archives no zero-length record', async () => {
    fake.seedSettings({ cycleCadence: 'monthly' });
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-06-01' as never, cadence: 'monthly', startDate: d('2024-06-01'), endDate: d('2024-06-30') });
    clock.today = '2024-06-01';
    await finalizeCycleForCadenceChange('weekly');
    expect(fake.cycleRecords()).toHaveLength(0);
    const pointer = await fake.repos.cycleState.get();
    expect(pointer).toMatchObject({ cadence: 'weekly', startDate: '2024-06-01', endDate: '2024-06-02' });
  });

  test('a mid-month cadence change archives a short record ending yesterday, disjoint from the fresh window', async () => {
    fake.seedSettings({ cycleCadence: 'monthly' });
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-06-01' as never, cadence: 'monthly', startDate: d('2024-06-01'), endDate: d('2024-06-30') });
    clock.today = '2024-06-10';
    await finalizeCycleForCadenceChange('weekly');
    const [short] = fake.cycleRecords();
    expect(short).toMatchObject({ startDate: '2024-06-01', endDate: '2024-06-09', isShortCycle: true });
    expect((await fake.repos.cycleState.get())?.startDate).toBe('2024-06-10');
  });

  // BUG (src/queries/mutations.ts, reconcileOccurrence step 3 before step 5): on the first log after a
  // boundary, the XP award is stamped with the cycle pointer that is still the OLD cycle, because
  // reconcileCycleBoundaries runs only at step 5. The new cycle's XP is then archived into the old
  // cycle's record and the new cycle reads 0.
  test.failing('BUG: the first log after a cycle boundary is credited to the NEW cycle, not the closed one', async () => {
    fake.seedSettings({ cycleCadence: 'monthly' });
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-01-01' as never, cadence: 'monthly', startDate: d('2024-01-01'), endDate: d('2024-01-31') });
    clock.today = '2024-02-01';
    const task = makeTask();
    fake.seedTask(task);
    await logState({ taskId: task.id, date: d('2024-02-01'), chip: 'done' });
    const jan = fake.cycleRecords().find((r) => r.startDate === '2024-01-01');
    expect(jan?.cyclingXpFinal).toBe(0);
    expect((await fake.repos.progress.cyclingXp('cycle:monthly:2024-02-01' as never))).toBe(10);
  });

  // BUG (src/queries/reads.ts useProgress): nothing advances the cycle pointer on app open, so
  // after several cycles the Progress read still names the old cycle until the next log.
  test.failing('BUG: the progress read names the cycle containing today even when the app was not opened for months', async () => {
    fake.seedSettings({ cycleCadence: 'monthly' });
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-01-01' as never, cadence: 'monthly', startDate: d('2024-01-01'), endDate: d('2024-01-31') });
    clock.today = '2024-04-10';
    const { result } = await rh(useProgress);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.currentCycle.startDate).toBe('2024-04-01');
  });
});
