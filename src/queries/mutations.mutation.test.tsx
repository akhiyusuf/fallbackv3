/**
 * Mutation-testing survivors for `mutations.ts` (review/sonnet/32-mutation-testing.md). Each test
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

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { CycleWindow, DayLog, Id, Instant, LocalDate, Step, TaskDraft, TaskWithSteps } from '@/types';

import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { __testing__, useCreateTask, useDeleteForever, useDeleteTask, useEndTask, useRestoreTask } from './mutations';

const d = (s: string) => s as LocalDate;

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: false },
    },
  });
}

const activeUnmounts: Array<() => void> = [];
const activeClients: QueryClient[] = [];

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
  const client = freshClient();
  activeClients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
  const { result, unmount } = await renderHook(useHook, { wrapper });
  activeUnmounts.push(unmount);
  let out!: TRes;
  await act(async () => {
    out = await result.current.mutateAsync(arg);
  });
  return out;
}

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `mm-task-${idCounter}`) as TaskWithSteps['id'];
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

const monthlyState = (start: string, end: string) => ({
  currentCycleId: `cycle:monthly:${start}` as Id,
  cadence: 'monthly' as const,
  startDate: d(start),
  endDate: d(end),
});

describe('mutations.ts mutation survivors: XP and cycles', () => {
  test('M08: re-affirming an earned day keeps the cycle its award was first stamped with', async () => {
    clock.today = '2024-06-05';
    clock.now = '2024-06-05T12:00:00.000Z';
    fake.seedCycleState(monthlyState('2024-06-01', '2024-06-30'));
    const task = makeTask();
    fake.seedTask(task);
    await repos.progress.appendXpAward({
      id: 'award-old' as Id,
      taskId: task.id,
      date: d('2024-05-30'),
      kind: 'ideal',
      amount: 10,
      cycleId: 'cycle:monthly:2024-05-01' as Id,
      createdAt: '2024-05-30T12:00:00.000Z' as Instant,
    });
    const r = await __testing__.logState({ taskId: task.id, date: d('2024-05-30'), chip: 'done' });
    expect(r.ok).toBe(true);
    const award = fake.xpAwards().find((a) => a.taskId === task.id && a.date === '2024-05-30');
    expect(award?.cycleId).toBe('cycle:monthly:2024-05-01');
  });

  test('M12: a short record and a full record for the same window are two records, not one', async () => {
    clock.today = '2024-06-05';
    const w: CycleWindow = { id: 'cycle:monthly:2024-05-01' as Id, cadence: 'monthly', startDate: d('2024-05-01'), endDate: d('2024-05-31') };
    const short = await __testing__.archiveCycleWindow(w, d('2024-05-15'), true);
    const full = await __testing__.archiveCycleWindow(w, d('2024-05-31'), false);
    expect(short.ok && full.ok).toBe(true);
    expect(fake.cycleRecords()).toHaveLength(2);
    expect(fake.cycleRecords().map((r) => r.endDate)).toEqual(['2024-05-15', '2024-05-31']);
    // The same window archived again is found, not duplicated.
    await __testing__.archiveCycleWindow(w, d('2024-05-31'), false);
    expect(fake.cycleRecords()).toHaveLength(2);
  });

  test('M14: a badge unlocked on the very last day of a cycle belongs to that cycle (both edges are inclusive)', async () => {
    clock.today = '2024-06-05';
    const at = '2024-06-05T12:00:00.000Z' as Instant;
    await repos.progress.upsertUnlock({ key: 'showing-up-7', unlockedOn: d('2024-05-31'), createdAt: at });
    await repos.progress.upsertUnlock({ key: 'showing-up-30', unlockedOn: d('2024-05-01'), createdAt: at });
    await repos.progress.upsertUnlock({ key: 'showing-up-50', unlockedOn: d('2024-06-01'), createdAt: at });
    await repos.progress.upsertUnlock({ key: 'showing-up-200', unlockedOn: d('2024-04-30'), createdAt: at });
    const w: CycleWindow = { id: 'cycle:monthly:2024-05-01' as Id, cadence: 'monthly', startDate: d('2024-05-01'), endDate: d('2024-05-31') };
    await __testing__.archiveCycleWindow(w, d('2024-05-31'), false);
    expect([...(fake.cycleRecords()[0]?.badgeKeysUnlocked ?? [])].sort()).toEqual(['showing-up-30', 'showing-up-7']);
  });

  test('M15: when the cycle pointer cannot be saved, nothing is archived against it', async () => {
    clock.today = '2024-06-05';
    fake.seedSettings({ tenureAnchorDate: d('2024-01-01'), cycleCadence: 'monthly' });
    fake.failNextCycleStateSet();
    const r = await __testing__.reconcileCycleBoundaries();
    expect(r.ok).toBe(true);
    expect(fake.cycleRecords()).toHaveLength(0);
    expect(fake.currentCycleState()).toBeNull();
  });

  test('M20: a store with no cycle pointer starts its first cycle exactly on the tenure anchor day', async () => {
    fake.seedSettings({ tenureAnchorDate: d('2024-05-15'), cycleCadence: 'monthly' });
    const { state, persisted } = await __testing__.getOrInitCycleState(fake.currentSettings());
    expect(persisted).toBe(true);
    expect(state.startDate).toBe('2024-05-15');
    expect(state.endDate).toBe('2024-05-31');
    expect(fake.currentCycleState()?.startDate).toBe('2024-05-15');
  });

  test('M17 + M46: changing the cycle cadence the day after a cycle began archives that one-day cycle as short', async () => {
    clock.today = '2024-06-02';
    clock.now = '2024-06-02T12:00:00.000Z';
    fake.seedCycleState(monthlyState('2024-06-01', '2024-06-30'));
    const r = await __testing__.updateSettings({ cycleCadence: 'weekly' });
    expect(r.ok).toBe(true);
    expect(fake.cycleRecords()).toHaveLength(1);
    expect(fake.cycleRecords()[0]).toMatchObject({ cadence: 'monthly', startDate: '2024-06-01', endDate: '2024-06-01', isShortCycle: true });
    expect(fake.currentCycleState()).toMatchObject({ cadence: 'weekly', startDate: '2024-06-02' });
    expect(fake.currentSettings().cycleCadence).toBe('weekly');
  });

  test('M17b: changing the cadence on the first day of a cycle archives nothing (zero elapsed days)', async () => {
    clock.today = '2024-06-01';
    fake.seedCycleState(monthlyState('2024-06-01', '2024-06-30'));
    await __testing__.updateSettings({ cycleCadence: 'weekly' });
    expect(fake.cycleRecords()).toHaveLength(0);
    expect(fake.currentCycleState()).toMatchObject({ cadence: 'weekly', startDate: '2024-06-01' });
  });
});

describe('mutations.ts mutation survivors: task lifecycle', () => {
  test('M21: an invalid draft is refused and nothing is saved', async () => {
    const draft: TaskDraft = {
      type: 'routine',
      name: '   ',
      cadence: { kind: 'daily' },
      idealSteps: [{ text: 'Read', dueWeekdays: null }],
      fallbackSteps: [{ text: 'Skim', dueWeekdays: null }],
    };
    const r = await mutate(useCreateTask, draft);
    expect(r.ok).toBe(false);
    expect(await repos.tasks.list({ includeDeleted: true })).toHaveLength(0);
  });

  test('M22: deleting a habit first saves the badges it earned, so they are not taken back', async () => {
    const task = makeTask();
    fake.seedTask(task);
    for (const day of ['2024-05-25', '2024-05-26', '2024-05-27', '2024-05-28', '2024-05-29', '2024-05-30', '2024-05-31']) await logDay(task, day);
    expect(fake.unlocks().find((u) => u.key === 'showing-up-7')).toBeUndefined();
    const r = await mutate(useDeleteTask, task.id);
    expect(r.ok).toBe(true);
    expect(fake.unlocks().map((u) => u.key)).toContain('showing-up-7');
  });

  test('M53: deleting for good first saves a Comeback the habit earned (retired days are anonymous)', async () => {
    const task = makeTask({ deletedAt: '2024-05-30T12:00:00.000Z' as Instant });
    fake.seedTask(task);
    // Created 05-25 and not logged (missed), then done on 05-26: a comeback on that one habit.
    await logDay(task, '2024-05-26');
    expect(fake.unlocks().find((u) => u.key === 'fallback-comeback')).toBeUndefined();
    const r = await mutate(useDeleteForever, task.id);
    expect(r.ok).toBe(true);
    expect(fake.unlocks().map((u) => u.key)).toContain('fallback-comeback');
  });

  test('M56: restoring a habit does not mark a pushed day off a second time when it is already off', async () => {
    clock.today = '2024-06-05';
    clock.now = '2024-06-05T12:00:00.000Z';
    const task = makeTask({ deletedAt: '2024-06-01T12:00:00.000Z' as Instant });
    fake.seedTask(task);
    // Pushed on its last day, never logged.
    await repos.logs.upsert(dayLog(task, '2024-06-01', { chipState: null, isManualOverride: false, movedToDate: d('2024-06-02') }));
    const r = await mutate(useRestoreTask, task.id);
    expect(r.ok).toBe(true);
    const marks = await repos.offDays.listRange(d('2024-06-02'), d('2024-06-02'));
    expect(marks.filter((m) => m.taskId === task.id)).toHaveLength(1);
  });

  test('M31: ending a habit whose logged day was pushed as a FALLBACK brings that day back and ends on it', async () => {
    const task = makeTask();
    fake.seedTask(task);
    await logDay(task, '2024-06-01', 'fallback', { movedToDate: d('2024-06-02') });
    const r = await mutate(useEndTask, task.id);
    expect(r).toEqual({ ok: true, value: '2024-06-01' });
    expect(fake.logsFor(task.id).find((l) => l.date === '2024-06-01')?.movedToDate).toBeNull();
  });
});

describe('mutations.ts mutation survivors: logging, off days, snooze', () => {
  test('M51: ticking a step is judged against the steps due on the day being ticked', async () => {
    clock.today = '2024-06-03'; // a Monday
    clock.now = '2024-06-03T12:00:00.000Z';
    const id = 'mm-steps' as Id;
    const mk = (sid: string, text: string, dueWeekdays: Step['dueWeekdays'], role: Step['role']): Step => ({ id: sid as Id, taskId: id, role, text, position: 0, dueWeekdays });
    const task = makeTask({
      id,
      idealSteps: [mk('A', 'Monday only', [1], 'ideal'), mk('B', 'Every day', null, 'ideal')],
      fallbackSteps: [mk('F', 'Minimum', null, 'fallback')],
    });
    fake.seedTask(task);
    const r = await __testing__.toggleStep({ taskId: id, date: d('2024-06-03'), stepId: 'A' as Id });
    expect(r.ok).toBe(true);
    // Both A and B are due on Monday, only A is ticked: a fallback day, not an untouched one.
    expect(fake.logsFor(id)[0]?.chipState).toBe('fallback');
  });

  test('M39: marking one habit off never touches another habit\'s pushed day', async () => {
    clock.today = '2024-06-02';
    clock.now = '2024-06-02T12:00:00.000Z';
    const a = makeTask();
    const b = makeTask();
    fake.seedTask(a);
    fake.seedTask(b);
    // B logged its 06-01 day done and pushed it to 06-02; no XP award exists for it yet.
    await logDay(b, '2024-06-01', 'done', { movedToDate: d('2024-06-02') });
    const r = await __testing__.markOffDay({ date: d('2024-06-02'), taskId: a.id, mark: true });
    expect(r.ok).toBe(true);
    expect(fake.xpAwards().filter((x) => x.taskId === b.id)).toEqual([]);
  });

  test('M42: the last day of an ended habit can be pushed no further than that day, so the day before can be pushed onto it', async () => {
    const task = makeTask({ endedOn: d('2024-06-02') });
    fake.seedTask(task);
    const onto = await __testing__.snoozeOccurrence({ taskId: task.id, date: d('2024-06-01') });
    expect(onto.ok).toBe(true);
    const past = await __testing__.snoozeOccurrence({ taskId: task.id, date: d('2024-06-02') });
    expect(past.ok).toBe(false);
  });
});
