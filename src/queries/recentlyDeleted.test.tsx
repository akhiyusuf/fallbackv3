/**
 * Recently deleted, through the REAL query hooks against the in-memory FakeRepos (whose
 * softDelete/restore/deleteForever/purgeDeleted/duplicate now mirror taskRepository). The clock
 * is the mutable `clock` from testSupport, so every test can place "now" exactly.
 *
 * Covers: the purge-before-list read, delete/restore/delete-forever/empty edge cases, XP never
 * moving, a restored task resolving exactly as before (including a pushed occurrence), what
 * reads show while an item is deleted, and writes aimed at a deleted task (refused).
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
import type { AppEvent, Instant, LocalDate, Step, TaskWithSteps } from '@/types';

import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import {
  useDeleteForever,
  useDeleteTask,
  useDuplicateTask,
  useEmptyRecentlyDeleted,
  useLogAsNeededUse,
  useLogDose,
  useLogState,
  useMarkOffDay,
  useRestoreTask,
  useSnoozeOccurrence,
  useToggleStep,
  useUndoSnooze,
  useUpdateTask,
} from './mutations';
import { useAchievements, useConsistency, useRecentlyDeleted, useTask, useTaskOccurrences, useTasks, useToday } from './reads';

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

/** Seeds a live task with a few days of history, and an XP award for each shown-up day. */
function seedWithHistory(name = 'Walk'): TaskWithSteps {
  const task = makeTask({ name });
  fake.seedTask(task);
  const awardDays: Array<[LocalDate, 'ideal' | 'fallback']> = [
    ['2024-05-28' as LocalDate, 'ideal'],
    ['2024-05-29' as LocalDate, 'fallback'],
  ];
  for (const [date, kind] of awardDays) {
    void repos.progress.appendXpAward({
      id: `${task.id}-${date}` as never,
      taskId: task.id,
      date,
      kind,
      amount: kind === 'ideal' ? 10 : 6,
      cycleId: 'cycle-1' as never,
      createdAt: '2024-05-29T10:00:00.000Z' as Instant,
    });
  }
  void repos.logs.upsert({
    id: `${task.id}-log-28` as never,
    taskId: task.id,
    date: '2024-05-28' as LocalDate,
    chipState: 'done',
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: '2024-05-28T10:00:00.000Z' as Instant,
    updatedAt: '2024-05-28T10:00:00.000Z' as Instant,
  });
  return task;
}

const INTERESTING_RANGE = { from: '2024-05-27' as LocalDate, to: '2024-06-03' as LocalDate };

/* ------------------------------------------------------------------ 7. the purge-then-list read */

describe('useRecentlyDeleted: expired items go before the list is read', () => {
  it('lists the rest newest deletion first, and removes what is past its 30 days first', async () => {
    clock.now = '2024-06-01T12:00:00.000Z';
    const old = makeTask({ id: 'old' as never, name: 'old' });
    const mid = makeTask({ id: 'mid' as never, name: 'mid' });
    const recent = makeTask({ id: 'recent' as never, name: 'recent' });
    fake.seedTask(old);
    fake.seedTask(mid);
    fake.seedTask(recent);
    clock.now = '2024-04-01T12:00:00.000Z';
    await mutate(useDeleteTask, old.id);
    clock.now = '2024-05-05T12:00:00.000Z';
    await mutate(useDeleteTask, mid.id);
    clock.now = '2024-05-20T12:00:00.000Z';
    await mutate(useDeleteTask, recent.id);
    clock.now = '2024-06-01T12:00:00.000Z';

    const list = await readNow(useRecentlyDeleted);
    expect(list.map((t) => t.name)).toEqual(['recent', 'mid']);
    expect(await repos.tasks.get(old.id)).toBeNull();
  });

  it('keeps an item deleted exactly 30 days ago (the sweep is strictly "before the cutoff")', async () => {
    const task = makeTask({ id: 'edge' as never, name: 'edge' });
    fake.seedTask(task);
    clock.now = '2024-05-02T12:00:00.000Z';
    await mutate(useDeleteTask, task.id);
    clock.now = '2024-06-01T12:00:00.000Z';
    const list = await readNow(useRecentlyDeleted);
    expect(list.map((t) => t.id)).toEqual([task.id]);
  });

  it('is an empty list when nothing is deleted', async () => {
    fake.seedTask(makeTask());
    expect(await readNow(useRecentlyDeleted)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ 3. the mutations on wrong items */

describe('delete, restore, delete for good and empty: edge cases through the hooks', () => {
  it('useDeleteTask hides the item everywhere, announces the change, and the item is in Recently deleted', async () => {
    const task = seedWithHistory();
    const events: AppEvent[] = [];
    const off = on('task:changed', (e) => events.push(e));
    const result = await mutate(useDeleteTask, task.id);
    off();
    expect(result).toEqual({ ok: true, value: undefined });
    expect(events).toEqual([{ type: 'task:changed', taskId: task.id }]);
    expect(await readNow(useTasks)).toEqual([]);
    expect((await readNow(useRecentlyDeleted)).map((t) => t.id)).toEqual([task.id]);
  });

  it('useDeleteTask on an already-deleted item: refused, and its deletion time is not restarted', async () => {
    const task = seedWithHistory();
    clock.now = '2024-06-01T12:00:00.000Z';
    await mutate(useDeleteTask, task.id);
    const first = (await repos.tasks.get(task.id))!.deletedAt;
    clock.now = '2024-06-10T12:00:00.000Z';
    const again = await mutate(useDeleteTask, task.id);
    expect(again).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await repos.tasks.get(task.id))!.deletedAt).toBe(first);
  });

  it('useRestoreTask on a live item: refused, no change event', async () => {
    const task = seedWithHistory();
    const events: AppEvent[] = [];
    const off = on('task:changed', (e) => events.push(e));
    const result = await mutate(useRestoreTask, task.id);
    off();
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(events).toEqual([]);
    expect((await readNow(useTasks)).map((t) => t.id)).toEqual([task.id]);
  });

  it('useDeleteForever on a live item: refused, nothing removed', async () => {
    const task = seedWithHistory();
    const result = await mutate(useDeleteForever, task.id);
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await repos.tasks.get(task.id)).not.toBeNull();
  });

  it('useDeleteForever twice: the second is refused', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    expect((await mutate(useDeleteForever, task.id)).ok).toBe(true);
    expect(await mutate(useDeleteForever, task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('useDeleteForever on an unknown id: refused', async () => {
    expect(await mutate(useDeleteForever, 'nope' as never)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await mutate(useRestoreTask, 'nope' as never)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('useEmptyRecentlyDeleted with nothing deleted returns 0; with two deleted it removes both and returns 2, leaving live items', async () => {
    const live = seedWithHistory('live');
    expect(await mutate(useEmptyRecentlyDeleted, undefined)).toEqual({ ok: true, value: 0 });

    const a = seedWithHistory('a');
    const b = seedWithHistory('b');
    await mutate(useDeleteTask, a.id);
    await mutate(useDeleteTask, b.id);
    expect(await mutate(useEmptyRecentlyDeleted, undefined)).toEqual({ ok: true, value: 2 });
    expect((await readNow(useTasks)).map((t) => t.id)).toEqual([live.id]);
    expect(await readNow(useRecentlyDeleted)).toEqual([]);
  });

  it('restore after the purge window has been emptied: refused, and nothing comes back', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    await mutate(useEmptyRecentlyDeleted, undefined);
    expect(await mutate(useRestoreTask, task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await readNow(useTasks)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ XP never moves */

describe('XP is never retracted by delete, restore or delete for good', () => {
  it('lifetime XP and the award rows are identical after each step', async () => {
    const task = seedWithHistory();
    const xpBefore = await repos.progress.lifetimeXp();
    const awardsBefore = fake.xpAwards();
    expect(xpBefore).toBe(16);

    await mutate(useDeleteTask, task.id);
    expect(await repos.progress.lifetimeXp()).toBe(xpBefore);
    await mutate(useRestoreTask, task.id);
    expect(await repos.progress.lifetimeXp()).toBe(xpBefore);
    await mutate(useDeleteTask, task.id);
    await mutate(useDeleteForever, task.id);
    expect(await repos.progress.lifetimeXp()).toBe(xpBefore);
    expect(fake.xpAwards()).toEqual(awardsBefore);
  });
});

/* ------------------------------------------------------------------ 4. the round trip, through the reads */

describe('a restored item resolves exactly as it did before deletion', () => {
  it('a task pushed to tomorrow before deletion keeps its pushed occurrence after restore', async () => {
    clock.today = '2024-06-01';
    const task = seedWithHistory();
    // Snooze yesterday's occurrence to today (its own row keeps movedToDate; the visitor shows today).
    const snoozed = await mutate(useSnoozeOccurrence, { taskId: task.id, date: '2024-05-31' as LocalDate });
    expect(snoozed.ok).toBe(true);

    const before = await readNow(() => useTaskOccurrences(task.id, INTERESTING_RANGE));
    const todayBefore = await readNow(() => useToday('2024-06-01' as LocalDate));

    await mutate(useDeleteTask, task.id);
    await mutate(useRestoreTask, task.id);

    expect(await readNow(() => useTaskOccurrences(task.id, INTERESTING_RANGE))).toEqual(before);
    expect(await readNow(() => useToday('2024-06-01' as LocalDate))).toEqual(todayBefore);
    expect(before.some((o) => o.date === '2024-06-01' && o.pushedFrom === '2024-05-31')).toBe(true);
  });

  it('consistency (per-task and aggregate) and today come back as they were after a delete / restore round trip', async () => {
    const task = seedWithHistory();
    const other = seedWithHistory('other');
    const aggregateBefore = await readNow(() => useConsistency({ scope: 'aggregate', window: 'all-time' }));
    const perTaskBefore = await readNow(() => useConsistency({ scope: 'per-task', window: 'all-time', taskId: task.id }));

    await mutate(useDeleteTask, task.id);
    await mutate(useRestoreTask, task.id);

    expect(await readNow(() => useConsistency({ scope: 'aggregate', window: 'all-time' }))).toEqual(aggregateBefore);
    expect(await readNow(() => useConsistency({ scope: 'per-task', window: 'all-time', taskId: task.id }))).toEqual(perTaskBefore);
    expect((await readNow(useTasks)).map((t) => t.id).sort()).toEqual([task.id, other.id].sort());
  });

  it('priorities survive the round trip (priority rank is kept on restore)', async () => {
    const task = makeTask({ name: 'ranked', priorityRank: 2 } as never);
    fake.seedTask(task);
    await mutate(useDeleteTask, task.id);
    await mutate(useRestoreTask, task.id);
    const restored = await readNow(() => useTask(task.id));
    expect(restored!.priorityRank).toBe(2);
  });

  it('a task deleted and restored many times keeps its history and can be logged again afterwards', async () => {
    const task = seedWithHistory();
    for (let i = 0; i < 5; i += 1) {
      await mutate(useDeleteTask, task.id);
      await mutate(useRestoreTask, task.id);
    }
    expect(fake.logsFor(task.id)).toHaveLength(1);
    const logged = await mutate(useLogState, { taskId: task.id, date: '2024-06-01' as LocalDate, chip: 'done' });
    expect(logged.ok).toBe(true);
  });

  it('delete, restore, then edit: the edit lands and the history is still there', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    await mutate(useRestoreTask, task.id);
    const edited = await mutate(useUpdateTask, { id: task.id, patch: { name: 'Long walk' } });
    expect(edited.ok).toBe(true);
    expect((await readNow(() => useTask(task.id)))!.name).toBe('Long walk');
    expect(fake.logsFor(task.id)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ 5. while deleted */

describe('while an item is in Recently deleted, the live reads leave it out', () => {
  it('useToday and useTasks leave it out; aggregate consistency keeps its past days', async () => {
    const task = makeTask({ id: 'gone' as never, name: 'gone' });
    const kept = makeTask({ id: 'kept' as never, name: 'kept' });
    fake.seedTask(task);
    fake.seedTask(kept);
    // useToday returns every occurrence up to the date; the screen shows the ones dated today.
    const onToday = async () =>
      (await readNow(() => useToday('2024-06-01' as LocalDate)))
        .filter((o) => o.date === '2024-06-01')
        .map((o) => o.taskId)
        .sort();
    expect(await onToday()).toEqual(['gone', 'kept']);
    const before = await readNow(() => useConsistency({ scope: 'aggregate', window: 'all-time' }));

    await mutate(useDeleteTask, task.id);

    expect(await onToday()).toEqual(['kept']);
    expect((await readNow(useTasks)).map((t) => t.id)).toEqual(['kept']);
    // Deleting stops a habit; it does not rewrite the past. The record is what it was (today,
    // still open when it was deleted, was never counted either way).
    const after = await readNow(() => useConsistency({ scope: 'aggregate', window: 'all-time' }));
    expect(after).toEqual(before);
  });

  it('achievements already earned stay earned while an item is deleted, and come back unchanged after restore', async () => {
    const task = seedWithHistory();
    await repos.progress.upsertUnlock({ key: 'first-day', unlockedOn: '2024-05-28' as LocalDate, createdAt: '2024-05-28T10:00:00.000Z' as Instant });
    const keysOf = (list: Array<{ key: string }>) => list.map((u) => u.key).sort();
    const before = keysOf(await readNow(useAchievements));
    expect(before).toContain('first-day');

    await mutate(useDeleteTask, task.id);
    expect(keysOf(await readNow(useAchievements))).toEqual(before);
    await mutate(useRestoreTask, task.id);
    expect(keysOf(await readNow(useAchievements))).toEqual(before);
  });

  it('useTask still returns the deleted item (documented): a screen must check deletedAt before acting on it', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const seen = await readNow(() => useTask(task.id));
    expect(seen).not.toBeNull();
    expect(seen!.deletedAt).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ 8. writes aimed at a deleted item */

describe('writes aimed at a task in Recently deleted are refused and write nothing', () => {
  it('logging a state (useLogState) is refused: no day log, no XP', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const xpBefore = await repos.progress.lifetimeXp();
    const logsBefore = fake.logsFor(task.id).length;

    const result = await mutate(useLogState, { taskId: task.id, date: '2024-06-01' as LocalDate, chip: 'done' });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(fake.logsFor(task.id)).toHaveLength(logsBefore);
    expect(await repos.progress.lifetimeXp()).toBe(xpBefore);
  });

  it('toggling a step (useToggleStep) is refused: no day log, no XP', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const xpBefore = await repos.progress.lifetimeXp();
    const result = await mutate(useToggleStep, { taskId: task.id, date: '2024-06-01' as LocalDate, stepId: `${task.id}-ideal` as never });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(fake.logsFor(task.id)).toHaveLength(1);
    expect(await repos.progress.lifetimeXp()).toBe(xpBefore);
  });

  it('logging a dose (useLogDose) is refused', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const result = await mutate(useLogDose, { taskId: task.id, date: '2024-06-01' as LocalDate, dosesCompleted: 1 });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(fake.logsFor(task.id)).toHaveLength(1);
  });

  it('snoozing an occurrence (useSnoozeOccurrence) is refused and undo (useUndoSnooze) is refused', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    expect(await mutate(useSnoozeOccurrence, { taskId: task.id, date: '2024-05-31' as LocalDate })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(await mutate(useUndoSnooze, { taskId: task.id, date: '2024-05-28' as LocalDate })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(fake.logsFor(task.id).every((l) => l.movedToDate === null)).toBe(true);
  });

  it('marking or unmarking an off day for it (useMarkOffDay) is refused', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const result = await mutate(useMarkOffDay, { date: '2024-06-01' as LocalDate, taskId: task.id, mark: true });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('logging an as-needed use (useLogAsNeededUse) is refused', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const result = await mutate(useLogAsNeededUse, { taskId: task.id, date: '2024-06-01' as LocalDate, marker: 'fallback' });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await repos.asNeeded.listForTask(task.id)).toEqual([]);
  });

  it('editing it (useUpdateTask) is refused and its name does not change', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const result = await mutate(useUpdateTask, { id: task.id, patch: { name: 'Changed while deleted' } });
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await repos.tasks.get(task.id))!.name).toBe('Walk');
  });

  it('duplicating it (useDuplicateTask) is refused and no copy appears', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    const before = (await repos.tasks.list({ includeDeleted: true })).length;
    const result = await mutate(useDuplicateTask, task.id);
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await repos.tasks.list({ includeDeleted: true })).length).toBe(before);
  });

  it('once restored, the same writes work again', async () => {
    const task = seedWithHistory();
    await mutate(useDeleteTask, task.id);
    await mutate(useRestoreTask, task.id);
    expect((await mutate(useLogState, { taskId: task.id, date: '2024-06-01' as LocalDate, chip: 'done' })).ok).toBe(true);
    expect((await mutate(useUpdateTask, { id: task.id, patch: { name: 'Back' } })).ok).toBe(true);
    expect((await mutate(useDuplicateTask, task.id)).ok).toBe(true);
  });
});

