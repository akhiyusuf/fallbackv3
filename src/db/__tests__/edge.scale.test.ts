/**
 * Round 2, scale and speed of the reads, against a REAL SQLite file (node:sqlite behind the
 * expo-sqlite double). A heavy but plausible person: 60 live habits, 40 ended, 30 deleted (in
 * Recently deleted), 200 days left by habits deleted for good, three years of logs, off days and
 * pushed days.
 *
 * Each read the app makes on its common screens is timed twice on the same database: with the
 * frozen pre-optimisation resolvers (`src/queries/testSupport/legacyResolve.ts`) and with the live
 * ones, and the two answers are compared for equality. The budgets at the bottom are asserted on
 * the best of several runs. Read-only use of the repositories; nothing in src/db is touched.
 */
import { makeTempDir, removeDir, joinPath } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __scaleDir?: string }).__scaleDir,
  }),
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));
jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  return {
    ...actual,
    today: () => (globalThis as { __scaleToday?: string }).__scaleToday ?? actual.today(),
    now: () => (globalThis as { __scaleNow?: string }).__scaleNow ?? actual.now(),
  };
});

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatabaseSync } from 'node:sqlite';

import type { ConsistencyWindow, Id, Instant, LocalDate, Occurrence } from '@/types';
import type { Dataset } from '@/queries/testSupport/scaleData';

type App = typeof import('@/db');

const TODAY = '2026-11-20' as LocalDate;
const NOW = '2026-11-20T12:00:00.000Z' as Instant;

let app: App;
let ds: Dataset;
let dbPath: string;
const table: Array<{ read: string; before: number | null; after: number }> = [];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const queries = () => require('@/queries') as typeof import('@/queries');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const internal = () => require('@/queries/internal') as typeof import('@/queries/internal');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const legacy = () => require('@/queries/testSupport/legacyResolve') as typeof import('@/queries/testSupport/legacyResolve');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const domain = () => require('@/domain') as typeof import('@/domain');

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false }, mutations: { retry: false } } });
}

/** Runs a hook on a fresh client and returns how long the read took, plus what it returned. */
async function hookRead<T>(useHook: () => { data: T | undefined; isSuccess: boolean; isError: boolean }): Promise<{ ms: number; data: T }> {
  const c = client();
  const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: c }, children);
  const start = performance.now();
  const r = await renderHook(useHook, { wrapper });
  await waitFor(() => expect(r.result.current.isSuccess || r.result.current.isError).toBe(true), { timeout: 30000, interval: 1 });
  const ms = performance.now() - start;
  expect(r.result.current.isError).toBe(false);
  const data = r.result.current.data as T;
  await act(async () => {
    r.unmount();
  });
  c.clear();
  return { ms, data };
}

async function bestOf<T>(runs: number, fn: () => Promise<{ ms: number; data: T }>): Promise<{ ms: number; data: T }> {
  let best: { ms: number; data: T } | null = null;
  for (let i = 0; i < runs; i++) {
    const r = await fn();
    if (best === null || r.ms < best.ms) best = r;
  }
  return best as { ms: number; data: T };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; data: T }> {
  const start = performance.now();
  const data = await fn();
  return { ms: performance.now() - start, data };
}

function record(read: string, before: number | null, after: number) {
  table.push({ read, before, after });
}

beforeAll(async () => {
  jest.setTimeout(300000);
  const dir = makeTempDir('fallback-scale-');
  createdDirs.push(dir);
  (globalThis as { __scaleDir?: string }).__scaleDir = dir;
  (globalThis as { __scaleToday?: string }).__scaleToday = TODAY;
  (globalThis as { __scaleNow?: string }).__scaleNow = NOW;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  dbPath = joinPath(dir, (require('../client') as typeof import('../client')).DB_NAME);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app = require('@/db') as App;
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error('store did not open');

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildDataset } = require('@/queries/testSupport/scaleData') as typeof import('@/queries/testSupport/scaleData');
  ds = buildDataset(2026, {
    today: TODAY,
    spanDays: 1095,
    live: 60,
    ended: 40,
    deleted: 30,
    retiredDays: 200,
    deletedWithinDays: 25,
    logDensity: 0.85,
    pushRate: 0.03,
    offDayRate: 0.02,
    taskOffRate: 0.01,
  });
  for (const t of ds.tasks) {
    const { idealSteps, fallbackSteps, ...task } = t;
    const res = await app.repos.tasks.insert(task, [...idealSteps, ...fallbackSteps]);
    if (!res.ok) throw new Error(`insert failed: ${JSON.stringify(res)}`);
  }
  expect((await app.repos.retiredDays.add(ds.retired)).ok).toBe(true);

  const raw = new DatabaseSync(dbPath);
  raw.exec('BEGIN');
  const insLog = raw.prepare(
    `INSERT INTO day_log (id, task_id, date, chip_state, is_manual_override, completed_step_ids, doses_completed, moved_to_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const l of ds.logs) {
    insLog.run(l.id, l.taskId, l.date, l.chipState, l.isManualOverride ? 1 : 0, JSON.stringify(l.completedStepIds), l.dosesCompleted, l.movedToDate, l.createdAt, l.updatedAt);
  }
  const insOff = raw.prepare(`INSERT INTO off_day_mark (id, date, task_id, prior_chip_state, created_at) VALUES (?,?,?,?,?)`);
  for (const o of ds.offs) insOff.run(o.id, o.date, o.taskId, o.priorChipState, o.createdAt);
  raw.exec('COMMIT');
  raw.close();
}, 300000);

afterAll(() => {
  // The table the report quotes.
  const lines = table.map((r) => `${r.read.padEnd(44)} before ${r.before === null ? '   n/a' : r.before.toFixed(0).padStart(6)} ms   after ${r.after.toFixed(0).padStart(6)} ms`);
  // eslint-disable-next-line no-console
  console.log(`SCALE TIMINGS (${ds.tasks.length} habits, ${ds.logs.length} logs, ${ds.offs.length} off marks, ${ds.retired.length} retired days)\n${lines.join('\n')}`);
});

const sameOccs = (a: readonly Occurrence[], b: readonly Occurrence[]) => expect(a).toEqual(b);

describe('a heavy person: 60 live, 40 ended, 30 deleted, 200 retired days, 3 years', () => {
  it('seeds what it says it seeds', async () => {
    expect((await app.repos.tasks.list()).length).toBe(100);
    expect((await app.repos.tasks.listDeleted()).length).toBe(30);
    expect((await app.repos.retiredDays.list()).length).toBe(200);
    expect(ds.logs.length).toBeGreaterThan(40000);
  });

  it('Today: same answer for the day, and fast', async () => {
    const before = await bestOf(3, () => timed(() => legacy().legacyResolveAllOccurrences(app.repos, TODAY, TODAY)));
    const after = await bestOf(5, () => hookRead(() => queries().useToday(TODAY)));
    sameOccs(after.data.filter((o) => o.date === TODAY), before.data.filter((o) => o.date === TODAY));
    record('Today (useToday)', before.ms, after.ms);
    expect(after.ms).toBeLessThan(150);
  });

  it.each(['last-7', 'last-30', 'all-time'] as ConsistencyWindow[])('aggregate consistency %s: same answer, within budget', async (window) => {
    const before = await bestOf(3, () =>
      timed(async () => {
        const occs = await legacy().legacyResolveRecordOccurrences(app.repos, TODAY, TODAY);
        return domain().aggregateConsistency({ occurrences: occs, window, today: TODAY });
      }),
    );
    const after = await bestOf(3, () => hookRead(() => queries().useConsistency({ scope: 'aggregate', window })));
    expect(after.data).toEqual(before.data);
    record(`aggregate consistency ${window}`, before.ms, after.ms);
    expect(after.ms).toBeLessThan(300);
  });

  it('disclosure table: same answer', async () => {
    const before = await bestOf(3, () => timed(async () => domain().dayFractions(await legacy().legacyResolveRecordOccurrences(app.repos, TODAY, TODAY))));
    const after = await bestOf(3, () => hookRead(() => queries().useConsistencyDisclosure()));
    expect(after.data).toEqual(before.data);
    record('disclosure table', before.ms, after.ms);
    expect(after.ms).toBeLessThan(400);
  });

  it('trend: same buckets and percentages', async () => {
    const before = await bestOf(2, () =>
      timed(async () => {
        const occs = await legacy().legacyResolveRecordOccurrences(app.repos, TODAY, TODAY);
        return occs;
      }),
    );
    const after = await bestOf(3, () => hookRead(() => queries().useTrend()));
    expect(after.data.length).toBeGreaterThan(10);
    for (const p of after.data) {
      const r = domain().aggregateConsistency({ occurrences: before.data, window: p.range, today: TODAY });
      expect(p.percent).toBe(r.denominator > 0 ? r.percent : null);
      expect(p.breakdown).toEqual(r.breakdown);
    }
    record('trend (resolve + every bucket)', null, after.ms);
    expect(after.ms).toBeLessThan(500);
  });

  it('achievements: same list, within budget', async () => {
    const unlocks = await app.repos.progress.listUnlocks();
    const settings = await app.repos.settings.get();
    const before = await bestOf(2, () =>
      timed(async () => {
        const occs = await legacy().legacyResolveRecordOccurrences(app.repos, TODAY, TODAY);
        return [...unlocks, ...domain().reconcileAchievements({ occurrences: occs, tenureAnchor: settings.tenureAnchorDate, today: TODAY, alreadyUnlocked: unlocks, now: NOW })];
      }),
    );
    const after = await bestOf(3, () => hookRead(() => queries().useAchievements()));
    expect(after.data).toEqual(before.data);
    record('achievements (useAchievements)', before.ms, after.ms);
    expect(after.ms).toBeLessThan(500);
  });

  it('progress (useProgress) is a few small reads', async () => {
    const after = await bestOf(3, () => hookRead(() => queries().useProgress()));
    record('progress (useProgress)', null, after.ms);
    expect(after.ms).toBeLessThan(150);
  });

  it('a task page: a month of occurrences plus consistency for 5 habits', async () => {
    const habits = (await app.repos.tasks.list()).slice(0, 5);
    const month = { from: '2026-11-01' as LocalDate, to: '2026-11-30' as LocalDate };
    let beforeMs = 0;
    let afterMs = 0;
    for (const t of habits) {
      const b = await timed(async () => {
        // One resolve per read, as each of the three hooks does.
        const occs = await legacy().legacyResolveTaskOccurrences(app.repos, t, TODAY, TODAY);
        const occs30 = await legacy().legacyResolveTaskOccurrences(app.repos, t, TODAY, TODAY);
        return {
          month: (await legacy().legacyResolveTaskOccurrences(app.repos, t, month.to, TODAY)).filter((o) => o.date >= month.from && o.date <= month.to),
          c7: domain().perTaskConsistency({ taskId: t.id, occurrences: occs, window: 'last-7', today: TODAY }),
          c30: domain().perTaskConsistency({ taskId: t.id, occurrences: occs30, window: 'last-30', today: TODAY }),
        };
      });
      const a1 = await bestOf(2, () => hookRead(() => queries().useTaskOccurrences(t.id, month)));
      const a2 = await bestOf(2, () => hookRead(() => queries().useConsistency({ scope: 'per-task', window: 'last-7', taskId: t.id })));
      const a3 = await bestOf(2, () => hookRead(() => queries().useConsistency({ scope: 'per-task', window: 'last-30', taskId: t.id })));
      expect(a1.data).toEqual(b.data.month);
      expect(a2.data).toEqual(b.data.c7);
      expect(a3.data).toEqual(b.data.c30);
      beforeMs += b.ms;
      afterMs += a1.ms + a2.ms + a3.ms;
    }
    record('task page x5 (month + last-7 + last-30)', beforeMs, afterMs);
    expect(afterMs / habits.length).toBeLessThan(150);
  });

  it('Recently deleted: a list of 30, nothing expired', async () => {
    const after = await bestOf(3, () => hookRead(() => queries().useRecentlyDeleted()));
    expect(after.data.length).toBe(30);
    record('Recently deleted (useRecentlyDeleted)', null, after.ms);
    expect(after.ms).toBeLessThan(300);
  });

  it('where the time goes in a whole-record read (diagnostic)', async () => {
    const t0 = await timed(() => app.repos.tasks.list());
    const t1 = await timed(() => app.repos.tasks.listDeleted());
    const t2 = await timed(() => app.repos.logs.listRange('2000-01-01' as LocalDate, TODAY));
    const t3 = await timed(() => app.repos.offDays.listRange('2000-01-01' as LocalDate, TODAY));
    const t4 = await timed(() => app.repos.retiredDays.list());
    const t5 = await timed(() => internal().resolveRecordOccurrences(app.repos, TODAY, TODAY));
    const readMs = t0.ms + t1.ms + t2.ms + t3.ms + t4.ms;
    record('  tasks.list + listDeleted (with steps)', null, t0.ms + t1.ms);
    record('  logs.listRange, whole history', null, t2.ms);
    record('  offDays.listRange + retiredDays.list', null, t3.ms + t4.ms);
    record('  whole record resolve in total', null, t5.ms);
    record('  ...so resolving in memory is about', null, Math.max(0, t5.ms - readMs));
    expect(t2.data.length).toBe(ds.logs.length);
  });

  it('what a log runs after: the whole-record resolve (and the badge check on top of it)', async () => {
    const before = await bestOf(3, () => timed(() => legacy().legacyResolveRecordOccurrences(app.repos, TODAY, TODAY)));
    const after = await bestOf(3, () => timed(() => internal().resolveRecordOccurrences(app.repos, TODAY, TODAY)));
    sameOccs(after.data, before.data);
    record('whole record resolve (after every log)', before.ms, after.ms);
    const unlocks = await app.repos.progress.listUnlocks();
    const settings = await app.repos.settings.get();
    const check = await bestOf(3, () =>
      timed(async () => domain().reconcileAchievements({ occurrences: after.data, tenureAnchor: settings.tenureAnchorDate, today: TODAY, alreadyUnlocked: unlocks, now: NOW })),
    );
    record('  of which reconcileAchievements (domain)', null, check.ms);
    expect(after.ms).toBeLessThan(300);
  });

  it('logging one day through the real mutation, on this database', async () => {
    const habit = (await app.repos.tasks.list()).find((t) => t.type === 'routine' && t.cadence?.kind === 'daily' && t.endedOn === null && !t.isAsNeeded);
    expect(habit).toBeDefined();
    const c = client();
    const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: c }, children);
    const r = await renderHook(() => queries().useLogState(), { wrapper });
    const times: number[] = [];
    for (const chip of ['done', 'fallback', 'done'] as const) {
      const start = performance.now();
      await act(async () => {
        await r.result.current.mutateAsync({ taskId: habit!.id as Id, date: TODAY, chip });
      });
      times.push(performance.now() - start);
    }
    await act(async () => {
      r.unmount();
    });
    record('log a day (mutation, best of 3)', null, Math.min(...times));
    expect(Math.min(...times)).toBeLessThan(1000);
  });
});
