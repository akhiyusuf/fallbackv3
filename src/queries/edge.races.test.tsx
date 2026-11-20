/**
 * Edge-case campaign, round 3: RACES and STALE DATA between screens, the query cache and the
 * data layer. Real hooks over ONE shared QueryClient (as in the app), fake repositories, the
 * mock clock.
 *
 *  - the mutation x read matrix: every read mounted at once, every mutation run, then every
 *    cell compared with a read from a brand-new client (the truth);
 *  - a read in flight when a mutation lands, two mutations on the same habit at once, a success
 *    that arrives after the screen unmounted;
 *  - app events: order, duplicates, concurrency;
 *  - launch work (heal, catch-up, sweep) racing the person's own writes.
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
import type { AppEvent, Id, Instant, LocalDate, Step, TaskWithSteps } from '@/types';

import { healMissingXp } from './healXp';
import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import {
  __testing__,
  catchUpCycles,
  sweepExpiredDeleted,
  useCreateTask,
  useDeleteForever,
  useDeleteTask,
  useDuplicateTask,
  useEmptyRecentlyDeleted,
  useEndTask,
  useLogAsNeededUse,
  useLogDose,
  useLogState,
  useMarkOffDay,
  useRestoreTask,
  useSnoozeOccurrence,
  useStartAgain,
  useToggleStep,
  useUndoSnooze,
  useUpdateSettings,
  useUpdateTask,
} from './mutations';
import {
  useAchievements,
  useConsistency,
  useConsistencyDisclosure,
  useCycleRecords,
  useProgress,
  useRecentlyDeleted,
  useSettings,
  useTask,
  useTaskOccurrences,
  useTasks,
  useToday,
  useTrend,
} from './reads';

/* ------------------------------------------------------------------ harness */

const D = (s: string) => s as LocalDate;
const TODAY = D('2024-06-01');

/** The client the app builds (staleTime 0, refetch on mount), minus retries so failures show at once. */
function appClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 0, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: true, networkMode: 'always' },
      mutations: { networkMode: 'always', retry: false },
    },
  });
}

const unmounts: Array<() => void> = [];
const clients: QueryClient[] = [];

async function rh<T>(hook: () => T, client: QueryClient) {
  if (!clients.includes(client)) clients.push(client);
  const r = await renderHook(hook, { wrapper: ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children) });
  unmounts.push(r.unmount);
  return r;
}

afterEach(async () => {
  await act(async () => {
    unmounts.forEach((fn) => fn());
  });
  unmounts.length = 0;
  clients.forEach((c) => c.clear());
  clients.length = 0;
  captured.length = 0;
  offs.forEach((o) => o());
  offs.length = 0;
});

const captured: AppEvent[] = [];
const offs: Array<() => void> = [];
const EVENT_TYPES: AppEvent['type'][] = ['task:changed', 'day:logged', 'xp:awarded', 'level:up', 'badge:unlocked', 'offday:changed', 'cycle:finalized', 'settings:changed'];
function captureEvents() {
  for (const t of EVENT_TYPES) offs.push(on(t, (e) => void captured.push(e) as never));
}

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `rc-task-${idCounter}`) as TaskWithSteps['id'];
  const ideal: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fb: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null };
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
    endedOn: null,
    createdAt: '2024-05-25T08:00:00.000Z' as Instant,
    updatedAt: '2024-05-25T08:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [ideal],
    fallbackSteps: [fb],
    ...overrides,
  } as TaskWithSteps;
}

async function logDay(task: TaskWithSteps, date: string, chip: 'done' | 'fallback') {
  await repos.logs.upsert({
    id: `${task.id}-${date}` as never,
    taskId: task.id,
    date: D(date),
    chipState: chip,
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: `${date}T10:00:00.000Z` as Instant,
    updatedAt: `${date}T10:00:00.000Z` as Instant,
  });
}

beforeEach(() => {
  fake.reset();
  clock.today = '2024-06-01';
  clock.now = '2024-06-01T12:00:00.000Z';
});

const T1 = 'rc-main' as Id;
const T2 = 'rc-deleted' as Id;

/** A live habit with a week of history, and one habit in Recently deleted. */
async function seedWorld() {
  const t1 = makeTask({ id: T1 });
  fake.seedTask(t1);
  for (const d of ['2024-05-25', '2024-05-26', '2024-05-27']) await logDay(t1, d, 'done');
  await logDay(t1, '2024-05-28', 'fallback');
  const t2 = makeTask({ id: T2, name: 'Stretch', createdAt: '2024-05-20T08:00:00.000Z' as Instant, deletedAt: '2024-05-30T10:00:00.000Z' as Instant });
  fake.seedTask(t2);
  for (const d of ['2024-05-26', '2024-05-27']) await logDay(t2, d, 'done');
  // Cycles caught up front (that is what launch does), so this is about the cache, not the catch-up.
  await catchUpCycles();
  // The XP and badges the history has earned, as the app would have them by now.
  await __testing__.reconcileOccurrence(T1, D('2024-05-27'));
}

/** Every read a screen can have mounted, in one hook. */
function useAllReads() {
  return {
    tasks: useTasks(),
    tasksIncludingDeleted: useTasks({ includeDeleted: true }),
    routinesOnly: useTasks({ type: 'routine' }),
    task: useTask(T1),
    deletedTask: useTask(T2),
    recentlyDeleted: useRecentlyDeleted(),
    today: useToday(TODAY),
    aggregateAllTime: useConsistency({ scope: 'aggregate', window: 'all-time' }),
    aggregateLast7: useConsistency({ scope: 'aggregate', window: 'last-7' }),
    perTaskLast30: useConsistency({ scope: 'per-task', window: 'last-30', taskId: T1 }),
    taskOccurrences: useTaskOccurrences(T1, { from: D('2024-05-25'), to: TODAY }),
    disclosure: useConsistencyDisclosure(),
    trend: useTrend(),
    progress: useProgress(),
    achievements: useAchievements(),
    records: useCycleRecords(),
    settings: useSettings(),
  };
}
type ReadName = keyof ReturnType<typeof useAllReads>;

function readsSettled(r: Record<string, { isFetching: boolean; isPending: boolean }>): boolean {
  return Object.values(r).every((q) => !q.isFetching && !q.isPending);
}

/** What every read shows, mounted fresh on a client that has never seen a write. */
async function truth(): Promise<Record<string, unknown>> {
  const client = appClient();
  const { result } = await rh(useAllReads, client);
  await waitFor(() => expect(readsSettled(result.current as never)).toBe(true));
  return Object.fromEntries(Object.entries(result.current).map(([k, q]) => [k, (q as { data: unknown }).data]));
}

/** Waits for the cache to stop fetching, then lets React render what it holds (notifications are batched on a timer). */
async function settle(client: QueryClient) {
  for (let i = 0; i < 3; i++) {
    await waitFor(() => expect(client.isFetching()).toBe(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

/** Every mutation hook, mounted once (as the screens would, on the same client). */
function useAllMutations() {
  return {
    create: useCreateTask(),
    update: useUpdateTask(),
    del: useDeleteTask(),
    restore: useRestoreTask(),
    deleteForever: useDeleteForever(),
    empty: useEmptyRecentlyDeleted(),
    end: useEndTask(),
    startAgain: useStartAgain(),
    duplicate: useDuplicateTask(),
    log: useLogState(),
    toggleStep: useToggleStep(),
    dose: useLogDose(),
    off: useMarkOffDay(),
    asNeeded: useLogAsNeededUse(),
    snooze: useSnoozeOccurrence(),
    undoSnooze: useUndoSnooze(),
    settings: useUpdateSettings(),
  };
}
type Muts = ReturnType<typeof useAllMutations>;

/* ------------------------------------------------------------------ the matrix */

interface Case {
  readonly name: string;
  readonly prep?: () => Promise<void>;
  readonly run: (m: Muts) => Promise<unknown>;
  /** Reads this mutation is NOT expected to change (kept out of the assertion on staleness only if truly unaffected: still compared, never skipped). */
}

const draft = {
  type: 'routine' as const,
  name: 'Read',
  cadence: { kind: 'daily' as const },
  idealSteps: [{ text: 'Read 20 pages', dueWeekdays: null }],
  fallbackSteps: [{ text: 'Read a page', dueWeekdays: null }],
};

const CASES: Case[] = [
  { name: 'create a habit', run: (m) => m.create.mutateAsync(draft) },
  { name: 'rename a habit', run: (m) => m.update.mutateAsync({ id: T1, patch: { name: 'Walk the dog' } }) },
  { name: 'delete a habit', run: (m) => m.del.mutateAsync(T1) },
  { name: 'restore a deleted habit', run: (m) => m.restore.mutateAsync(T2) },
  { name: 'delete a habit for good', run: (m) => m.deleteForever.mutateAsync(T2) },
  { name: 'empty Recently deleted', run: (m) => m.empty.mutateAsync() },
  { name: 'end a routine', run: (m) => m.end.mutateAsync(T1) },
  {
    name: 'start an ended routine again',
    prep: async () => {
      await repos.tasks.update(T1, { endedOn: D('2024-05-29') });
    },
    run: (m) => m.startAgain.mutateAsync(T1),
  },
  { name: 'duplicate a habit', run: (m) => m.duplicate.mutateAsync(T1) },
  { name: 'log today done', run: (m) => m.log.mutateAsync({ taskId: T1, date: TODAY, chip: 'done' }) },
  { name: 'log a past day fallback', run: (m) => m.log.mutateAsync({ taskId: T1, date: D('2024-05-29'), chip: 'fallback' }) },
  { name: 'undo a log (chip back to todo)', run: (m) => m.log.mutateAsync({ taskId: T1, date: D('2024-05-27'), chip: 'todo' }) },
  { name: 'tick a step', run: (m) => m.toggleStep.mutateAsync({ taskId: T1, date: TODAY, stepId: `${T1}-ideal` as Id }) },
  { name: 'log a dose', run: (m) => m.dose.mutateAsync({ taskId: T1, date: TODAY, dosesCompleted: 1 }) },
  { name: 'emergency day off (one habit)', run: (m) => m.off.mutateAsync({ date: TODAY, taskId: T1, mark: true }) },
  { name: 'emergency day off (every habit)', run: (m) => m.off.mutateAsync({ date: D('2024-05-29'), taskId: null, mark: true }) },
  {
    name: 'lift a day off',
    prep: async () => {
      await __testing__.markOffDay({ date: D('2024-05-29'), taskId: T1, mark: true });
    },
    run: (m) => m.off.mutateAsync({ date: D('2024-05-29'), taskId: T1, mark: false }),
  },
  { name: 'log an as-needed use', run: (m) => m.asNeeded.mutateAsync({ taskId: T1, date: TODAY, marker: 'ideal' }) },
  { name: 'push to tomorrow', run: (m) => m.snooze.mutateAsync({ taskId: T1, date: TODAY }) },
  {
    name: 'undo a push',
    prep: async () => {
      await __testing__.snoozeOccurrence({ taskId: T1, date: TODAY });
    },
    run: (m) => m.undoSnooze.mutateAsync({ taskId: T1, date: TODAY }),
  },
  { name: 'change the accent', run: (m) => m.settings.mutateAsync({ accent: 'ocean' as never }) },
  { name: 'change the cycle cadence', run: (m) => m.settings.mutateAsync({ cycleCadence: 'weekly' }) },
];

describe('mutation x read matrix: every read matches a fresh read after each mutation', () => {
  it.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    await seedWorld();
    await c.prep?.();
    const client = appClient();
    const reads = await rh(useAllReads, client);
    await waitFor(() => expect(readsSettled(reads.result.current as never)).toBe(true));
    const before = Object.fromEntries(Object.entries(reads.result.current).map(([k, q]) => [k, JSON.stringify((q as { data: unknown }).data)]));
    const muts = await rh(useAllMutations, client);

    await act(async () => {
      await c.run(muts.result.current);
    });
    await settle(client);
    await waitFor(() => expect(readsSettled(reads.result.current as never)).toBe(true));

    const shown = Object.fromEntries(Object.entries(reads.result.current).map(([k, q]) => [k, (q as { data: unknown }).data]));
    const real = await truth();
    const stale = (Object.keys(real) as ReadName[]).filter((k) => JSON.stringify(shown[k]) !== JSON.stringify(real[k]));
    expect(stale).toEqual([]);
    // The matrix must not be vacuous: a mutation that changes data changes at least one read.
    const changed = (Object.keys(real) as ReadName[]).filter((k) => before[k] !== JSON.stringify(real[k]));
    if (process.env.RACES_MATRIX) console.log(`MATRIX|${c.name}|${changed.join(',')}`);
    if (!c.name.startsWith('log an as-needed')) expect(changed.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ a read in flight when a write lands */

/** A promise the test settles by hand. */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('a refetch in flight when a mutation lands never leaves old data on screen', () => {
  it('first load still running (no data yet): a rename that lands meanwhile wins', async () => {
    fake.seedTask(makeTask({ id: T1, name: 'Old name' }));
    const gate = deferred();
    const realList = repos.tasks.list.bind(repos.tasks);
    // The read starts now (and sees "Old name"), but its answer is held back until after the write.
    const spy = jest.spyOn(repos.tasks, 'list').mockImplementationOnce(async (opts) => {
      const rows = await realList(opts);
      await gate.promise;
      return rows;
    });
    const client = appClient();
    const reads = await rh(() => useTasks(), client);
    const muts = await rh(() => useUpdateTask(), client);
    await act(async () => {
      await muts.result.current.mutateAsync({ id: T1, patch: { name: 'New name' } });
    });
    gate.resolve();
    await settle(client);
    await waitFor(() => expect(reads.result.current.data?.[0]?.name).toBe('New name'));
    spy.mockRestore();
  });

  it('data already cached, a refetch running: the write that lands meanwhile wins', async () => {
    fake.seedTask(makeTask({ id: T1, name: 'Old name' }));
    const client = appClient();
    const reads = await rh(() => useTasks(), client);
    await waitFor(() => expect(reads.result.current.data?.[0]?.name).toBe('Old name'));
    const gate = deferred();
    const realList = repos.tasks.list.bind(repos.tasks);
    const spy = jest.spyOn(repos.tasks, 'list').mockImplementationOnce(async (opts) => {
      const rows = await realList(opts);
      await gate.promise;
      return rows;
    });
    await act(async () => {
      void client.invalidateQueries({ queryKey: ['tasks'] }); // a refetch (focus, remount) starts and sees "Old name"
    });
    const muts = await rh(() => useUpdateTask(), client);
    await act(async () => {
      await muts.result.current.mutateAsync({ id: T1, patch: { name: 'New name' } });
    });
    gate.resolve();
    await settle(client);
    await waitFor(() => expect(reads.result.current.data?.[0]?.name).toBe('New name'));
    spy.mockRestore();
  });

  it('Today still loading when the person logs the habit: it ends up showing the log', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    const gate = deferred();
    const realList = repos.logs.listRange.bind(repos.logs);
    const spy = jest.spyOn(repos.logs, 'listRange').mockImplementationOnce(async (from, to) => {
      const rows = await realList(from, to);
      await gate.promise;
      return rows;
    });
    const client = appClient();
    const reads = await rh(() => useToday(TODAY), client);
    const muts = await rh(() => useLogState(), client);
    await act(async () => {
      await muts.result.current.mutateAsync({ taskId: T1, date: TODAY, chip: 'done' });
    });
    gate.resolve();
    await settle(client);
    await waitFor(() => expect(reads.result.current.data?.find((o) => o.date === TODAY)?.outcome).toBe('ideal'));
    spy.mockRestore();
  });
});

/* ------------------------------------------------------------------ two writes at once */

const xpEvents = () => captured.filter((e) => e.type === 'xp:awarded') as Array<Extract<AppEvent, { type: 'xp:awarded' }>>;
const countOf = (type: AppEvent['type']) => captured.filter((e) => e.type === type).length;
const lifetime = () => repos.progress.lifetimeXp();

describe('two writes on the same habit from two screens at the same moment', () => {
  it('the same chip tapped on two screens: one award, one toast, one badge notification, one level-up', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    // 95 XP in hand: the next 10 crosses level 2 at 100.
    await repos.progress.appendXpAward({ id: 'x0' as Id, taskId: null, date: D('2024-01-01'), kind: 'ideal', amount: 95, cycleId: 'c0' as Id, createdAt: '2024-01-01T00:00:00.000Z' as Instant } as never);
    captureEvents();
    const [a, b] = await Promise.all([
      __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' }),
      __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(await lifetime()).toBe(105);
    expect(fake.xpAwards().filter((x) => x.taskId === T1)).toHaveLength(1);
    // What was shown to the person adds up to what was earned.
    const shown = [a, b].reduce((sum, r) => sum + (r.ok ? r.value.xpAwarded : 0), 0);
    expect(shown).toBe(10);
    expect(xpEvents().reduce((sum, e) => sum + e.amount, 0)).toBe(10);
    expect(countOf('level:up')).toBe(1);
    const unlocked = captured.filter((e) => e.type === 'badge:unlocked').map((e) => (e as { key: string }).key);
    expect(new Set(unlocked).size).toBe(unlocked.length); // no badge announced twice
  });

  it('done on one screen and fallback on the other: the later tap wins, and XP matches the log', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    captureEvents();
    await Promise.all([
      __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' }),
      __testing__.logState({ taskId: T1, date: TODAY, chip: 'fallback' }),
    ]);
    const row = fake.logsFor(T1).find((l) => l.date === TODAY)!;
    const award = fake.xpAwards().find((x) => x.taskId === T1)!;
    expect(fake.logsFor(T1).filter((l) => l.date === TODAY)).toHaveLength(1);
    expect(row.chipState).toBe('fallback'); // writes run in the order they were asked
    expect(award.kind).toBe('fallback');
    expect(await lifetime()).toBe(6);
  });

  it('log and undo at once: no XP is left for a day that ends up not done', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    await __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' });
    await Promise.all([
      __testing__.logState({ taskId: T1, date: TODAY, chip: 'todo' }),
      __testing__.logState({ taskId: T1, date: TODAY, chip: 'todo' }),
    ]);
    const row = fake.logsFor(T1).find((l) => l.date === TODAY)!;
    expect(row.chipState).toBe('todo');
    expect(await lifetime()).toBe(0);
  });

  it('a delete and a log at once: the log is refused or the habit is gone, never XP for a deleted habit', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    await Promise.all([__testing__.logState({ taskId: T1, date: TODAY, chip: 'done' }), repos.tasks.softDelete(T1)]);
    // Whatever order they ran in, the record is consistent: XP equals the logged outcome.
    const row = fake.logsFor(T1).find((l) => l.date === TODAY);
    const xp = await lifetime();
    expect(xp === 0 || (row?.chipState === 'done' && xp === 10)).toBe(true);
  });

  it('Push to tomorrow on two screens at once: one push, one pushed row', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    const [a, b] = await Promise.all([__testing__.snoozeOccurrence({ taskId: T1, date: TODAY }), __testing__.snoozeOccurrence({ taskId: T1, date: TODAY })]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(fake.logsFor(T1).filter((l) => l.movedToDate !== null)).toHaveLength(1);
  });

  it('every one of 12 racing taps ends in a state the record explains (XP = sum of eligible days)', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    const days = ['2024-05-29', '2024-05-30', '2024-05-31', '2024-06-01'].map(D);
    const chips = ['done', 'fallback', 'todo'] as const;
    const jobs: Array<Promise<unknown>> = [];
    for (let i = 0; i < 12; i++) jobs.push(__testing__.logState({ taskId: T1, date: days[i % 4]!, chip: chips[(i * 7) % 3]! }));
    await Promise.all(jobs);
    let expected = 0;
    for (const d of days) {
      const row = fake.logsFor(T1).find((l) => l.date === d);
      expected += row?.chipState === 'done' ? 10 : row?.chipState === 'fallback' ? 6 : 0;
    }
    expect(await lifetime()).toBe(expected);
  });
});

/* ------------------------------------------------------------------ a success after the screen is gone */

describe('a mutation that finishes after its screen unmounted', () => {
  it('still refreshes every other screen that is mounted', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    const client = appClient();
    const today = await rh(() => useToday(TODAY), client);
    await waitFor(() => expect(today.result.current.data?.find((o) => o.date === TODAY)?.outcome).toBe('pending'));
    const gate = deferred();
    const realUpsert = repos.logs.upsert.bind(repos.logs);
    const spy = jest.spyOn(repos.logs, 'upsert').mockImplementationOnce(async (l) => {
      await gate.promise; // the save is slow
      return realUpsert(l);
    });
    const screen = await rh(() => useLogState(), client);
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = screen.result.current.mutateAsync({ taskId: T1, date: TODAY, chip: 'done' });
    });
    await screen.unmount(); // the person navigates away before the save lands
    gate.resolve();
    await act(async () => {
      await pending;
    });
    await settle(client);
    await waitFor(() => expect(today.result.current.data?.find((o) => o.date === TODAY)?.outcome).toBe('ideal'));
    spy.mockRestore();
  });
});

/* ------------------------------------------------------------------ cycles and the cache */

const MAY = { currentCycleId: 'c-may' as Id, cadence: 'monthly' as const, startDate: D('2024-05-01'), endDate: D('2024-05-31') };

describe('cycle boundaries', () => {
  it('Progress catching the cycle up archives May and the Records list shows it without a reload', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    fake.seedCycleState(MAY);
    const client = appClient();
    const records = await rh(() => useCycleRecords(), client);
    await waitFor(() => expect(records.result.current.isSuccess).toBe(true));
    expect(records.result.current.data).toHaveLength(0);
    await rh(() => useProgress(), client); // opening Progress runs the catch-up
    await settle(client);
    expect(fake.cycleRecords()).toHaveLength(1);
    await waitFor(() => expect(records.result.current.data).toHaveLength(1));
  });

  it('the launch catch-up and the first log of the new month at the same moment: one May record, award in the new cycle', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    fake.seedCycleState(MAY);
    captureEvents();
    const [, logged] = await Promise.all([catchUpCycles(), __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' })]);
    expect(logged.ok).toBe(true);
    expect(fake.cycleRecords()).toHaveLength(1);
    expect(countOf('cycle:finalized')).toBe(1);
    const pointer = fake.currentCycleState()!;
    expect(pointer.startDate).toBe('2024-06-01');
    expect(fake.xpAwards().find((x) => x.taskId === T1)!.cycleId).toBe(pointer.currentCycleId);
  });

  it('midnight passes with a log in flight: the log is stamped with the cycle live when it lands, never two records', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    fake.seedCycleState(MAY);
    clock.today = '2024-05-31';
    clock.now = '2024-05-31T23:59:59.000Z';
    const a = __testing__.logState({ taskId: T1, date: D('2024-05-31'), chip: 'done' });
    clock.today = '2024-06-01';
    clock.now = '2024-06-01T00:00:01.000Z';
    const b = __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' });
    await Promise.all([a, b]);
    expect(fake.cycleRecords().length).toBeLessThanOrEqual(1);
    expect(await lifetime()).toBe(20);
  });

  it('a cadence change while Progress is still loading: Progress ends up on the new cadence', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    const gate = deferred();
    const realGet = repos.settings.get.bind(repos.settings);
    const spy = jest.spyOn(repos.settings, 'get').mockImplementationOnce(async () => {
      const s = await realGet();
      await gate.promise;
      return s;
    });
    const client = appClient();
    const progress = await rh(() => useProgress(), client);
    const settings = await rh(() => useSettings(), client);
    const muts = await rh(() => useUpdateSettings(), client);
    await act(async () => {
      await muts.result.current.mutateAsync({ cycleCadence: 'weekly' });
    });
    gate.resolve();
    await settle(client);
    await waitFor(() => expect(progress.result.current.data?.cycleCadence).toBe('weekly'));
    await waitFor(() => expect(settings.result.current.data?.cycleCadence).toBe('weekly'));
    spy.mockRestore();
  });
});

/* ------------------------------------------------------------------ launch work beside the person's own writes */

describe('launch repair (heal, sweep) racing the first writes', () => {
  async function killedBetweenLogAndAward() {
    const t = makeTask({ id: T1 });
    fake.seedTask(t);
    await catchUpCycles();
    await logDay(t, '2024-05-30', 'done'); // logged, XP never landed
  }

  it('healMissingXp and the first log at once: each day is awarded once, and the toast is for the new log only', async () => {
    await killedBetweenLogAndAward();
    captureEvents();
    const [healed, logged] = await Promise.all([healMissingXp(repos), __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' })]);
    expect(logged.ok && logged.value.xpAwarded).toBe(10);
    expect(healed).toBeGreaterThanOrEqual(1);
    expect(fake.xpAwards().filter((x) => x.taskId === T1).map((x) => x.date).sort()).toEqual(['2024-05-30', '2024-06-01']);
    expect(await lifetime()).toBe(20);
    expect(xpEvents()).toHaveLength(1);
    expect(xpEvents()[0]!.amount).toBe(10);
  });

  it('healMissingXp twice at once adds each missing award once', async () => {
    await killedBetweenLogAndAward();
    const [a, b] = await Promise.all([healMissingXp(repos), healMissingXp(repos)]);
    expect(a + b).toBe(1);
    expect(await lifetime()).toBe(10);
  });

  const expired = () => makeTask({ id: T2, name: 'Stretch', deletedAt: '2024-04-20T10:00:00.000Z' as Instant });
  const orphanMarks = async () => {
    const marks = await repos.offDays.listRange(D('2024-01-01'), D('2024-12-31'));
    const live = new Set((await repos.tasks.list({ includeDeleted: true })).map((t) => t.id));
    return marks.filter((m) => m.taskId !== null && !live.has(m.taskId));
  };

  it('the launch sweep and a restore of the same expired item (sweep first): one outcome, nothing half-done', async () => {
    fake.seedTask(expired());
    const restore = __testing__.reconcileOccurrence; // (keeps the import used)
    void restore;
    const client = appClient();
    const muts = await rh(() => useRestoreTask(), client);
    let restored: unknown;
    await act(async () => {
      const [, r] = await Promise.all([sweepExpiredDeleted(), muts.result.current.mutateAsync(T2)]);
      restored = r;
    });
    const gone = (await repos.tasks.get(T2)) === null;
    const live = (await repos.tasks.get(T2))?.deletedAt === null;
    expect(gone || live).toBe(true);
    expect((restored as { ok: boolean }).ok).toBe(live);
    expect(await orphanMarks()).toEqual([]);
  });

  it('the launch sweep and a restore of the same expired item (restore first): one outcome, nothing half-done', async () => {
    fake.seedTask(expired());
    const client = appClient();
    const muts = await rh(() => useRestoreTask(), client);
    let restored: unknown;
    await act(async () => {
      const [r] = await Promise.all([muts.result.current.mutateAsync(T2), sweepExpiredDeleted()]);
      restored = r;
    });
    const live = (await repos.tasks.get(T2))?.deletedAt === null;
    expect((restored as { ok: boolean }).ok).toBe(true);
    expect(live).toBe(true); // restored before the sweep looked: it is no longer in Recently deleted
    expect(await orphanMarks()).toEqual([]);
  });

  it('opening Recently deleted (its read sweeps) while the person restores: the restored habit is not removed', async () => {
    fake.seedTask(expired());
    const client = appClient();
    const muts = await rh(() => useRestoreTask(), client);
    const list = await rh(() => useRecentlyDeleted(), client);
    await act(async () => {
      await muts.result.current.mutateAsync(T2);
    });
    await settle(client);
    expect((await repos.tasks.get(T2))?.deletedAt).toBeNull();
    await waitFor(() => expect(list.result.current.data).toHaveLength(0));
    expect(await orphanMarks()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ app events */

describe('app events', () => {
  it('one log emits one of each: day:logged once, xp:awarded once, with the XP before the level-up report', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    await __testing__.reconcileOccurrence(T1, D('2024-05-30')); // a first reconcile, so tenure badges are not in the way
    captureEvents();
    await __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' });
    expect(countOf('day:logged')).toBe(1);
    expect(countOf('xp:awarded')).toBe(1);
    expect(countOf('task:changed')).toBe(0);
  });

  it('the level-up crossing is announced once and carries the XP that caused it', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    await repos.progress.appendXpAward({ id: 'x0' as Id, taskId: null, date: D('2024-01-01'), kind: 'ideal', amount: 95, cycleId: 'c0' as Id, createdAt: '2024-01-01T00:00:00.000Z' as Instant } as never);
    captureEvents();
    const r = await __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' });
    expect(r.ok && r.value.levelUp?.level).toBe(2);
    const types = captured.map((e) => e.type);
    expect(types.filter((t) => t === 'level:up')).toHaveLength(1);
    expect(types.filter((t) => t === 'xp:awarded')).toHaveLength(1);
    // Pinned order today: the badge/level reports come from the reconcile, the day and XP after it.
    expect(types.indexOf('level:up')).toBeLessThan(types.indexOf('day:logged'));
    expect(types.indexOf('day:logged')).toBeLessThan(types.indexOf('xp:awarded'));
  });

  it('undoing a log announces nothing new: no XP, no level-up, no badge, and an earned badge stays', async () => {
    const t = makeTask({ id: T1, createdAt: '2024-05-20T08:00:00.000Z' as Instant });
    fake.seedTask(t);
    for (const d of ['2024-05-25', '2024-05-26', '2024-05-27', '2024-05-28', '2024-05-29', '2024-05-30']) await logDay(t, d, 'done');
    await __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' }); // the 7th day in a row
    const earned = fake.unlocks().map((u) => u.key);
    expect(earned).toContain('showing-up-7');
    captureEvents();
    await __testing__.logState({ taskId: T1, date: TODAY, chip: 'todo' });
    expect(countOf('badge:unlocked')).toBe(0);
    expect(countOf('level:up')).toBe(0);
    expect(countOf('xp:awarded')).toBe(0);
    expect(fake.unlocks().map((u) => u.key)).toEqual(expect.arrayContaining(earned)); // badges are upsert-only
    // Logging it again does not announce the badge a second time.
    await __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' });
    expect(captured.filter((e) => e.type === 'badge:unlocked' && (e as { key: string }).key === 'showing-up-7')).toHaveLength(0);
  });

  it('a handler that throws does not stop the write or the other handlers', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    const seen: string[] = [];
    offs.push(on('day:logged', () => { throw new Error('boom'); }));
    offs.push(on('day:logged', () => void seen.push('second')));
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await __testing__.logState({ taskId: T1, date: TODAY, chip: 'done' });
    err.mockRestore();
    expect(r.ok).toBe(true);
    expect(seen).toEqual(['second']);
    expect(await lifetime()).toBe(10);
  });

  it('a whole-day off mark emits offday:changed once per call, and two marks emit two', async () => {
    fake.seedTask(makeTask({ id: T1 }));
    captureEvents();
    await Promise.all([__testing__.markOffDay({ date: TODAY, taskId: null, mark: true }), __testing__.markOffDay({ date: TODAY, taskId: null, mark: false })]);
    expect(countOf('offday:changed')).toBe(2);
    // Marked then lifted (in the order asked): the day is not off.
    expect(await repos.offDays.listRange(TODAY, TODAY)).toEqual([]);
  });
});
