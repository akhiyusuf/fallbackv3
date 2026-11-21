/**
 * Ended habits and retired days, against a REAL SQLite file (node:sqlite behind the expo-sqlite
 * double, file-backed). Same harness shape as `recentlyDeleted.test.ts`: a "launch" is a fresh
 * module registry plus a new connection to the same file, and nothing is closed first.
 *
 * Covers migration 8 on a v7 store, `deleteForever(id, keep)` atomicity, `ended_on` round trips,
 * backup/restore of `retired_day` (and older envelopes), and the record view before and after a
 * deleted habit is removed for good.
 */
import { makeTempDir, removeDir, joinPath } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

/** Each test gets its own database directory, so no connection or WAL state leaks between tests. */
function newDatabaseDir(): string {
  const dir = makeTempDir('fallback-retired-days-');
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
    now: () => ((globalThis as { __rdNow?: string }).__rdNow as ReturnType<typeof actual.now>) ?? actual.now(),
  };
});

import { DatabaseSync } from 'node:sqlite';

import { DB_NAME } from '../client';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from '../migrations';
import { newId } from '@/lib/id';
import type { Id, Instant, LocalDate, RetiredDay, Step, Task, TaskWithSteps } from '@/types';

type App = typeof import('@/db');
type Internal = typeof import('@/queries/internal');
type Domain = typeof import('@/domain');

const DAY_MS = 24 * 60 * 60 * 1000;
/** Noon UTC, so the calendar day is the same in every timezone from UTC-11 to UTC+11. */
const T0 = '2026-03-10T12:00:00.000Z' as Instant;
const CREATED = '2026-03-01T00:00:00.000Z';
/** The "today" every record read uses in these tests. Fixed, so the record is deterministic. */
const TODAY = '2026-04-10' as LocalDate;

function at(ms: number): Instant {
  return new Date(ms).toISOString() as Instant;
}
function plusDays(instant: Instant, days: number): Instant {
  return at(new Date(instant).getTime() + days * DAY_MS);
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

/** A launch that opens the store exactly as S01 does, but does NOT run the expiry sweep. */
async function reopen(clockAt: Instant): Promise<App> {
  setClock(clockAt);
  const app = launch();
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error(`store did not open ready: ${JSON.stringify(opened)}`);
  return app;
}

function internal(): Internal {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/queries/internal') as Internal;
}
function domain(): Domain {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/domain') as Domain;
}
function fileSystem() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system/legacy') as typeof import('../testSupport/fileSystemTestDouble');
}

function currentDir(): string {
  return (globalThis as { __rdDir?: string }).__rdDir as string;
}
/** A raw connection to the database file, the way an outside tool would see it. Caller closes it. */
function rawConnection(): DatabaseSync {
  return new DatabaseSync(joinPath(currentDir(), DB_NAME));
}
function rawCount(sql: string, params: unknown[] = []): number {
  const connection = rawConnection();
  try {
    return Number((connection.prepare(sql).get(...params) as { n: number }).n);
  } finally {
    connection.close();
  }
}

function buildTask(overrides: Partial<Task> = {}): Task {
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
    createdAt: CREATED as Instant,
    updatedAt: CREATED as Instant,
    deletedAt: null,
    snoozable: true,
    endedOn: null,
    ...overrides,
  } as Task;
}

function buildSteps(taskId: string): Step[] {
  return [
    { id: newId(), taskId: taskId as Id, role: 'ideal', text: 'Walk 20 min', position: 0, dueWeekdays: null },
    { id: newId(), taskId: taskId as Id, role: 'fallback', text: 'Stretch 2 min', position: 0, dueWeekdays: null },
  ];
}

type App_Repos = App['repos'];

/** Logs a day for a task as the person would (done = ideal, fallback, skip = missed). */
async function logDay(repos: App_Repos, taskId: Id, date: string, chipState: 'done' | 'fallback' | 'skip' | 'todo', stamp: Instant = at(new Date(T0).getTime())) {
  const result = await repos.logs.upsert({
    id: newId(),
    taskId,
    date: date as LocalDate,
    chipState,
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: stamp,
    updatedAt: stamp,
  });
  expect(result.ok).toBe(true);
}

async function creditXp(repos: App_Repos, taskId: Id, date: string, kind: 'ideal' | 'fallback', amount: number): Promise<void> {
  const cycle = await repos.cycleState.get();
  const result = await repos.progress.appendXpAward({
    id: newId(),
    taskId,
    date: date as LocalDate,
    kind,
    amount,
    cycleId: cycle!.currentCycleId,
    createdAt: T0,
  });
  expect(result.ok).toBe(true);
}

/**
 * A habit with real history: steps, day logs (done, fallback, skip), an off mark, XP. Created on
 * CREATED, so the record starts at that day.
 */
async function seedHabitWithHistory(app: App, name: string): Promise<Task> {
  const { repos } = app;
  const task = buildTask({ name });
  expect((await repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);
  await logDay(repos, task.id, '2026-03-02', 'done');
  await logDay(repos, task.id, '2026-03-03', 'fallback');
  await logDay(repos, task.id, '2026-03-04', 'skip');
  expect((await repos.offDays.mark({ id: newId(), date: '2026-03-05' as LocalDate, taskId: task.id, priorChipState: null, createdAt: T0 })).ok).toBe(true);
  await creditXp(repos, task.id, '2026-03-02', 'ideal', 10);
  await creditXp(repos, task.id, '2026-03-03', 'fallback', 6);
  return task;
}

/**
 * The record as the person's consistency reads see it: every (date, outcome) that counts, sorted.
 * Chip state is not part of the comparison; the outcome is what consistency reads.
 */
async function recordSignature(app: App): Promise<string[]> {
  const occs = await internal().resolveRecordOccurrences(app.repos, TODAY, TODAY);
  return occs
    .filter((o) => o.outcome !== 'not-due')
    .map((o) => `${o.date} ${o.outcome}`)
    .sort();
}

afterEach(() => {
  setClock(null);
});

// ---------------------------------------------------------------------------------------------
// 1. Migration 8 on an existing v7 store
// ---------------------------------------------------------------------------------------------

describe('migration 8 on an existing v7 store', () => {
  it('existing tasks get ended_on NULL, retired_day exists and is empty, and a soft-deleted old task is NOT removed on open', async () => {
    const dir = newDatabaseDir();
    const raw = new DatabaseSync(joinPath(dir, DB_NAME));
    // The schema exactly as a v7 app left it: migrations 1..7 only.
    for (const m of MIGRATIONS.filter((x) => x.version <= 7)) {
      raw.exec(m.up);
      raw.exec(`PRAGMA user_version = ${m.version};`);
    }
    raw.exec(`INSERT INTO settings (id, tenure_anchor_date, updated_at) VALUES (1, '2026-01-01', '2026-01-01T00:00:00.000Z')`);
    raw.exec(`INSERT INTO cycle_state (id, current_cycle_id, cadence, start_date, end_date) VALUES (1, 'cyc-v7', 'monthly', '2026-03-01', '2026-03-31')`);
    raw.exec(
      `INSERT INTO task (id, type, name, icon, color, is_as_needed, cadence_kind, doses_per_day, is_tracked, created_at, updated_at, snoozable, is_note)
       VALUES ('t-live-v7', 'routine', 'Old live habit', 'Repeat', 'forge-orange', 0, 'daily', 1, 1, '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 1, 0)`,
    );
    raw.exec(
      `INSERT INTO task (id, type, name, icon, color, is_as_needed, cadence_kind, doses_per_day, is_tracked, created_at, updated_at, snoozable, is_note, deleted_at)
       VALUES ('t-old-deleted-v7', 'routine', 'Old deleted habit', 'Repeat', 'forge-orange', 0, 'daily', 1, 1, '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 1, 0, '2026-01-01T00:00:00.000Z')`,
    );
    raw.close();

    const app = await reopen(T0);

    // Migration 8 applied.
    const check = rawConnection();
    try {
      expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(CURRENT_SCHEMA_VERSION);
      const cols = (check.prepare(`SELECT name FROM pragma_table_info('task')`).all() as { name: string }[]).map((c) => c.name);
      expect(cols).toContain('ended_on');
      const retiredCols = (check.prepare(`SELECT name FROM pragma_table_info('retired_day')`).all() as { name: string }[]).map((c) => c.name);
      expect(retiredCols).toEqual(expect.arrayContaining(['id', 'date', 'outcome', 'retired_at']));
      expect((check.prepare(`SELECT COUNT(*) AS n FROM retired_day`).get() as { n: number }).n).toBe(0);
      expect((check.prepare(`SELECT name FROM sqlite_master WHERE name = 'idx_retired_day_date'`).get() as unknown) ?? null).not.toBeNull();
    } finally {
      check.close();
    }

    // Existing tasks read back with no end date.
    const live = await app.repos.tasks.get('t-live-v7' as Id);
    expect(live).not.toBeNull();
    expect(live!.endedOn).toBeNull();
    expect(await app.repos.retiredDays.list()).toEqual([]);

    // Opening does not delete anything: the old deleted habit is still in Recently deleted.
    const deleted = await app.repos.tasks.listDeleted();
    expect(deleted.map((t) => t.id)).toEqual(['t-old-deleted-v7']);
  });

  it('a second launch on a v8 store is a no-op: the version stays 8 and nothing is re-created', async () => {
    newDatabaseDir();
    await reopen(T0);
    const app = await reopen(T0);
    expect(await app.repos.retiredDays.list()).toEqual([]);
    const check = rawConnection();
    try {
      expect((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(CURRENT_SCHEMA_VERSION);
    } finally {
      check.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2. deleteForever(id, keep)
// ---------------------------------------------------------------------------------------------

describe('deleteForever(id, keep) — one transaction', () => {
  it('a LIVE task: NOT_FOUND, nothing written to retired_day, and the task is untouched', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = await seedHabitWithHistory(app, 'Live habit');
    const keep: RetiredDay[] = [{ date: '2026-03-02' as LocalDate, outcome: 'ideal', retiredAt: T0 }];

    const result = await app.repos.tasks.deleteForever(task.id, keep);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    expect(await app.repos.retiredDays.list()).toEqual([]);
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(0);
    expect(await app.repos.tasks.get(task.id)).not.toBeNull();
    expect((await app.repos.logs.listForTask(task.id, '2026-03-01' as LocalDate, '2026-03-31' as LocalDate)).length).toBe(3);
  });

  it('an UNKNOWN id: NOT_FOUND and no retired rows', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const keep: RetiredDay[] = [{ date: '2026-03-02' as LocalDate, outcome: 'missed', retiredAt: T0 }];
    const result = await app.repos.tasks.deleteForever('no-such-task' as Id, keep);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(0);
  });

  it('a soft-deleted task: writes EXACTLY the kept rows, removes the task and its children, keeps XP with a NULL task', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = await seedHabitWithHistory(app, 'Deleted habit');
    expect((await app.repos.tasks.softDelete(task.id)).ok).toBe(true);
    const keep: RetiredDay[] = [
      { date: '2026-03-02' as LocalDate, outcome: 'ideal', retiredAt: T0 },
      { date: '2026-03-03' as LocalDate, outcome: 'fallback', retiredAt: T0 },
      { date: '2026-03-04' as LocalDate, outcome: 'missed', retiredAt: T0 },
      { date: '2026-03-05' as LocalDate, outcome: 'off', retiredAt: T0 },
    ];

    const result = await app.repos.tasks.deleteForever(task.id, keep);
    expect(result.ok).toBe(true);

    const rows = await app.repos.retiredDays.list();
    expect(rows).toEqual(keep.map((k) => ({ date: k.date, outcome: k.outcome, retiredAt: k.retiredAt })));
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(4);
    // No link back to the task anywhere in the retired rows.
    const cols = rawConnection();
    try {
      const names = (cols.prepare(`SELECT name FROM pragma_table_info('retired_day')`).all() as { name: string }[]).map((c) => c.name);
      expect(names).not.toContain('task_id');
    } finally {
      cols.close();
    }

    expect(await app.repos.tasks.get(task.id)).toBeNull();
    expect(rawCount(`SELECT COUNT(*) AS n FROM step WHERE task_id = ?`, [task.id])).toBe(0);
    expect(rawCount(`SELECT COUNT(*) AS n FROM day_log WHERE task_id = ?`, [task.id])).toBe(0);
    expect(rawCount(`SELECT COUNT(*) AS n FROM off_day_mark WHERE task_id = ?`, [task.id])).toBe(0);
    // XP stays (lifetime XP never drops), its task reference is cleared.
    expect(rawCount(`SELECT COUNT(*) AS n FROM xp_award WHERE task_id IS NULL`)).toBe(2);
    expect(await app.repos.progress.lifetimeXp()).toBe(16);
  });

  it('a second deleteForever on the same id is NOT_FOUND and adds no rows', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = await seedHabitWithHistory(app, 'Twice');
    await app.repos.tasks.softDelete(task.id);
    const keep: RetiredDay[] = [{ date: '2026-03-02' as LocalDate, outcome: 'ideal', retiredAt: T0 }];
    expect((await app.repos.tasks.deleteForever(task.id, keep)).ok).toBe(true);
    const again = await app.repos.tasks.deleteForever(task.id, keep);
    expect(again.ok).toBe(false);
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(1);
  });

  it('a bad row in the MIDDLE of keep (CHECK violation on outcome) rolls back the rows before it: nothing is written and the task survives', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = await seedHabitWithHistory(app, 'Atomic');
    await app.repos.tasks.softDelete(task.id);
    const keep = [
      { date: '2026-03-02' as LocalDate, outcome: 'ideal', retiredAt: T0 },
      { date: '2026-03-03' as LocalDate, outcome: 'bogus' as never, retiredAt: T0 },
    ] as RetiredDay[];

    const result = await app.repos.tasks.deleteForever(task.id, keep);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('WRITE_FAILED');
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(0);
    expect(await app.repos.tasks.get(task.id)).not.toBeNull();
    expect(rawCount(`SELECT COUNT(*) AS n FROM step WHERE task_id = ?`, [task.id])).toBe(2);
  });

  it('a failure at the DELETE step itself (a trigger aborts it) rolls back the retired rows already inserted; a retry then writes exactly the kept rows', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = await seedHabitWithHistory(app, 'Trigger');
    await app.repos.tasks.softDelete(task.id);
    const keep: RetiredDay[] = [
      { date: '2026-03-02' as LocalDate, outcome: 'ideal', retiredAt: T0 },
      { date: '2026-03-03' as LocalDate, outcome: 'fallback', retiredAt: T0 },
    ];

    // Simulate a failure after the keep inserts have run, at the task DELETE.
    const raw = rawConnection();
    raw.exec(`CREATE TRIGGER abort_task_delete BEFORE DELETE ON task BEGIN SELECT RAISE(ABORT, 'simulated delete failure'); END;`);
    raw.close();

    const failed = await app.repos.tasks.deleteForever(task.id, keep);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe('WRITE_FAILED');
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(0);
    expect(await app.repos.tasks.get(task.id)).not.toBeNull();

    const drop = rawConnection();
    drop.exec(`DROP TRIGGER abort_task_delete;`);
    drop.close();

    expect((await app.repos.tasks.deleteForever(task.id, keep)).ok).toBe(true);
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(2);
    expect(await app.repos.tasks.get(task.id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// 3. ended_on round trips
// ---------------------------------------------------------------------------------------------

describe('task.ended_on round trips', () => {
  it('insert, get, list, update (merge keeps it), update to a new date, and update back to null', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const { repos } = app;
    const task = buildTask({ endedOn: '2026-03-05' as LocalDate });
    expect((await repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);

    expect((await repos.tasks.get(task.id))!.endedOn).toBe('2026-03-05');
    expect((await repos.tasks.list()).find((t) => t.id === task.id)!.endedOn).toBe('2026-03-05');

    // A patch that does not mention endedOn keeps it.
    expect((await repos.tasks.update(task.id, { name: 'Renamed' })).ok).toBe(true);
    const renamed = (await repos.tasks.get(task.id))!;
    expect(renamed.name).toBe('Renamed');
    expect(renamed.endedOn).toBe('2026-03-05');

    expect((await repos.tasks.update(task.id, { endedOn: '2026-03-07' as LocalDate })).ok).toBe(true);
    expect((await repos.tasks.get(task.id))!.endedOn).toBe('2026-03-07');

    expect((await repos.tasks.update(task.id, { endedOn: null })).ok).toBe(true);
    expect((await repos.tasks.get(task.id))!.endedOn).toBeNull();
  });

  it('a task inserted without an end date reads back null', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = buildTask();
    expect((await app.repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);
    expect((await app.repos.tasks.get(task.id))!.endedOn).toBeNull();
  });

  it('duplicate of an ENDED habit resets endedOn to null, while the source keeps its end date', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const source = buildTask({ name: 'Ended source', endedOn: '2026-03-05' as LocalDate });
    expect((await app.repos.tasks.insert(source, buildSteps(source.id))).ok).toBe(true);

    const copy = await app.repos.tasks.duplicate(source.id);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    const dup = (await app.repos.tasks.get(copy.value))!;
    expect(dup.endedOn).toBeNull();
    expect(dup.name).toBe('Ended source');
    expect(dup.idealSteps).toHaveLength(1);
    expect((await app.repos.tasks.get(source.id))!.endedOn).toBe('2026-03-05');
  });
});

// ---------------------------------------------------------------------------------------------
// 4. Backup, erase and restore
// ---------------------------------------------------------------------------------------------

describe('backup -> erase -> restore keeps retired days and ended habits', () => {
  it('a v8 backup with ended habits and retired days restores them exactly (record signature unchanged)', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const ended = buildTask({ name: 'Paused', endedOn: '2026-03-05' as LocalDate });
    expect((await app.repos.tasks.insert(ended, buildSteps(ended.id))).ok).toBe(true);
    await logDay(app.repos, ended.id, '2026-03-02', 'done');
    const gone = await seedHabitWithHistory(app, 'Gone for good');
    expect((await app.repos.tasks.softDelete(gone.id)).ok).toBe(true);
    const { retireDeleted } = internal();
    expect((await retireDeleted(app.repos, 'all', T0)).ok).toBe(true);

    const before = await recordSignature(app);
    const retiredBefore = await app.repos.retiredDays.list();
    expect(retiredBefore.length).toBeGreaterThan(0);

    const backup = await app.store.backup();
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect((await app.store.eraseAll()).ok).toBe(true);
    expect(await app.repos.retiredDays.list()).toEqual([]);

    const restored = await app.store.restore(backup.value.uri);
    expect(restored.ok).toBe(true);

    expect(await app.repos.retiredDays.list()).toEqual(retiredBefore);
    expect((await app.repos.tasks.get(ended.id))!.endedOn).toBe('2026-03-05');
    expect(await recordSignature(app)).toEqual(before);
  });

  it('a v7 envelope (schemaVersion 7, no retired_day key, no ended_on on tasks) validates and restores; the record reverts to that state', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const live = buildTask({ name: 'Live then' });
    expect((await app.repos.tasks.insert(live, buildSteps(live.id))).ok).toBe(true);
    await logDay(app.repos, live.id, '2026-03-02', 'done');
    const deleted = await seedHabitWithHistory(app, 'Deleted then');
    expect((await app.repos.tasks.softDelete(deleted.id)).ok).toBe(true);

    // The state a v7 app would have backed up: no retired days, no ended habits.
    const backup = await app.store.backup();
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    const v7State = await recordSignature(app);
    const fs = fileSystem();
    const envelope = JSON.parse(await fs.readAsStringAsync(backup.value.uri));
    const v7 = {
      ...envelope,
      schemaVersion: 7,
      tables: {
        ...envelope.tables,
        task: envelope.tables.task.map((row: Record<string, unknown>) => {
          const { ended_on: _ignored, ...rest } = row;
          void _ignored;
          return rest;
        }),
      },
    };
    delete v7.tables.retired_day;
    const v7Uri = 'file:///test-documents/v7-backup.fallbackbak';
    await fs.writeAsStringAsync(v7Uri, JSON.stringify(v7));

    // Move on: end one habit and retire the other, so the restore has real work to undo.
    expect((await app.repos.tasks.update(live.id, { endedOn: '2026-03-04' as LocalDate })).ok).toBe(true);
    expect((await internal().retireDeleted(app.repos, 'all', T0)).ok).toBe(true);
    expect((await app.repos.retiredDays.list()).length).toBeGreaterThan(0);

    const restored = await app.store.restore(v7Uri);
    expect(restored.ok).toBe(true);

    expect(await app.repos.retiredDays.list()).toEqual([]);
    expect((await app.repos.tasks.get(live.id))!.endedOn).toBeNull();
    expect((await app.repos.tasks.listDeleted()).map((t) => t.id)).toEqual([deleted.id]);
    expect(await recordSignature(app)).toEqual(v7State);
  });

  it('a v8 envelope MISSING retired_day is rejected, and existing data is left untouched', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const gone = await seedHabitWithHistory(app, 'Retired already');
    expect((await app.repos.tasks.softDelete(gone.id)).ok).toBe(true);
    expect((await internal().retireDeleted(app.repos, 'all', T0)).ok).toBe(true);
    const retiredBefore = await app.repos.retiredDays.list();
    expect(retiredBefore.length).toBeGreaterThan(0);

    const backup = await app.store.backup();
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    const fs = fileSystem();
    const envelope = JSON.parse(await fs.readAsStringAsync(backup.value.uri));
    delete envelope.tables.retired_day;
    expect(envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const badUri = 'file:///test-documents/v8-missing-retired.fallbackbak';
    await fs.writeAsStringAsync(badUri, JSON.stringify(envelope));

    const result = await app.store.restore(badUri);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('retired_day');
    }
    expect(await app.repos.retiredDays.list()).toEqual(retiredBefore);
    expect(await app.repos.tasks.listDeleted()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// 5. retireDeleted after a real reopen: the record keeps the habit's settled days
// ---------------------------------------------------------------------------------------------

describe('retireDeleted after a real reopen', () => {
  /** Seeds a deleted habit (and a live one) on the first launch, then the app is closed. */
  async function seedDeletedHabitAndLiveOne(): Promise<{ deleted: Task; live: Task }> {
    const app = await reopen(T0);
    const deleted = await seedHabitWithHistory(app, 'Deleted, with history');
    // A day logged on the deletion day itself counts; the deletion day un-logged would not.
    await logDay(app.repos, deleted.id, '2026-03-10', 'done');
    await creditXp(app.repos, deleted.id, '2026-03-10', 'ideal', 10);
    expect((await app.repos.tasks.softDelete(deleted.id)).ok).toBe(true);
    const live = buildTask({ name: 'Still running' });
    expect((await app.repos.tasks.insert(live, buildSteps(live.id))).ok).toBe(true);
    return { deleted, live };
  }

  it('expired after 30 days: the record is unchanged by removal, the task is gone, XP and start date are kept', async () => {
    newDatabaseDir();
    const { deleted, live } = await seedDeletedHabitAndLiveOne();

    const expiredAt = plusDays(T0, 31);
    const app = await reopen(expiredAt);
    // Real reopen: the task is still there (the store no longer deletes on open).
    expect((await app.repos.tasks.listDeleted()).map((t) => t.id)).toEqual([deleted.id]);
    const sigBefore = await recordSignature(app);
    const xpBefore = await app.repos.progress.lifetimeXp();
    const startBefore = await internal().recordStartDate(app.repos);
    expect(sigBefore).toEqual(expect.arrayContaining(['2026-03-02 ideal', '2026-03-03 fallback', '2026-03-04 missed', '2026-03-05 off', '2026-03-10 ideal']));
    expect(xpBefore).toBe(26);

    const removed = await internal().retireDeleted(app.repos, 'expired', expiredAt);
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.value).toBe(1);

    expect(await recordSignature(app)).toEqual(sigBefore);
    expect(await app.repos.progress.lifetimeXp()).toBe(xpBefore);
    expect(await internal().recordStartDate(app.repos)).toBe(startBefore);
    expect(await app.repos.tasks.get(deleted.id)).toBeNull();
    expect((await app.repos.tasks.list({ includeDeleted: true })).map((t) => t.id)).toEqual([live.id]);
    // Retired days hold only what the record needs: no days after the deletion day.
    const retired = await app.repos.retiredDays.list();
    expect(retired.map((r) => r.date)).not.toContain('2026-03-11');
    expect(retired.every((r) => ['ideal', 'fallback', 'missed', 'off'].includes(r.outcome))).toBe(true);
    expect(retired.length).toBeGreaterThan(0);
  });

  it('NOT removed before 30 days: the expiry sweep changes nothing at day 29', async () => {
    newDatabaseDir();
    await seedDeletedHabitAndLiveOne();
    const app = await reopen(plusDays(T0, 29));
    const sigBefore = await recordSignature(app);
    const removed = await internal().retireDeleted(app.repos, 'expired', plusDays(T0, 29));
    expect(removed.ok && removed.value).toBe(0);
    expect(await recordSignature(app)).toEqual(sigBefore);
    expect(await app.repos.retiredDays.list()).toEqual([]);
    expect(await app.repos.tasks.listDeleted()).toHaveLength(1);
  });

  it('"Delete all forever" (retireDeleted all) keeps the same record, and a second run removes nothing more', async () => {
    newDatabaseDir();
    await seedDeletedHabitAndLiveOne();
    const app = await reopen(plusDays(T0, 2));
    const sigBefore = await recordSignature(app);
    const xpBefore = await app.repos.progress.lifetimeXp();

    const first = await internal().retireDeleted(app.repos, 'all', plusDays(T0, 2));
    expect(first.ok && first.value).toBe(1);
    expect(await recordSignature(app)).toEqual(sigBefore);
    expect(await app.repos.progress.lifetimeXp()).toBe(xpBefore);

    const retiredCount = rawCount(`SELECT COUNT(*) AS n FROM retired_day`);
    const second = await internal().retireDeleted(app.repos, 'all', plusDays(T0, 2));
    expect(second.ok && second.value).toBe(0);
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(retiredCount);
  });
});

// ---------------------------------------------------------------------------------------------
// 6. Other suspicious edges in these paths
// ---------------------------------------------------------------------------------------------

describe('edges in the record view', () => {
  it('an ENDED habit counts only up to its end date, even when a day after it was logged, and that holds after it is removed for good', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const { repos } = app;
    const task = buildTask({ name: 'Ended then deleted' });
    expect((await repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);
    await logDay(repos, task.id, '2026-03-02', 'done');
    await logDay(repos, task.id, '2026-03-03', 'done');
    expect((await repos.tasks.update(task.id, { endedOn: '2026-03-04' as LocalDate })).ok).toBe(true);
    // A day logged after the end must not count.
    await logDay(repos, task.id, '2026-03-06', 'done');

    const liveSig = await recordSignature(app);
    expect(liveSig.some((line) => line.startsWith('2026-03-06'))).toBe(false);
    expect(liveSig).toEqual(expect.arrayContaining(['2026-03-02 ideal', '2026-03-03 ideal', '2026-03-04 missed']));

    expect((await repos.tasks.softDelete(task.id)).ok).toBe(true);
    const deletedSig = await recordSignature(app);
    expect(deletedSig.some((line) => line.startsWith('2026-03-06'))).toBe(false);

    expect((await internal().retireDeleted(repos, 'all', T0)).ok).toBe(true);
    const after = await recordSignature(app);
    expect(after).toEqual(deletedSig);
    expect(after.some((line) => line.startsWith('2026-03-05') || line.startsWith('2026-03-06'))).toBe(false);
  });

  it('two habits removed forever on the same day both keep their day: the record shows two rows, not one', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    for (const name of ['First', 'Second']) {
      const task = buildTask({ name });
      expect((await app.repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);
      await logDay(app.repos, task.id, '2026-03-02', 'done');
      expect((await app.repos.tasks.softDelete(task.id)).ok).toBe(true);
    }
    const before = await recordSignature(app);
    expect(before.filter((line) => line === '2026-03-02 ideal')).toHaveLength(2);

    expect((await internal().retireDeleted(app.repos, 'all', T0)).ok).toBe(true);

    expect(await recordSignature(app)).toEqual(before);
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day WHERE date = '2026-03-02'`)).toBe(2);
  });

  it('a comeback (missed, then showed up the next day) on a deleted habit still earns the fallback-comeback badge after the habit is removed for good', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = buildTask({ name: 'Comeback habit' });
    expect((await app.repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);
    // 2026-03-06 has no log (missed), 2026-03-07 is a fallback: the comeback.
    await logDay(app.repos, task.id, '2026-03-07', 'fallback');
    expect((await app.repos.tasks.softDelete(task.id)).ok).toBe(true);

    const comebackKeys = async (a: App) => {
      const occs = await internal().resolveRecordOccurrences(a.repos, TODAY, TODAY);
      const unlocks = domain().reconcileAchievements({
        occurrences: occs,
        tenureAnchor: '2026-03-01' as LocalDate,
        today: TODAY,
        alreadyUnlocked: [],
        now: T0,
      });
      return unlocks.map((u) => u.key);
    };

    const before = await comebackKeys(app);
    expect(before).toContain('fallback-comeback');
    // Nothing has reconciled it into the stored badges yet: retiring is what must keep it.
    expect((await app.repos.progress.listUnlocks()).map((u) => u.key)).not.toContain('fallback-comeback');

    expect((await internal().retireDeleted(app.repos, 'all', T0)).ok).toBe(true);

    // The record no longer has the habit's days, so the badge must already be persisted.
    expect((await app.repos.tasks.listDeleted())).toHaveLength(0);
    expect((await app.repos.progress.listUnlocks()).map((u) => u.key)).toContain('fallback-comeback');
    // And a relaunch keeps it (it is never revoked).
    const later = await reopen(plusDays(T0, 40));
    expect((await later.repos.progress.listUnlocks()).map((u) => u.key)).toContain('fallback-comeback');
  });

  it('recordStartDate is the habit creation day before and after removal, not a later retired day', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = await seedHabitWithHistory(app, 'Start date');
    expect((await app.repos.tasks.softDelete(task.id)).ok).toBe(true);
    const before = await internal().recordStartDate(app.repos);
    expect((await internal().retireDeleted(app.repos, 'all', T0)).ok).toBe(true);
    expect(await internal().recordStartDate(app.repos)).toBe(before);
    expect(before).toBe('2026-03-01');
  });

  it('a habit started again after ending: days it was away are marked off and read as off, not missed', async () => {
    newDatabaseDir();
    const app = await reopen(T0);
    const task = buildTask({ name: 'Paused', endedOn: '2026-03-04' as LocalDate });
    expect((await app.repos.tasks.insert(task, buildSteps(task.id))).ok).toBe(true);
    // The same helper the Start again mutation uses for the away days.
    const resumed = { ...task, endedOn: null, idealSteps: [], fallbackSteps: [] } as TaskWithSteps;
    const away = await internal().markAwayDaysOff(app.repos, resumed, '2026-03-05' as LocalDate, '2026-03-07' as LocalDate);
    expect(away.ok).toBe(true);
    // Same order as the Start again mutation: away days marked first, then the end date cleared.
    expect((await app.repos.tasks.update(task.id, { endedOn: null })).ok).toBe(true);
    const sig = await recordSignature(app);
    expect(sig).toEqual(expect.arrayContaining(['2026-03-05 off', '2026-03-06 off', '2026-03-07 off']));
  });
});
