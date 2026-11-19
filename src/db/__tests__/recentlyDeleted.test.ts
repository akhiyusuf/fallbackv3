/**
 * Recently deleted, against a REAL SQLite file (node:sqlite behind the expo-sqlite double, file-backed).
 *
 * A "launch" is a fresh module registry plus a new connection to the same file; nothing is closed
 * first, like a killed app. The clock is controlled through `globalThis.__rdNow` (see the
 * `@/lib/date` mock), so the 30-day boundaries can be hit exactly.
 */
import { makeTempDir, removeDir, joinPath } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

/** Each test gets its own database directory, so no connection or WAL state leaks between tests. */
function newDatabaseDir(): string {
  const dir = makeTempDir('fallback-recently-deleted-');
  createdDirs.push(dir);
  (globalThis as { __rdDir?: string }).__rdDir = dir;
  return dir;
}

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __rdDir?: string }).__rdDir,
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
    // The clock every write and the sweep read. Unset means the real clock.
    now: () => ((globalThis as { __rdNow?: string }).__rdNow as ReturnType<typeof actual.now>) ?? actual.now(),
  };
});

import { DatabaseSync } from 'node:sqlite';

import { newId } from '@/lib/id';
import { levelFor } from '@/domain';
import type { Instant, LocalDate, Step, Task, TaskWithSteps } from '@/types';

type App = typeof import('@/db');

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = '2026-03-10T09:00:00.000Z' as Instant;
const D = '2026-03-08' as LocalDate; // a past day with history

function at(ms: number): Instant {
  return new Date(ms).toISOString() as Instant;
}
function t0Plus(ms: number): Instant {
  return at(new Date(T0).getTime() + ms);
}
function setClock(instant: Instant | null): void {
  (globalThis as { __rdNow?: string }).__rdNow = instant ?? undefined;
}

/** A new app launch at the given clock: fresh modules, a new connection, nothing closed first. */
function launch(): App {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/db') as App;
}

/** Launch and run the same call S01 makes. The store must come back ready. */
async function coldStart(clockAt: Instant): Promise<App> {
  setClock(clockAt);
  const app = launch();
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error(`store did not open ready: ${JSON.stringify(opened)}`);
  return app;
}

/** A raw read of the database file, the way the sweep and cascade actually left it. */
function rawCount(sql: string, params: unknown[] = []): number {
  const connection = new DatabaseSync(joinPath(currentDir(), 'fallback.db'));
  try {
    const row = connection.prepare(sql).get(...params) as { n: number };
    return Number(row.n);
  } finally {
    connection.close();
  }
}
function currentDir(): string {
  return (globalThis as { __rdDir?: string }).__rdDir as string;
}

function buildTask(overrides: Partial<Task> = {}): Task {
  const created = '2026-01-01T00:00:00.000Z';
  return {
    id: newId(),
    type: 'routine',
    name: 'Movement',
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
    createdAt: created as Instant,
    updatedAt: created as Instant,
    deletedAt: null,
    snoozable: true,
    ...overrides,
  } as Task;
}

function buildSteps(taskId: string): Step[] {
  return [
    { id: newId(), taskId: taskId as never, role: 'ideal', text: 'Walk 20 min', position: 0, dueWeekdays: null },
    { id: newId(), taskId: taskId as never, role: 'fallback', text: 'Stretch 2 min', position: 0, dueWeekdays: null },
  ];
}

/** Everything a task owns, with history: steps, day logs, a per-task off mark, an as-needed use, XP. */
async function seedHistory(app: App, task: Task): Promise<void> {
  const { repos } = app;
  expect((await repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);
  const cycle = await repos.cycleState.get();
  const cycleId = cycle!.currentCycleId;
  const stamp = '2026-03-01T10:00:00.000Z' as Instant;
  const logs: Array<{ date: LocalDate; chipState: 'done' | 'fallback' | 'todo' }> = [
    { date: '2026-03-06' as LocalDate, chipState: 'done' },
    { date: '2026-03-07' as LocalDate, chipState: 'fallback' },
    { date: D, chipState: 'todo' },
  ];
  for (const log of logs) {
    expect(
      (
        await repos.logs.upsert({
          id: newId(),
          taskId: task.id,
          date: log.date,
          chipState: log.chipState,
          isManualOverride: true,
          completedStepIds: [],
          dosesCompleted: 0,
          movedToDate: null,
          createdAt: stamp,
          updatedAt: stamp,
        })
      ).ok,
    ).toBe(true);
  }
  expect((await repos.offDays.mark({ id: newId(), date: '2026-03-05' as LocalDate, taskId: task.id, priorChipState: null, createdAt: stamp })).ok).toBe(true);
  expect((await repos.asNeeded.append({ id: newId(), taskId: task.id, date: D, marker: 'fallback', createdAt: stamp })).ok).toBe(true);
  expect((await repos.progress.appendXpAward({ id: newId(), taskId: task.id, date: '2026-03-06' as LocalDate, kind: 'ideal', amount: 10, cycleId, createdAt: stamp })).ok).toBe(true);
  expect((await repos.progress.appendXpAward({ id: newId(), taskId: task.id, date: '2026-03-07' as LocalDate, kind: 'fallback', amount: 6, cycleId, createdAt: stamp })).ok).toBe(true);
}

/** Whole-day marks (task_id NULL), an achievement and a finalized cycle: things that belong to nothing. */
async function seedAccountWide(app: App): Promise<void> {
  const { repos } = app;
  const stamp = '2026-03-01T10:00:00.000Z' as Instant;
  expect((await repos.offDays.mark({ id: newId(), date: '2026-03-04' as LocalDate, taskId: null, priorChipState: null, createdAt: stamp })).ok).toBe(true);
  expect((await repos.progress.upsertUnlock({ key: 'first-day', unlockedOn: '2026-03-06' as LocalDate, createdAt: stamp })).ok).toBe(true);
  expect(
    (
      await repos.progress.appendCycleRecord({
        id: newId(),
        cadence: 'weekly',
        startDate: '2026-02-23' as LocalDate,
        endDate: '2026-03-01' as LocalDate,
        consistencyPercent: 80,
        breakdown: { ideal: 4, fallback: 2, off: 1, missed: 1 },
        cyclingXpFinal: 46,
        badgeKeysUnlocked: ['first-day'],
        isShortCycle: false,
        finalizedAt: stamp,
      } as never)
    ).ok,
  ).toBe(true);
}

async function allTaskRows(app: App): Promise<readonly TaskWithSteps[]> {
  return app.repos.tasks.list({ includeDeleted: true });
}

afterEach(() => {
  setClock(null);
});

/* ------------------------------------------------------------------ 1. boundaries of the sweep */

describe('the 30-day sweep on launch, at the boundaries (real SQLite, file-backed)', () => {
  const cases: Array<{ label: string; relaunchAfterMs: number; kept: boolean }> = [
    { label: 'one day after deleting', relaunchAfterMs: DAY_MS, kept: true },
    { label: '30 days minus 1 ms', relaunchAfterMs: 30 * DAY_MS - 1, kept: true },
    // The sweep removes only what was deleted BEFORE the cutoff (strict `<`), so at exactly 30 days it is still kept.
    { label: 'exactly 30 days', relaunchAfterMs: 30 * DAY_MS, kept: true },
    { label: '30 days plus 1 ms', relaunchAfterMs: 30 * DAY_MS + 1, kept: false },
    { label: 'a year later', relaunchAfterMs: 365 * DAY_MS, kept: false },
  ];

  it.each(cases)('$label: kept=$kept', async ({ relaunchAfterMs, kept }) => {
    newDatabaseDir();
    const first = await coldStart(T0);
    const task = buildTask();
    await seedHistory(first, task);
    expect((await first.repos.tasks.softDelete(task.id)).ok).toBe(true);

    const later = await coldStart(t0Plus(relaunchAfterMs));
    const rows = await allTaskRows(later);
    expect(rows.some((r) => r.id === task.id)).toBe(kept);
    expect(rawCount('SELECT COUNT(*) AS n FROM task WHERE id = ?', [task.id])).toBe(kept ? 1 : 0);
  });

  it('a deletion stamped in the future (clock set back since) is kept until its time has really passed', async () => {
    newDatabaseDir();
    const first = await coldStart(T0);
    const task = buildTask();
    await first.repos.tasks.insert(task, buildSteps(task.id));
    expect((await first.repos.tasks.softDelete(task.id)).ok).toBe(true);
    // The device clock is now a day BEFORE the deletion stamp.
    await coldStart(t0Plus(-DAY_MS));
    expect(rawCount('SELECT COUNT(*) AS n FROM task WHERE id = ?', [task.id])).toBe(1);
  });

  it('the stored deleted_at is the UTC instant with milliseconds and a Z (what the sweep compares)', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await app.repos.tasks.insert(task, buildSteps(task.id));
    await app.repos.tasks.softDelete(task.id);
    const stored = rawCount(`SELECT COUNT(*) AS n FROM task WHERE id = ? AND deleted_at = ?`, [task.id, T0]);
    expect(stored).toBe(1);
  });

  it('the app writes deleted_at in one fixed-width format, so SQL string order equals time order across a day boundary', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const a = buildTask({ name: 'a' });
    const b = buildTask({ name: 'b' });
    await app.repos.tasks.insert(a, buildSteps(a.id));
    await app.repos.tasks.insert(b, buildSteps(b.id));
    setClock('2026-03-09T23:59:59.999Z' as Instant);
    await app.repos.tasks.softDelete(a.id);
    setClock('2026-03-10T00:00:00.000Z' as Instant);
    await app.repos.tasks.softDelete(b.id);
    const order = (await app.repos.tasks.listDeleted()).map((t) => t.name);
    expect(order).toEqual(['b', 'a']);
  });
});

/* ------------------------------------------------------------------ 2. relaunch */

describe('relaunch within 30 days keeps everything', () => {
  it('a deleted item keeps its steps, logs, off marks and as-needed uses across two relaunches', async () => {
    newDatabaseDir();
    const first = await coldStart(T0);
    const task = buildTask();
    await seedHistory(first, task);
    await first.repos.tasks.softDelete(task.id);

    const second = await coldStart(t0Plus(10 * DAY_MS));
    const afterFirst = await second.repos.tasks.listDeleted();
    expect(afterFirst.map((t) => t.id)).toEqual([task.id]);
    expect(afterFirst[0]!.idealSteps).toHaveLength(1);
    expect(afterFirst[0]!.fallbackSteps).toHaveLength(1);
    expect((await second.repos.logs.listForTask(task.id, '2026-01-01' as LocalDate, '2026-12-31' as LocalDate))).toHaveLength(3);
    expect((await second.repos.offDays.listRange('2026-03-05' as LocalDate, '2026-03-05' as LocalDate))).toHaveLength(1);
    expect((await second.repos.asNeeded.listForTask(task.id))).toHaveLength(1);

    const third = await coldStart(t0Plus(20 * DAY_MS));
    expect((await third.repos.tasks.listDeleted()).map((t) => t.id)).toEqual([task.id]);
    expect((await third.repos.logs.listForTask(task.id, '2026-01-01' as LocalDate, '2026-12-31' as LocalDate))).toHaveLength(3);
    expect((await third.repos.offDays.listRange('2026-03-05' as LocalDate, '2026-03-05' as LocalDate))).toHaveLength(1);
    expect((await third.repos.asNeeded.listForTask(task.id))).toHaveLength(1);
    expect(rawCount('SELECT COUNT(*) AS n FROM step WHERE task_id = ?', [task.id])).toBe(2);
    expect(rawCount('SELECT COUNT(*) AS n FROM xp_award WHERE task_id = ?', [task.id])).toBe(2);
  });
});

describe('expired items are removed with the split cascade', () => {
  it('removes the task, its steps, logs, per-task off marks and as-needed uses; keeps XP, unlocks, cycles, whole-day marks; NULLs the widget pointer', async () => {
    newDatabaseDir();
    const first = await coldStart(T0);
    await seedAccountWide(first);
    const task = buildTask();
    await seedHistory(first, task);
    await first.repos.settings.patch({
      widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: task.id }],
    });
    await first.repos.tasks.softDelete(task.id);

    // Before the purge: lifetime XP, level, unlocks and cycles as they stand.
    const xpBefore = await first.repos.progress.lifetimeXp();
    const levelBefore = levelFor(xpBefore).level;
    expect(xpBefore).toBe(16);

    const later = await coldStart(t0Plus(31 * DAY_MS));

    // Gone for good.
    expect(await later.repos.tasks.get(task.id)).toBeNull();
    expect(rawCount('SELECT COUNT(*) AS n FROM task WHERE id = ?', [task.id])).toBe(0);
    expect(rawCount('SELECT COUNT(*) AS n FROM step WHERE task_id = ?', [task.id])).toBe(0);
    expect(rawCount('SELECT COUNT(*) AS n FROM day_log WHERE task_id = ?', [task.id])).toBe(0);
    expect(rawCount('SELECT COUNT(*) AS n FROM off_day_mark WHERE task_id = ?', [task.id])).toBe(0);
    expect(rawCount('SELECT COUNT(*) AS n FROM as_needed_use WHERE task_id = ?', [task.id])).toBe(0);

    // Kept: the XP awards, now with no task.
    expect(rawCount('SELECT COUNT(*) AS n FROM xp_award WHERE task_id IS NULL')).toBe(2);
    expect(rawCount('SELECT COUNT(*) AS n FROM xp_award')).toBe(2);
    expect(await later.repos.progress.lifetimeXp()).toBe(xpBefore);
    expect(levelFor(await later.repos.progress.lifetimeXp()).level).toBe(levelBefore);

    // Kept: achievement unlocks and the finalized cycle record.
    expect((await later.repos.progress.listUnlocks()).map((u) => u.key)).toEqual(['first-day']);
    expect(await later.repos.progress.listCycleRecords()).toHaveLength(1);

    // Kept: the whole-day mark (task_id NULL) only.
    const whole = await later.repos.offDays.listRange('2026-03-04' as LocalDate, '2026-03-04' as LocalDate);
    expect(whole).toHaveLength(1);
    expect(whole[0]!.taskId).toBeNull();

    // Widget pointer cleared, widget itself still configured.
    const widget = (await later.repos.settings.get()).widgets.find((w) => w.size === 'small-one-task');
    expect(widget).toBeDefined();
    expect(widget!.fixedTaskId).toBeNull();
  });

  it('the purge of one expired item leaves a live task and its own XP/history alone', async () => {
    newDatabaseDir();
    const first = await coldStart(T0);
    const old = buildTask({ name: 'old' });
    const live = buildTask({ name: 'live' });
    await seedHistory(first, old);
    await seedHistory(first, live);
    await first.repos.tasks.softDelete(old.id);

    const later = await coldStart(t0Plus(31 * DAY_MS));
    expect((await later.repos.tasks.list()).map((t) => t.id)).toEqual([live.id]);
    expect(rawCount('SELECT COUNT(*) AS n FROM day_log WHERE task_id = ?', [live.id])).toBe(3);
    expect(rawCount('SELECT COUNT(*) AS n FROM xp_award WHERE task_id = ?', [live.id])).toBe(2);
    expect(await later.repos.progress.lifetimeXp()).toBe(32);
  });
});

/* ------------------------------------------------------------------ 3. restore / deleteForever / purge edges */

describe('restore, deleteForever and purgeDeleted on the wrong item', () => {
  it('on a live task: NOT_FOUND from both, and nothing about the task changes', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    const before = await app.repos.tasks.get(task.id);

    const restore = await app.repos.tasks.restore(task.id);
    const forever = await app.repos.tasks.deleteForever(task.id);
    expect(restore).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(forever).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    expect(await app.repos.tasks.get(task.id)).toEqual(before);
    expect(rawCount('SELECT COUNT(*) AS n FROM day_log WHERE task_id = ?', [task.id])).toBe(3);
  });

  it('an unknown id: NOT_FOUND from both, and purge returns 0', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const ghost = newId() as never;
    expect(await app.repos.tasks.restore(ghost)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await app.repos.tasks.deleteForever(ghost)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await app.repos.tasks.purgeDeleted(T0)).toEqual({ ok: true, value: 0 });
  });

  it('purgeDeleted(null) with nothing deleted returns 0 and leaves live tasks alone', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    expect(await app.repos.tasks.purgeDeleted(null)).toEqual({ ok: true, value: 0 });
    expect((await app.repos.tasks.list()).map((t) => t.id)).toEqual([task.id]);
  });

  it('an already-restored id: restore and deleteForever both NOT_FOUND; the restored task is untouched', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    expect((await app.repos.tasks.restore(task.id)).ok).toBe(true);
    expect(await app.repos.tasks.restore(task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await app.repos.tasks.deleteForever(task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await app.repos.tasks.get(task.id))!.deletedAt).toBeNull();
  });

  it('an already-deleted-forever id: restore, deleteForever, softDelete and get all refuse or return nothing', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    expect((await app.repos.tasks.deleteForever(task.id)).ok).toBe(true);
    expect(await app.repos.tasks.restore(task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await app.repos.tasks.deleteForever(task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await app.repos.tasks.softDelete(task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await app.repos.tasks.get(task.id)).toBeNull();
  });

  it('a second softDelete keeps the FIRST deletion time (the 30 days are not restarted)', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    setClock(t0Plus(5 * DAY_MS));
    expect(await app.repos.tasks.softDelete(task.id)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await app.repos.tasks.listDeleted())[0]!.deletedAt).toBe(T0);
  });

  it('restore twice in a row: the second is NOT_FOUND and the item stays live once', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    expect((await app.repos.tasks.restore(task.id)).ok).toBe(true);
    expect((await app.repos.tasks.restore(task.id)).ok).toBe(false);
    expect((await app.repos.tasks.list()).map((t) => t.id)).toEqual([task.id]);
  });

  it('deleteForever twice in a row: the second is NOT_FOUND', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    expect((await app.repos.tasks.deleteForever(task.id)).ok).toBe(true);
    expect((await app.repos.tasks.deleteForever(task.id)).ok).toBe(false);
  });

  it('purgeDeleted(cutoff) counts only what is older than the cutoff, and a second call returns 0', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const old = buildTask({ name: 'old' });
    const fresh = buildTask({ name: 'fresh' });
    await seedHistory(app, old);
    await seedHistory(app, fresh);
    await app.repos.tasks.softDelete(old.id);
    setClock(t0Plus(20 * DAY_MS));
    await app.repos.tasks.softDelete(fresh.id);
    expect(await app.repos.tasks.purgeDeleted(t0Plus(10 * DAY_MS))).toEqual({ ok: true, value: 1 });
    expect(await app.repos.tasks.purgeDeleted(t0Plus(10 * DAY_MS))).toEqual({ ok: true, value: 0 });
    expect((await app.repos.tasks.listDeleted()).map((t) => t.name)).toEqual(['fresh']);
  });

  it('purgeDeleted(null) removes every deleted item, leaves live ones, and keeps XP', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const a = buildTask({ name: 'a' });
    const b = buildTask({ name: 'b' });
    const live = buildTask({ name: 'live' });
    await seedHistory(app, a);
    await seedHistory(app, b);
    await seedHistory(app, live);
    await app.repos.tasks.softDelete(a.id);
    await app.repos.tasks.softDelete(b.id);
    expect(await app.repos.tasks.purgeDeleted(null)).toEqual({ ok: true, value: 2 });
    expect((await app.repos.tasks.list({ includeDeleted: true })).map((t) => t.id)).toEqual([live.id]);
    expect(await app.repos.progress.lifetimeXp()).toBe(16 * 3);
  });

  it('a log written for a task that was deleted for good is refused by the foreign key, not left orphaned', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await app.repos.tasks.insert(task, buildSteps(task.id));
    await app.repos.tasks.softDelete(task.id);
    await app.repos.tasks.deleteForever(task.id);
    const result = await app.repos.logs.upsert({
      id: newId(),
      taskId: task.id,
      date: D,
      chipState: 'done',
      isManualOverride: true,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: null,
      createdAt: T0,
      updatedAt: T0,
    });
    expect(result.ok).toBe(false);
    expect(rawCount('SELECT COUNT(*) AS n FROM day_log WHERE task_id = ?', [task.id])).toBe(0);
  });
});

/* ------------------------------------------------------------------ 4. restore round trip */

describe('restore brings back what deletion kept', () => {
  async function snapshot(app: App, taskId: string) {
    const task = await app.repos.tasks.get(taskId as never);
    const { updatedAt: _ignored, ...rest } = task!;
    return {
      task: rest,
      logs: await app.repos.logs.listForTask(taskId as never, '2026-01-01' as LocalDate, '2026-12-31' as LocalDate),
      offs: await app.repos.offDays.listRange('2026-01-01' as LocalDate, '2026-12-31' as LocalDate),
      asNeeded: await app.repos.asNeeded.listForTask(taskId as never),
      xp: (await app.repos.progress.listXpAwards()).filter((a) => a.taskId === taskId),
      lifetimeXp: await app.repos.progress.lifetimeXp(),
    };
  }

  it('history, steps, XP and settings come back exactly as they were (updatedAt aside)', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    const before = await snapshot(app, task.id);

    setClock(t0Plus(DAY_MS));
    await app.repos.tasks.softDelete(task.id);
    setClock(t0Plus(2 * DAY_MS));
    expect((await app.repos.tasks.restore(task.id)).ok).toBe(true);

    expect(await snapshot(app, task.id)).toEqual(before);
  });

  it('survives many delete / restore cycles without drifting', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    const before = await snapshot(app, task.id);
    for (let i = 0; i < 10; i += 1) {
      setClock(t0Plus((i + 1) * 1000));
      expect((await app.repos.tasks.softDelete(task.id)).ok).toBe(true);
      expect((await app.repos.tasks.restore(task.id)).ok).toBe(true);
    }
    expect(await snapshot(app, task.id)).toEqual(before);
  });

  it('a restored item is not purged by a later launch (its deletion stamp was cleared)', async () => {
    newDatabaseDir();
    const first = await coldStart(T0);
    const task = buildTask();
    await seedHistory(first, task);
    await first.repos.tasks.softDelete(task.id);
    setClock(t0Plus(5 * DAY_MS));
    await first.repos.tasks.restore(task.id);
    const later = await coldStart(t0Plus(60 * DAY_MS));
    expect((await later.repos.tasks.list()).map((t) => t.id)).toEqual([task.id]);
    expect(rawCount('SELECT COUNT(*) AS n FROM day_log WHERE task_id = ?', [task.id])).toBe(3);
  });

  it('delete, restore, then edit: history stays and the edit lands', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask({ name: 'Walk' });
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    await app.repos.tasks.restore(task.id);
    expect((await app.repos.tasks.update(task.id, { name: 'Long walk' }))).toEqual({ ok: true, value: undefined });
    const after = await app.repos.tasks.get(task.id);
    expect(after!.name).toBe('Long walk');
    expect(await app.repos.logs.listForTask(task.id, '2026-01-01' as LocalDate, '2026-12-31' as LocalDate)).toHaveLength(3);
  });

  it('a restored item that had been deleted across a relaunch keeps its rows; restore after the relaunch works', async () => {
    newDatabaseDir();
    const first = await coldStart(T0);
    const task = buildTask();
    await seedHistory(first, task);
    await first.repos.tasks.softDelete(task.id);
    const second = await coldStart(t0Plus(15 * DAY_MS));
    expect((await second.repos.tasks.restore(task.id)).ok).toBe(true);
    expect((await second.repos.tasks.list()).map((t) => t.id)).toEqual([task.id]);
  });
});

/* ------------------------------------------------------------------ 5. while deleted */

describe('while an item is in Recently deleted', () => {
  it('list() hides it, list({includeDeleted}) and listDeleted() show it, get() still returns it', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    expect(await app.repos.tasks.list()).toHaveLength(0);
    expect(await app.repos.tasks.list({ includeDeleted: true })).toHaveLength(1);
    expect((await app.repos.tasks.listDeleted()).map((t) => t.id)).toEqual([task.id]);
    // Documented: get() returns deleted items too. Callers that act on a task must check deletedAt.
    const got = await app.repos.tasks.get(task.id);
    expect(got).not.toBeNull();
    expect(got!.deletedAt).not.toBeNull();
  });

  it('its day logs, XP and whole-day marks still count in the account-wide tables (XP is never retracted)', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    await seedAccountWide(app);
    const task = buildTask();
    await seedHistory(app, task);
    const xpLive = await app.repos.progress.lifetimeXp();
    await app.repos.tasks.softDelete(task.id);
    expect(await app.repos.progress.lifetimeXp()).toBe(xpLive);
    expect((await app.repos.progress.listXpAwards()).filter((a) => a.taskId === task.id)).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ 6. backup / erase / restore */

describe('backup, erase and restore with deleted items', () => {
  async function backupFile(app: App): Promise<string> {
    const result = await app.store.backup();
    if (!result.ok) throw new Error(`backup failed: ${JSON.stringify(result)}`);
    return result.value.uri;
  }

  it('a deleted item inside a backup comes back still deleted, with the same deleted_at', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    setClock(t0Plus(DAY_MS));
    await app.repos.tasks.softDelete(task.id);
    const uri = await backupFile(app);

    // Wipe the store, then restore the backup into it.
    expect((await app.store.eraseAll()).ok).toBe(true);
    expect(await app.repos.tasks.list({ includeDeleted: true })).toHaveLength(0);
    expect((await app.store.restore(uri)).ok).toBe(true);

    expect(await app.repos.tasks.list()).toHaveLength(0);
    const deleted = await app.repos.tasks.listDeleted();
    expect(deleted.map((t) => t.id)).toEqual([task.id]);
    expect(deleted[0]!.deletedAt).toBe(t0Plus(DAY_MS));
    expect(await app.repos.logs.listForTask(task.id, '2026-01-01' as LocalDate, '2026-12-31' as LocalDate)).toHaveLength(3);
  });

  it('a restored-from-backup deleted item expires on the same schedule as the original', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    setClock(t0Plus(DAY_MS));
    await app.repos.tasks.softDelete(task.id);
    const uri = await backupFile(app);
    expect((await app.store.eraseAll()).ok).toBe(true);
    expect((await app.store.restore(uri)).ok).toBe(true);

    // 30 days after the ORIGINAL deletion (day 1 + 30 = day 31), not 30 days after the restore.
    const stillThere = await coldStart(t0Plus(30 * DAY_MS));
    expect((await stillThere.repos.tasks.listDeleted()).map((t) => t.id)).toEqual([task.id]);
    const gone = await coldStart(t0Plus(31 * DAY_MS + 1));
    expect(await gone.repos.tasks.get(task.id)).toBeNull();
  });

  it('a backup holding an item already past its 30 days: restore brings it back, and the next launch removes it', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    const uri = await backupFile(app);
    expect((await app.store.eraseAll()).ok).toBe(true);

    setClock(t0Plus(40 * DAY_MS));
    expect((await app.store.restore(uri)).ok).toBe(true);
    // Restore does not run the sweep: the item is listed until the next launch or until Recently deleted purges it on open.
    expect((await app.repos.tasks.listDeleted()).map((t) => t.id)).toEqual([task.id]);

    const next = await coldStart(t0Plus(40 * DAY_MS));
    expect(await next.repos.tasks.get(task.id)).toBeNull();
  });

  it('erase all removes deleted items and their rows too, and the store is empty afterwards', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    expect((await app.store.eraseAll()).ok).toBe(true);
    expect(await app.repos.tasks.list({ includeDeleted: true })).toHaveLength(0);
    expect(await app.repos.tasks.listDeleted()).toHaveLength(0);
    expect(rawCount('SELECT COUNT(*) AS n FROM day_log')).toBe(0);
    expect(rawCount('SELECT COUNT(*) AS n FROM xp_award')).toBe(0);
  });
});

/* ------------------------------------------------------------------ 7. ordering */

describe('listDeleted ordering', () => {
  it('newest deletion first', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const names = ['first', 'second', 'third'];
    const tasks = names.map((name) => buildTask({ name }));
    for (const t of tasks) await app.repos.tasks.insert(t, buildSteps(t.id));
    for (const [i, t] of tasks.entries()) {
      setClock(t0Plus(i * 1000));
      await app.repos.tasks.softDelete(t.id);
    }
    expect((await app.repos.tasks.listDeleted()).map((t) => t.name)).toEqual(['third', 'second', 'first']);
  });

  it('two items deleted in the same millisecond are both listed (their relative order is not promised)', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const a = buildTask({ name: 'a' });
    const b = buildTask({ name: 'b' });
    await app.repos.tasks.insert(a, buildSteps(a.id));
    await app.repos.tasks.insert(b, buildSteps(b.id));
    setClock(T0);
    await app.repos.tasks.softDelete(a.id);
    await app.repos.tasks.softDelete(b.id);
    const names = (await app.repos.tasks.listDeleted()).map((t) => t.name).sort();
    expect(names).toEqual(['a', 'b']);
  });
});

/* ------------------------------------------------------------------ 8. concurrency */

describe('concurrent actions on the same deleted item', () => {
  it('restore and deleteForever fired together: exactly one wins, and the database agrees with the winner', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    const [restored, forever] = await Promise.all([app.repos.tasks.restore(task.id), app.repos.tasks.deleteForever(task.id)]);
    expect([restored.ok, forever.ok].filter(Boolean)).toHaveLength(1);
    if (restored.ok) {
      expect((await app.repos.tasks.get(task.id))!.deletedAt).toBeNull();
    } else {
      expect(await app.repos.tasks.get(task.id)).toBeNull();
    }
  });

  it('two deleteForever calls fired together remove the item once and never error out of the Result', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const task = buildTask();
    await seedHistory(app, task);
    await app.repos.tasks.softDelete(task.id);
    const results = await Promise.all([app.repos.tasks.deleteForever(task.id), app.repos.tasks.deleteForever(task.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error.code === 'NOT_FOUND')).toHaveLength(1);
  });

  it('an empty-all fired while a restore is in flight leaves the database consistent (the restored item is live and whole)', async () => {
    newDatabaseDir();
    const app = await coldStart(T0);
    const keep = buildTask({ name: 'keep' });
    const gone = buildTask({ name: 'gone' });
    await seedHistory(app, keep);
    await seedHistory(app, gone);
    await app.repos.tasks.softDelete(keep.id);
    await app.repos.tasks.softDelete(gone.id);
    const [restored, purged] = await Promise.all([app.repos.tasks.restore(keep.id), app.repos.tasks.purgeDeleted(null)]);
    expect(restored.ok).toBe(true);
    expect(purged.ok).toBe(true);
    expect((await app.repos.tasks.list()).map((t) => t.id)).toEqual([keep.id]);
    expect(rawCount('SELECT COUNT(*) AS n FROM day_log WHERE task_id = ?', [keep.id])).toBe(3);
  });
});

