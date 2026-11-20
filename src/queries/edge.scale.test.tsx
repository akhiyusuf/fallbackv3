/**
 * Round 2, scale and speed of the reads (fake repositories). The read resolvers were made faster
 * (one range read for every habit instead of two per habit, only the days a screen needs, no scan
 * of every off mark for every day). This file proves the answers did not change: on seeded random
 * data (every cadence, events, courses, ended, deleted, pushed days, whole-day and per-habit off
 * marks, retired days) the live resolvers and every read hook are compared with a frozen copy of
 * the old resolvers (`testSupport/legacyResolve.ts`), and the number of queries is counted.
 */
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') }));
jest.mock('@/db', () => require('./testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { addDays } from '@/lib/date';
import { aggregateConsistency, dayFractions, perTaskConsistency, reconcileAchievements } from '@/domain';
import type { ConsistencyWindow, DayLog, Id, LocalDate, Occurrence } from '@/types';

import { resolveAllOccurrences, resolveRecordOccurrences, resolveTaskOccurrences } from './internal';
import { clock } from './testSupport/clockMock';
import { fake, repos } from './testSupport/dbMock';
import { legacyResolveAllOccurrences, legacyResolveRecordOccurrences, legacyResolveTaskOccurrences } from './testSupport/legacyResolve';
import { buildDataset, makeRng } from './testSupport/scaleData';
import type { Dataset } from './testSupport/scaleData';
import { useAchievements, useConsistency, useConsistencyDisclosure, useTaskOccurrences, useToday, useTrend } from './reads';

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
}

const unmounts: Array<() => void> = [];
const clients: QueryClient[] = [];

async function readNow<T>(useHook: () => { data: T | undefined; isSuccess: boolean; isError: boolean }): Promise<T> {
  const client = freshClient();
  clients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
  const r = await renderHook(useHook, { wrapper });
  unmounts.push(r.unmount);
  await waitFor(() => expect(r.result.current.isSuccess || r.result.current.isError).toBe(true));
  expect(r.result.current.isError).toBe(false);
  return r.result.current.data as T;
}

afterEach(async () => {
  await act(async () => {
    unmounts.forEach((fn) => fn());
  });
  unmounts.length = 0;
  clients.forEach((c) => c.clear());
  clients.length = 0;
  jest.restoreAllMocks();
});

async function seed(ds: Dataset): Promise<void> {
  fake.reset();
  clock.today = ds.today;
  clock.now = `${ds.today}T12:00:00.000Z`;
  for (const t of ds.tasks) fake.seedTask(t);
  for (const l of ds.logs) await repos.logs.upsert(l);
  for (const o of ds.offs) await repos.offDays.mark(o);
  await repos.retiredDays.add(ds.retired);
}

const TODAY = '2024-06-01' as LocalDate;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function specFor(seed: number) {
  return {
    today: TODAY,
    spanDays: 120 + (seed % 5) * 90,
    live: 3 + (seed % 5),
    ended: 1 + (seed % 3),
    deleted: 1 + (seed % 3),
    retiredDays: 15,
    pushRate: seed % 3 === 0 ? 0.15 : 0.04,
    logDensity: seed % 4 === 0 ? 0.3 : 0.85,
    exotic: true,
  };
}

const allTasks = async () => repos.tasks.list({ includeDeleted: true });

describe('the resolvers give the same occurrences as before', () => {
  it.each(SEEDS)('seed %i: per habit, all live, and the whole record, over the whole history', async (seed) => {
    const ds = buildDataset(seed, specFor(seed));
    await seed_(ds);
    for (const to of [TODAY, addDays(TODAY, -40), addDays(TODAY, 9)]) {
      for (const t of await allTasks()) {
        expect(await resolveTaskOccurrences(repos, t, to, TODAY)).toEqual(await legacyResolveTaskOccurrences(repos, t, to, TODAY));
      }
      expect(await resolveAllOccurrences(repos, to, TODAY)).toEqual(await legacyResolveAllOccurrences(repos, to, TODAY));
      expect(await resolveRecordOccurrences(repos, to, TODAY)).toEqual(await legacyResolveRecordOccurrences(repos, to, TODAY));
    }
  });

  it.each(SEEDS)('seed %i: a floor gives exactly the full answer from the floor on (pushed days across the floor included)', async (seed) => {
    const ds = buildDataset(seed, specFor(seed));
    await seed_(ds);
    const rng = makeRng(seed * 977);
    const fullTask = new Map<string, Occurrence[]>();
    for (const t of await allTasks()) fullTask.set(t.id, await legacyResolveTaskOccurrences(repos, t, TODAY, TODAY));
    const fullAll = await legacyResolveAllOccurrences(repos, TODAY, TODAY);
    const fullRecord = await legacyResolveRecordOccurrences(repos, TODAY, TODAY);

    for (let i = 0; i < 12; i++) {
      const floor = addDays(TODAY, -Math.floor(rng() * (ds.tasks.length ? 500 : 50)));
      for (const t of await allTasks()) {
        expect(await resolveTaskOccurrences(repos, t, TODAY, TODAY, floor)).toEqual((fullTask.get(t.id) ?? []).filter((o) => o.date >= floor));
      }
      expect(await resolveAllOccurrences(repos, TODAY, TODAY, floor)).toEqual(fullAll.filter((o) => o.date >= floor));
      expect(await resolveRecordOccurrences(repos, TODAY, TODAY, floor)).toEqual(fullRecord.filter((o) => o.date >= floor));
    }
    // And every pushed day a floor can fall right after: the floor sits on the day a push lands.
    for (const l of ds.logs.filter((x) => x.movedToDate !== null).slice(0, 15)) {
      const floor = l.movedToDate as LocalDate;
      const t = ds.tasks.find((x) => x.id === l.taskId)!;
      expect(await resolveTaskOccurrences(repos, t, TODAY, TODAY, floor)).toEqual((fullTask.get(t.id) ?? []).filter((o) => o.date >= floor));
    }
  });
});

describe('the read hooks give the same answers as before', () => {
  it.each(SEEDS)('seed %i: consistency (every window, aggregate and per habit), disclosure, trend, achievements, Today, task page', async (seed) => {
    const ds = buildDataset(seed, specFor(seed));
    await seed_(ds);
    const record = await legacyResolveRecordOccurrences(repos, TODAY, TODAY);

    for (const window of ['last-7', 'last-30', 'all-time'] as ConsistencyWindow[]) {
      const got = await readNow(() => useConsistency({ scope: 'aggregate', window }));
      expect(got).toEqual(aggregateConsistency({ occurrences: record, window, today: TODAY }));
    }
    const live = ds.tasks.filter((t) => t.deletedAt === null).slice(0, 4);
    for (const t of live) {
      const occs = await legacyResolveTaskOccurrences(repos, t, TODAY, TODAY);
      for (const window of ['last-7', 'last-30', 'all-time'] as ConsistencyWindow[]) {
        const got = await readNow(() => useConsistency({ scope: 'per-task', window, taskId: t.id }));
        expect(got).toEqual(perTaskConsistency({ taskId: t.id, occurrences: occs, window, today: TODAY }));
      }
      const from = addDays(TODAY, -45);
      const page = await readNow(() => useTaskOccurrences(t.id, { from, to: TODAY }));
      expect(page).toEqual(occs.filter((o) => o.date >= from && o.date <= TODAY));
    }

    expect(await readNow(() => useConsistencyDisclosure())).toEqual(dayFractions(record));

    const trend = await readNow(() => useTrend());
    for (const p of trend) {
      const r = aggregateConsistency({ occurrences: record, window: p.range, today: TODAY });
      expect(p.percent).toBe(r.denominator > 0 ? r.percent : null);
      expect(p.breakdown).toEqual(r.breakdown);
    }

    const unlocks = await repos.progress.listUnlocks();
    const settings = await repos.settings.get();
    const fresh = reconcileAchievements({ occurrences: record, tenureAnchor: settings.tenureAnchorDate, today: TODAY, alreadyUnlocked: unlocks, now: clock.now as never });
    expect(await readNow(() => useAchievements())).toEqual([...unlocks, ...fresh]);

    const legacyAll = await legacyResolveAllOccurrences(repos, TODAY, TODAY);
    const today = await readNow(() => useToday(TODAY));
    expect(today.filter((o) => o.date === TODAY)).toEqual(legacyAll.filter((o) => o.date === TODAY));
  });

  it('a habit due once a month widens the window until the walk really has 7 counted days', async () => {
    // Only monthly habits: seven counted days take about seven months, far past the first stretch read.
    fake.reset();
    clock.today = TODAY;
    clock.now = `${TODAY}T12:00:00.000Z`;
    const ds = buildDataset(77, { today: TODAY, spanDays: 900, live: 0, ended: 0, deleted: 0, retiredDays: 0 });
    expect(ds.tasks).toHaveLength(0);
    const { makeMonthly } = monthlyHelpers();
    for (let i = 0; i < 3; i++) fake.seedTask(makeMonthly(i));
    for (const t of await allTasks()) {
      for (const d of ['2023-01-15', '2023-02-15', '2023-03-15', '2023-05-15', '2023-08-15', '2023-11-15', '2024-02-15', '2024-04-15']) {
        await repos.logs.upsert(logRow(t.id, d, 'done'));
      }
    }
    const record = await legacyResolveRecordOccurrences(repos, TODAY, TODAY);
    for (const window of ['last-7', 'last-30'] as ConsistencyWindow[]) {
      expect(await readNow(() => useConsistency({ scope: 'aggregate', window }))).toEqual(aggregateConsistency({ occurrences: record, window, today: TODAY }));
    }
    const t0 = (await allTasks())[0]!;
    const occs = await legacyResolveTaskOccurrences(repos, t0, TODAY, TODAY);
    expect(await readNow(() => useConsistency({ scope: 'per-task', window: 'last-7', taskId: t0.id }))).toEqual(
      perTaskConsistency({ taskId: t0.id, occurrences: occs, window: 'last-7', today: TODAY }),
    );
  });
});

describe('how many queries a read makes', () => {
  it('Today with 60 habits: one logs range read, one off-day read, no per-habit log reads', async () => {
    const ds = buildDataset(5, { today: TODAY, spanDays: 400, live: 60, ended: 0, deleted: 0, retiredDays: 0 });
    await seed_(ds);
    const perTaskLogs = jest.spyOn(repos.logs, 'listForTask');
    const rangeLogs = jest.spyOn(repos.logs, 'listRange');
    const offs = jest.spyOn(repos.offDays, 'listRange');
    await readNow(() => useToday(TODAY));
    expect(perTaskLogs).toHaveBeenCalledTimes(0);
    expect(rangeLogs).toHaveBeenCalledTimes(1);
    expect(offs).toHaveBeenCalledTimes(1);
    // The one logs read is the day before and the day itself, not the history.
    expect(rangeLogs.mock.calls[0]).toEqual([addDays(TODAY, -1), TODAY]);
  });

  it('the whole record (60 live, 40 ended, 30 deleted) is two range reads, however many habits', async () => {
    const ds = buildDataset(6, { today: TODAY, spanDays: 300, live: 60, ended: 40, deleted: 30, retiredDays: 200 });
    await seed_(ds);
    const perTaskLogs = jest.spyOn(repos.logs, 'listForTask');
    const rangeLogs = jest.spyOn(repos.logs, 'listRange');
    const offs = jest.spyOn(repos.offDays, 'listRange');
    await resolveRecordOccurrences(repos, TODAY, TODAY);
    expect(perTaskLogs).toHaveBeenCalledTimes(0);
    expect(rangeLogs).toHaveBeenCalledTimes(1);
    expect(offs).toHaveBeenCalledTimes(1);
  });

  it('last-7 consistency reads a few weeks, not the whole history', async () => {
    const ds = buildDataset(7, { today: TODAY, spanDays: 1000, live: 20, ended: 0, deleted: 0, retiredDays: 0, logDensity: 0.95 });
    await seed_(ds);
    const rangeLogs = jest.spyOn(repos.logs, 'listRange');
    await readNow(() => useConsistency({ scope: 'aggregate', window: 'last-7' }));
    expect(rangeLogs).toHaveBeenCalledTimes(1);
    const [from] = rangeLogs.mock.calls[0] as [LocalDate, LocalDate];
    expect(from >= addDays(TODAY, -30)).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------ helpers

async function seed_(ds: Dataset) {
  await seed(ds);
}

function logRow(taskId: Id, date: string, chip: 'done' | 'fallback'): DayLog {
  return {
    id: `${taskId}-${date}` as Id,
    taskId,
    date: date as LocalDate,
    chipState: chip,
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: `${date}T10:00:00.000Z` as never,
    updatedAt: `${date}T10:00:00.000Z` as never,
  };
}

function monthlyHelpers() {
  const { buildDataset: b } = require('./testSupport/scaleData') as typeof import('./testSupport/scaleData');
  const base = b(1, { today: TODAY, spanDays: 10, live: 1, ended: 0, deleted: 0, retiredDays: 0 }).tasks[0]!;
  return {
    makeMonthly: (i: number) => ({
      ...base,
      id: `monthly-${i}` as Id,
      cadence: { kind: 'monthly' as const, dayOfMonth: 15, anchorDate: '2022-12-01' as LocalDate },
      createdAt: '2022-12-01T12:00:00.000Z' as never,
      endedOn: null,
      deletedAt: null,
      idealSteps: [],
      fallbackSteps: [],
    }),
  };
}
