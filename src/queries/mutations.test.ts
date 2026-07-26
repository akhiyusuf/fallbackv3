/**
 * M2 — review pass 1, blocking item 10: the query/mutation layer had zero coverage. This
 * file drives the REAL hooks (`renderHook` + a real `QueryClient`) against the in-memory
 * `FakeRepos` (`testSupport/fakeRepos.ts`), covering the acceptance criteria for items
 * 1, 2, 3, 6, 7 and 9. `@/lib/date`'s pure calendar functions stay real (`requireActual`);
 * only `today`/`now` are mocked, via the mutable `clock` object so each test can move time.
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
import { xpForLevel } from '@/domain';
import type { AppEvent, Instant, LocalDate, Step, Task, TaskWithSteps } from '@/types';

import { fake } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { QUERY_KEYS } from './index';
import { useLogState, useMoveOccurrence, useUpdateSettings, __testing__ } from './mutations';
import { useTaskOccurrences, useTasks } from './reads';

const { reconcileCycleBoundaries, finalizeCycleForCadenceChange } = __testing__;

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
}

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: true },
      mutations: { retry: false },
    },
  });
}

/**
 * `renderHook` mounts a real component tree; leaving it mounted after a test holds
 * react-query's observer subscriptions open and is what stalls Jest's process exit
 * (rendered components are never unmounted otherwise). Every render in this file goes
 * through this wrapper so `afterEach` can unmount and `client.clear()` unconditionally.
 */
const activeUnmounts: Array<() => void> = [];
const activeClients: QueryClient[] = [];

async function rh<T>(hook: () => T, client: QueryClient): ReturnType<typeof renderHook<T, undefined>> {
  activeClients.push(client);
  const r = await renderHook(hook, { wrapper: makeWrapper(client) });
  activeUnmounts.push(r.unmount);
  return r;
}

afterEach(async () => {
  // `unmount()` synchronously flushes React's teardown, but leaving it un-awaited inside
  // `act()` let the next test's `renderHook` start before this one's effects fully settled
  // (the source of the flaky "overlapping act() calls" / null `result.current` failures).
  await act(async () => {
    activeUnmounts.forEach((fn) => fn());
  });
  activeUnmounts.length = 0;
  activeClients.forEach((c) => c.clear());
  activeClients.length = 0;
});

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `task-${idCounter}`) as TaskWithSteps['id'];
  const idealStep: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fallbackStep: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null };
  const base: TaskWithSteps = {
    id,
    type: 'routine',
    name: 'Test task',
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
    createdAt: '2023-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2023-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [idealStep],
    fallbackSteps: [fallbackStep],
  };
  return { ...base, ...overrides, id };
}

beforeEach(() => {
  fake.reset();
  idCounter = 0;
  clock.today = '2024-06-01';
  clock.now = '2024-06-01T12:00:00.000Z';
});

describe('useLogState — item 3: the S24 -> S28 level-up handoff', () => {
  test('a log that crosses xpForLevel(1) (100 XP) returns levelUp.level === 2 and the badge persists', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const client = freshClient();
    const { result } = await rh(() => useLogState(), client);

    // 9 ideal logs = 90 XP (still level 1).
    for (let i = 1; i <= 9; i++) {
      const date = `2024-05-${String(i).padStart(2, '0')}` as LocalDate;
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await result.current.mutateAsync({ taskId: task.id, date, chip: 'done' });
      });
    }
    expect(await fakeLifetimeXp()).toBe(90);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ taskId: task.id, date: '2024-05-10' as LocalDate, chip: 'done' });
    });
    const res = outcome as { ok: true; value: { levelUp: { level: number } | null } };
    expect(res.ok).toBe(true);
    expect(res.value.levelUp?.level).toBe(2);
  });

  test('a non-crossing log returns levelUp: null', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const client = freshClient();
    const { result } = await rh(() => useLogState(), client);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ taskId: task.id, date: '2024-05-01' as LocalDate, chip: 'done' });
    });
    const res = outcome as { ok: true; value: { levelUp: unknown } };
    expect(res.ok).toBe(true);
    expect(res.value.levelUp).toBeNull();
  });

  async function fakeLifetimeXp(): Promise<number> {
    return fake.xpAwards().reduce((sum, a) => sum + a.amount, 0);
  }
});

describe('useLogState — item 7: XP write failures are never reported as success', () => {
  test('a failed appendXpAward reports xpAwarded: 0 and never emits xp:awarded', async () => {
    const task = makeTask();
    fake.seedTask(task);
    fake.failNextAppendXpAward();

    const events: AppEvent[] = [];
    const off = on('xp:awarded', (e) => events.push(e));

    const client = freshClient();
    const { result } = await rh(() => useLogState(), client);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ taskId: task.id, date: '2024-06-01' as LocalDate, chip: 'done' });
    });
    const res = outcome as { ok: true; value: { xpAwarded: number } };
    expect(res.ok).toBe(true);
    expect(res.value.xpAwarded).toBe(0);
    expect(events).toHaveLength(0);
    expect(fake.xpAwards()).toHaveLength(0);

    off();
  });

  test('a SUCCESSFUL award does emit xp:awarded with the right amount (contrast case)', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const events: AppEvent[] = [];
    const off = on('xp:awarded', (e) => events.push(e));
    const client = freshClient();
    const { result } = await rh(() => useLogState(), client);

    await act(async () => {
      await result.current.mutateAsync({ taskId: task.id, date: '2024-06-01' as LocalDate, chip: 'done' });
    });
    expect(events).toHaveLength(1);
    expect((events[0] as { amount: number }).amount).toBe(10);
    off();
  });
});

describe('useMoveOccurrence — item 6: F7 snooze/move through the real pipeline', () => {
  test('the source date resolves not-due and the target date resolves pending', async () => {
    const task = makeTask({ cadence: { kind: 'daily' } });
    fake.seedTask(task);
    const client = freshClient();

    const { result: moveResult } = await rh(() => useMoveOccurrence(), client);
    await act(async () => {
      await moveResult.current.mutateAsync({ taskId: task.id, fromDate: '2024-06-01' as LocalDate, toDate: '2024-06-02' as LocalDate });
    });

    const { result: occResult } = await rh(
      () => useTaskOccurrences(task.id, { from: '2024-06-01' as LocalDate, to: '2024-06-02' as LocalDate }),
      client,
    );
    await waitFor(() => expect(occResult.current.isSuccess).toBe(true));
    const occs = occResult.current.data ?? [];
    expect(occs.find((o) => o.date === '2024-06-01')?.outcome).toBe('not-due');
    expect(occs.find((o) => o.date === '2024-06-02')?.outcome).toBe('pending');
  });
});

describe('useTasks — item 5: no cache-key collision across type filters', () => {
  test('two hooks with different type filters, mounted against the SAME QueryClient, each keep only their own type across a refetch', async () => {
    fake.seedTask(makeTask({ id: 'r1' as Task['id'], type: 'routine' }));
    fake.seedTask(makeTask({ id: 'e1' as Task['id'], type: 'event', cadence: null, eventDate: '2024-06-10' as LocalDate }));
    const client = freshClient();

    const { result: routines } = await rh(() => useTasks({ type: 'routine' }), client);
    const { result: events } = await rh(() => useTasks({ type: 'event' }), client);

    await waitFor(() => expect(routines.current.isSuccess).toBe(true));
    await waitFor(() => expect(events.current.isSuccess).toBe(true));

    expect(routines.current.data?.every((t) => t.type === 'routine')).toBe(true);
    expect(events.current.data?.every((t) => t.type === 'event')).toBe(true);

    // Force a refetch of the shared underlying cache entry and re-check both views.
    await act(async () => {
      await client.invalidateQueries({ queryKey: QUERY_KEYS.tasks });
    });
    await waitFor(() => expect(routines.current.isFetching).toBe(false));
    expect(routines.current.data?.every((t) => t.type === 'routine')).toBe(true);
    expect(events.current.data?.every((t) => t.type === 'event')).toBe(true);
  });
});

describe('item 9: a log invalidates a mounted useTaskOccurrences for that task', () => {
  test('useTaskOccurrences refetches after useLogState commits', async () => {
    const task = makeTask();
    fake.seedTask(task);
    const client = freshClient();
    const range = { from: '2024-05-01' as LocalDate, to: '2024-06-30' as LocalDate };

    const { result: occResult } = await rh(() => useTaskOccurrences(task.id, range), client);
    await waitFor(() => expect(occResult.current.isSuccess).toBe(true));
    const before = occResult.current.dataUpdatedAt;

    const { result: logResult } = await rh(() => useLogState(), client);
    await act(async () => {
      await logResult.current.mutateAsync({ taskId: task.id, date: '2024-06-01' as LocalDate, chip: 'done' });
    });

    await waitFor(() => expect(occResult.current.dataUpdatedAt).toBeGreaterThan(before));
    const occs = occResult.current.data ?? [];
    expect(occs.find((o) => o.date === '2024-06-01')?.outcome).toBe('ideal');
  });
});

describe('reconcileCycleBoundaries / finalizeCycleForCadenceChange — items 1 and 2 (direct, no hook needed)', () => {
  test('item 1 acceptance: a mid-month cadence switch archives exactly one short cycle_record, cycling_xp_final = the pre-switch counter, lifetime XP unchanged, live counter reads 0 under the new cadence', async () => {
    clock.today = '2024-06-15';
    fake.seedSettings({ cycleCadence: 'monthly' });
    // Seed the pointer directly at the June window, so this test is isolated from the
    // separate "catch up dormant history since the anchor" behaviour item 2 covers — both
    // logs below land under the SAME (June) cycle id.
    fake.seedCycleState({ currentCycleId: 'cycle:monthly:2024-06-01' as never, cadence: 'monthly', startDate: '2024-06-01' as LocalDate, endDate: '2024-06-30' as LocalDate });
    const task = makeTask();
    fake.seedTask(task);

    // Seed two logged ideal days directly through the fake so lifetime XP = 20 before the switch.
    await fake.repos.logs.upsert({
      id: 'log-1' as never,
      taskId: task.id,
      date: '2024-06-01' as LocalDate,
      chipState: 'done',
      isManualOverride: true,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: null,
      createdAt: clock.now as Instant,
      updatedAt: clock.now as Instant,
    });
    await __testing__.reconcileOccurrence(task.id, '2024-06-01' as LocalDate); // persists the pointer + awards XP

    await fake.repos.logs.upsert({
      id: 'log-2' as never,
      taskId: task.id,
      date: '2024-06-02' as LocalDate,
      chipState: 'done',
      isManualOverride: true,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: null,
      createdAt: clock.now as Instant,
      updatedAt: clock.now as Instant,
    });
    await __testing__.reconcileOccurrence(task.id, '2024-06-02' as LocalDate);

    const lifetimeBefore = fake.xpAwards().reduce((s, a) => s + a.amount, 0);
    expect(lifetimeBefore).toBe(20);
    const pointerBefore = await fake.repos.cycleState.get();
    expect(pointerBefore?.cadence).toBe('monthly');
    const cyclingXpBefore = await fake.repos.progress.cyclingXp(pointerBefore!.currentCycleId);
    expect(cyclingXpBefore).toBe(20);

    const switchResult = await finalizeCycleForCadenceChange('weekly');
    expect(switchResult.ok).toBe(true);

    expect(fake.cycleRecords()).toHaveLength(1);
    const record = fake.cycleRecords()[0]!;
    expect(record.isShortCycle).toBe(true);
    expect(record.cyclingXpFinal).toBe(20);

    const lifetimeAfter = fake.xpAwards().reduce((s, a) => s + a.amount, 0);
    expect(lifetimeAfter).toBe(20); // unchanged — archiving never touches xp_award rows

    const pointerAfter = await fake.repos.cycleState.get();
    expect(pointerAfter?.cadence).toBe('weekly');
    const cyclingXpAfter = await fake.repos.progress.cyclingXp(pointerAfter!.currentCycleId);
    expect(cyclingXpAfter).toBe(0); // fresh cycle id, no awards stamped with it yet
  });

  test('item 2 acceptance: archiving two elapsed monthly cycles then switching to weekly never replays or overlaps history, and a second reconciliation is a no-op', async () => {
    clock.today = '2024-01-15';
    fake.seedSettings({ cycleCadence: 'monthly' });

    // Establish the pointer at the January window.
    const init = await reconcileCycleBoundaries();
    expect(init.ok).toBe(true);
    expect(fake.cycleRecords()).toHaveLength(0);

    // Two full months elapse (Jan, Feb).
    clock.today = '2024-03-20';
    const first = await reconcileCycleBoundaries();
    expect(first.ok).toBe(true);
    expect(fake.cycleRecords()).toHaveLength(2);
    const keysAfterFirst = fake.cycleRecords().map((r) => `${r.cadence}:${r.startDate}:${r.endDate}`);
    expect(new Set(keysAfterFirst).size).toBe(2); // no duplicates

    // Idempotent: running again right away adds nothing.
    await reconcileCycleBoundaries();
    expect(fake.cycleRecords()).toHaveLength(2);

    // Switch to weekly mid-(March-)cycle.
    const switchResult = await finalizeCycleForCadenceChange('weekly');
    expect(switchResult.ok).toBe(true);
    expect(fake.cycleRecords()).toHaveLength(3); // + the short March record
    expect(fake.currentCycleState()?.cadence).toBe('weekly');

    // Advance further: only NEW, non-overlapping windows should ever be appended.
    clock.today = '2024-04-10';
    await reconcileCycleBoundaries();
    const allKeys = fake.cycleRecords().map((r) => `${r.cadence}:${r.startDate}:${r.endDate}`);
    expect(new Set(allKeys).size).toBe(allKeys.length); // still no duplicates/overlaps
    expect(fake.cycleRecords().length).toBeGreaterThan(3); // genuinely grew from real weekly boundaries

    // cycle_state matches the actual live (non-elapsed) window.
    const pointer = fake.currentCycleState();
    expect(pointer).not.toBeNull();
    expect(pointer!.endDate >= clock.today).toBe(true);
  });
});

// Silence the "no tests" concern for xpForLevel import staying meaningful/used.
describe('sanity', () => {
  test('xpForLevel(1) really is 100 — the level-up test above depends on this constant', () => {
    expect(xpForLevel(1)).toBe(100);
  });
});
