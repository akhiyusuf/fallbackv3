/**
 * Edge-case storage campaign (review/EDGE-BRIEF.md, area 19). Real SQLite through the same
 * file-backed expo-sqlite double as `retiredDays.test.ts`: every "launch" is a fresh module
 * registry and a new connection to the same database file, and old schema versions are built
 * by running the real migration SQL, not by hand-written DDL.
 */
import { makeTempDir, removeDir, joinPath } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

function newDatabaseDir(): string {
  const dir = makeTempDir('fallback-edge-storage-');
  createdDirs.push(dir);
  (globalThis as { __esDir?: string }).__esDir = dir;
  return dir;
}

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __esDir?: string }).__esDir,
  }),
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));
jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => {
  const store = ((globalThis as { __esSecure?: Map<string, string> }).__esSecure ??= new Map<string, string>());
  return {
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
});

import { DatabaseSync } from 'node:sqlite';

import { DB_NAME } from '../client';
import { MIGRATIONS } from '../migrations';
import { newId } from '@/lib/id';
import type { Id, Instant, LocalDate, Settings, Task, XpAward } from '@/types';

type App = typeof import('@/db');
type FileSystemDouble = typeof import('../testSupport/fileSystemTestDouble');

const CURRENT = MIGRATIONS[MIGRATIONS.length - 1]!.version;
const T_CREATED = '2025-01-02T09:00:00.000Z' as Instant;
const T_UPDATED = '2025-06-30T20:00:00.000Z' as Instant;
const MONTH_FROM = '2025-06-01' as LocalDate;
const MONTH_TO = '2025-06-30' as LocalDate;

function currentDir(): string {
  return (globalThis as { __esDir?: string }).__esDir as string;
}
function dbPath(): string {
  return joinPath(currentDir(), DB_NAME);
}
function secureStore(): Map<string, string> {
  const g = globalThis as { __esSecure?: Map<string, string> };
  g.__esSecure ??= new Map<string, string>();
  return g.__esSecure;
}
function fileSystem(): FileSystemDouble {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system/legacy') as FileSystemDouble;
}
/** A fresh app launch: new modules, a new connection, nothing closed first. */
function launch(): App {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/db') as App;
}
async function openReady(): Promise<App> {
  const app = launch();
  const opened = await app.store.open();
  expect(opened).toEqual({ ok: true, value: 'ready' });
  return app;
}
function rawConnection(): DatabaseSync {
  return new DatabaseSync(dbPath());
}
function userVersion(): number {
  const c = rawConnection();
  try {
    return Number((c.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  } finally {
    c.close();
  }
}
function rawCount(sql: string, params: unknown[] = []): number {
  const c = rawConnection();
  try {
    return Number((c.prepare(sql).get(...params) as { n: number }).n);
  } finally {
    c.close();
  }
}

function addDays(date: string, days: number): LocalDate {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10) as LocalDate;
}

/** Runs the real migration SQL up to `version` on a raw file, as an old app build would have. */
function buildStoreAtVersion(version: number, seed: (c: DatabaseSync) => void): void {
  const c = rawConnection();
  try {
    c.exec('PRAGMA foreign_keys = ON;');
    c.exec('PRAGMA journal_mode = WAL;');
    for (const m of MIGRATIONS.filter((x) => x.version <= version)) {
      c.exec(m.up);
    }
    c.exec(`PRAGMA user_version = ${version};`);
    seed(c);
  } finally {
    c.close();
  }
}

/** Inserts only the columns that exist at the schema version the row is written for. */
function insertRow(c: DatabaseSync, table: string, row: Record<string, unknown>): void {
  const existing = new Set(
    (c.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[]).map((r) => r.name),
  );
  const keys = Object.keys(row).filter((k) => existing.has(k));
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  c.prepare(sql).run(...(keys.map((k) => row[k]) as never[]));
}

/**
 * The same realistic household of data at every version: a running routine with a month of
 * logs, a to-do with a note, a soft-deleted habit, XP for each done day, a whole-day off mark.
 * Returns the expected lifetime XP so the upgrade test can compare against it.
 */
function seedRealisticData(c: DatabaseSync): { doneDays: number } {
  insertRow(c, 'settings', {
    id: 1,
    theme: 'dark',
    accent: 'berry',
    tenure_anchor_date: '2025-01-02',
    cycle_cadence: 'weekly',
    notif_master: 1,
    notif_routine_due: 1,
    notif_digest_time: '07:30',
    updated_at: T_UPDATED,
  });
  insertRow(c, 'cycle_state', {
    id: 1,
    current_cycle_id: 'cyc-1',
    cadence: 'weekly',
    start_date: '2025-06-01',
    end_date: '2025-06-07',
  });
  const taskBase = {
    icon: 'Repeat',
    color: 'indigo',
    is_as_needed: 0,
    doses_per_day: 1,
    is_tracked: 0,
    created_at: T_CREATED,
    updated_at: T_UPDATED,
  };
  insertRow(c, 'task', {
    ...taskBase,
    id: 't-read',
    type: 'routine',
    name: 'Read 📚 "twice" daily\nsecond line',
    note: null,
    cadence_kind: 'daily',
    importance: 'high',
    necessity: 'must-do',
    deleted_at: null,
  });
  insertRow(c, 'task', {
    ...taskBase,
    id: 't-dentist',
    type: 'todo',
    name: 'Call the dentist',
    note: 'bring the card',
    color: 'berry',
    cadence_kind: null,
    todo_done_at: null,
    deleted_at: null,
  });
  insertRow(c, 'task', {
    ...taskBase,
    id: 't-old',
    type: 'routine',
    name: 'Old habit',
    cadence_kind: 'daily',
    deleted_at: '2025-05-20T10:00:00.000Z',
  });
  insertRow(c, 'step', { id: 's-read-1', task_id: 't-read', role: 'ideal', text: 'Open the book', position: 0 });
  insertRow(c, 'step', { id: 's-read-2', task_id: 't-read', role: 'fallback', text: 'Read one line', position: 0 });

  let doneDays = 0;
  for (let i = 0; i < 30; i++) {
    const date = addDays(MONTH_FROM, i);
    const chip = i % 7 === 3 ? 'skip' : i % 5 === 1 ? 'fallback' : i % 2 === 0 ? 'done' : null;
    if (chip === 'done' || chip === 'fallback') {
      insertRow(c, 'xp_award', {
        id: `xp-${date}`,
        task_id: 't-read',
        date,
        kind: chip === 'done' ? 'ideal' : 'fallback',
        amount: chip === 'done' ? 10 : 4,
        cycle_id: 'cyc-1',
        created_at: T_UPDATED,
      });
      if (chip === 'done') doneDays += 1;
    }
    insertRow(c, 'day_log', {
      id: `log-${date}`,
      task_id: 't-read',
      date,
      chip_state: chip,
      is_manual_override: chip ? 1 : 0,
      completed_step_ids: chip === 'done' ? '["s-read-1"]' : '[]',
      doses_completed: 0,
      created_at: T_CREATED,
      updated_at: T_UPDATED,
    });
  }
  insertRow(c, 'day_log', {
    id: 'log-dentist',
    task_id: 't-dentist',
    date: '2025-06-12',
    chip_state: 'todo',
    created_at: T_CREATED,
    updated_at: T_UPDATED,
  });
  insertRow(c, 'off_day_mark', {
    id: 'off-15',
    date: '2025-06-15',
    task_id: null,
    prior_chip_state: null,
    created_at: T_UPDATED,
  });
  insertRow(c, 'achievement_unlock', { key: 'first-week', unlocked_on: '2025-06-07', created_at: T_UPDATED });
  return { doneDays };
}

/** The part of the store a user would see, read through the live repositories. */
async function snapshot(app: App) {
  const tasks = await app.repos.tasks.list({ includeDeleted: true });
  const logs = await app.repos.logs.listRange(MONTH_FROM, MONTH_TO);
  const xp = await app.repos.progress.listXpAwards();
  const lifetime = await app.repos.progress.lifetimeXp();
  const settings = await app.repos.settings.get();
  return {
    tasks: tasks.map((t) => ({ id: t.id, name: t.name, deletedAt: t.deletedAt, type: t.type, isNote: t.isNote })),
    logs: logs.map((l) => `${l.date}:${l.chipState ?? '-'}`),
    xpTotal: xp.reduce((sum, a) => sum + a.amount, 0),
    lifetime,
    settings: { theme: settings.theme, accent: settings.accent, cadence: settings.cycleCadence, digest: settings.notifications.dailyDigestTime },
  };
}

function mkTask(overrides: Partial<Task> & { id: Id; name: string }): Task {
  return {
    type: 'routine',
    note: null,
    icon: 'Repeat',
    color: 'indigo',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: false,
    importance: null,
    necessity: null,
    priorityRank: null,
    endedOn: null,
    todoDoneAt: null,
    isNote: false,
    snoozable: true,
    createdAt: T_CREATED,
    updatedAt: T_UPDATED,
    deletedAt: null,
    ...overrides,
  } as Task;
}

beforeEach(() => {
  jest.resetModules();
  secureStore().clear();
  fileSystem().__reset();
  newDatabaseDir();
});

describe('upgrading an older store to the current schema', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('a v%i store opens at v%i with every task, log, XP award and setting intact', async (version) => {
    let seeded = { doneDays: 0 };
    buildStoreAtVersion(version, (c) => {
      seeded = seedRealisticData(c);
    });
    const before = rawCount(`SELECT COUNT(*) AS n FROM day_log`);
    expect(before).toBeGreaterThan(0);

    const app = await openReady();

    expect(userVersion()).toBe(CURRENT);
    const snap = await snapshot(app);
    expect(snap.tasks.map((t) => t.id).sort()).toEqual(['t-dentist', 't-old', 't-read']);
    expect(snap.tasks.find((t) => t.id === 't-read')?.name).toBe('Read 📚 "twice" daily\nsecond line');
    expect(snap.tasks.find((t) => t.id === 't-old')?.deletedAt).toBe('2025-05-20T10:00:00.000Z');
    expect(snap.logs).toHaveLength(31);
    expect(snap.logs).toContain('2025-06-01:done');
    expect(snap.logs).toContain('2025-06-04:skip');
    expect(snap.lifetime).toBe(seeded.doneDays * 10 + countFallbackXp());
    expect(snap.xpTotal).toBe(snap.lifetime);
    expect(snap.settings).toEqual({ theme: 'dark', accent: 'berry', cadence: 'weekly', digest: '07:30' });
    // Migration 5 only exists from v4 on; a to-do with a note was a Note before it.
    expect(snap.tasks.find((t) => t.id === 't-dentist')?.isNote).toBe(version < 5);
    expect(await app.repos.retiredDays.list()).toEqual([]);
    expect(await app.repos.tasks.get('t-read' as Id)).toMatchObject({ endedOn: null });
  });

  function countFallbackXp(): number {
    const c = rawConnection();
    try {
      return Number(
        (c.prepare(`SELECT COALESCE(SUM(amount),0) AS n FROM xp_award WHERE kind = 'fallback'`).get() as { n: number }).n,
      );
    } finally {
      c.close();
    }
  }

  it('a second launch after the upgrade changes nothing (the migration does not re-run)', async () => {
    buildStoreAtVersion(3, (c) => seedRealisticData(c));
    const first = await openReady();
    const once = await snapshot(first);
    const second = await openReady();
    expect(await snapshot(second)).toEqual(once);
    expect(userVersion()).toBe(CURRENT);
  });
});

describe('a store written by a newer app version', () => {
  it('is refused calmly and its file is left exactly as it was', async () => {
    buildStoreAtVersion(CURRENT, (c) => seedRealisticData(c));
    const c = rawConnection();
    c.exec(`PRAGMA user_version = ${CURRENT + 1};`);
    c.exec(`ALTER TABLE task ADD COLUMN future_column TEXT;`);
    c.close();

    const app = launch();
    const opened = await app.store.open();

    expect(opened).toEqual({ ok: true, value: 'corrupt' });
    expect(userVersion()).toBe(CURRENT + 1);
    expect(rawCount(`SELECT COUNT(*) AS n FROM task`)).toBe(3);
    expect(rawCount(`SELECT COUNT(*) AS n FROM day_log`)).toBe(31);
  });
});

describe('a migration that fails part way', () => {
  it('rolls the whole migration back: no half-added column, the old version kept, the data intact', async () => {
    buildStoreAtVersion(7, (c) => seedRealisticData(c));
    // Something left behind that migration 8 wants to create. Its first statement (ADD COLUMN
    // ended_on) succeeds inside the transaction; the CREATE TABLE then fails.
    const c = rawConnection();
    c.exec('CREATE TABLE retired_day (x INTEGER);');
    c.close();

    const app = launch();
    const opened = await app.store.open();

    expect(opened).toEqual({ ok: true, value: 'corrupt' });
    expect(userVersion()).toBe(7);
    const check = rawConnection();
    try {
      const cols = (check.prepare(`SELECT name FROM pragma_table_info('task')`).all() as { name: string }[]).map((r) => r.name);
      expect(cols).not.toContain('ended_on');
    } finally {
      check.close();
    }
    expect(rawCount(`SELECT COUNT(*) AS n FROM task`)).toBe(3);
    expect(rawCount(`SELECT COUNT(*) AS n FROM day_log`)).toBe(31);
  });

  it('a later open, once the obstacle is removed, reaches ready on the same module instance', async () => {
    buildStoreAtVersion(7, (c) => seedRealisticData(c));
    const c = rawConnection();
    c.exec('CREATE TABLE retired_day (x INTEGER);');
    c.close();
    const app = launch();
    await app.store.open();
    // Repair the obstacle and try again from the same module instance: must reach ready.
    const repair = rawConnection();
    repair.exec('DROP TABLE retired_day;');
    repair.close();
    const retry = await app.store.open();
    expect(retry).toEqual({ ok: true, value: 'ready' });
    expect(userVersion()).toBe(CURRENT);
  });
});

describe('backup', () => {
  it('round-trips hundreds of tasks and years of logs, and reports how long it took', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    const TASKS = 300;
    const DAYS = 3 * 365;
    const LOGGED_TASKS = 40;
    const seedStart = Date.now();
    const c = rawConnection();
    c.exec('BEGIN');
    for (let t = 0; t < TASKS; t++) {
      const id = `bulk-${t}`;
      insertRow(c, 'task', {
        id,
        type: 'routine',
        name: `Habit ${t} with a fairly long descriptive name to make rows realistic`,
        icon: 'Repeat',
        color: 'indigo',
        is_as_needed: 0,
        cadence_kind: 'daily',
        doses_per_day: 1,
        is_tracked: 0,
        created_at: T_CREATED,
        updated_at: T_UPDATED,
      });
      insertRow(c, 'step', { id: `${id}-s`, task_id: id, role: 'ideal', text: `Step ${t}`, position: 0 });
    }
    for (let t = 0; t < LOGGED_TASKS; t++) {
      for (let d = 0; d < DAYS; d++) {
        const date = addDays('2023-01-01', d);
        insertRow(c, 'day_log', {
          id: `bl-${t}-${d}`,
          task_id: `bulk-${t}`,
          date,
          chip_state: d % 3 === 0 ? 'done' : 'fallback',
          completed_step_ids: '[]',
          doses_completed: 0,
          created_at: T_CREATED,
          updated_at: T_UPDATED,
        });
      }
    }
    c.exec('COMMIT');
    c.close();
    const seedMs = Date.now() - seedStart;

    const backupStart = Date.now();
    const backed = await app.store.backup();
    const backupMs = Date.now() - backupStart;
    expect(backed.ok).toBe(true);
    if (!backed.ok) return;
    const text = fileSystem().__read(backed.value.uri);
    const envelope = JSON.parse(text) as { tables: Record<string, unknown[]> };
    expect(envelope.tables.task).toHaveLength(TASKS);
    expect(envelope.tables.day_log).toHaveLength(LOGGED_TASKS * DAYS);

    expect(await app.store.eraseAll()).toEqual({ ok: true, value: undefined });
    const restoreStart = Date.now();
    const restored = await app.store.restore(backed.value.uri);
    const restoreMs = Date.now() - restoreStart;
    expect(restored).toEqual({ ok: true, value: undefined });
    expect(rawCount(`SELECT COUNT(*) AS n FROM day_log`)).toBe(LOGGED_TASKS * DAYS);
    expect(rawCount(`SELECT COUNT(*) AS n FROM task`)).toBe(TASKS);
    // Printed so the report can quote real numbers from this machine.
    console.log(
      `[edge.storage] ${TASKS} tasks, ${LOGGED_TASKS * DAYS} logs: seed ${seedMs} ms, backup ${backupMs} ms (${(text.length / 1048576).toFixed(1)} MB), restore ${restoreMs} ms`,
    );
  }, 180_000);

  it('keeps names with emoji, quotes, newlines, backslashes and very long text exactly', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    const names = [
      'Drink 💧 water ✨👨‍👩‍👧',
      `She said "hi" and 'bye'`,
      'line one\nline two\r\nline three',
      'C:\\path\\to\\file \\n not a newline',
      'Tab\there and nbsp\u00a0here',
      'x'.repeat(4000),
      'ünïcödé 日本語 العربية',
    ];
    for (const [i, name] of names.entries()) {
      const id = newId() as Id;
      await app.repos.tasks.insert(mkTask({ id, name, note: `note ${i} "quoted" 🙂` }), [
        { id: newId() as Id, taskId: id, role: 'ideal', text: `Do ${name.slice(0, 20)}`, position: 0, dueWeekdays: null },
      ]);
    }
    const before = await app.repos.tasks.list({ includeDeleted: true });
    const backed = await app.store.backup();
    expect(backed.ok).toBe(true);
    if (!backed.ok) return;

    expect(await app.store.eraseAll()).toEqual({ ok: true, value: undefined });
    expect((await app.repos.tasks.list({ includeDeleted: true })).length).toBe(0);
    expect(await app.store.restore(backed.value.uri)).toEqual({ ok: true, value: undefined });

    const after = await app.repos.tasks.list({ includeDeleted: true });
    const byId = new Map(after.map((t) => [t.id, t]));
    for (const original of before) {
      expect(byId.get(original.id)).toEqual(original);
    }
    expect(after).toHaveLength(names.length);
  });

  it('never carries the BYO AI key, endpoint or entitlement into the backup file', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    const SECRET = 'sk-test-SECRETVALUE-7f3a9c1e';
    secureStore().set('byo.apiKey', SECRET);
    secureStore().set('byo.baseUrl', 'https://byo.example.invalid/v1');
    await app.repos.settings.patch({ sync: { enabled: true, lastSyncedAt: null, lastError: 'token expired' } });
    await app.repos.progress.appendXpAward({
      id: newId() as Id,
      taskId: null,
      date: MONTH_FROM,
      kind: 'ideal',
      amount: 10,
      cycleId: newId() as Id,
      createdAt: T_UPDATED,
    } as XpAward);
    const backed = await app.store.backup();
    expect(backed.ok).toBe(true);
    if (!backed.ok) return;
    const text = fileSystem().__read(backed.value.uri);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain('byo.example.invalid');
    expect(text).not.toMatch(/byo|apiKey|api_key|entitlement|receipt/i);
    const envelope = JSON.parse(text) as { tables: Record<string, unknown> };
    expect(Object.keys(envelope.tables)).not.toContain('entitlement');
  });

});

type EnvelopeRow = Record<string, unknown>;
interface DamageableEnvelope {
  schemaVersion: number;
  tables: {
    settings: EnvelopeRow[];
    task: EnvelopeRow[];
    day_log: EnvelopeRow[];
    xp_award: EnvelopeRow[];
    off_day_mark: EnvelopeRow[];
    [table: string]: EnvelopeRow[];
  };
}

describe('restoring a damaged or foreign file is refused without touching current data', () => {
  async function seedCurrent(): Promise<{ app: App; uri: string }> {
    buildStoreAtVersion(CURRENT, (c) => seedRealisticData(c));
    const app = await openReady();
    const backed = await app.store.backup();
    if (!backed.ok) throw new Error('backup failed in setup');
    return { app, uri: backed.value.uri };
  }

  async function restoreAndExpectRefusal(app: App, uri: string, damagedText: string): Promise<void> {
    const before = await snapshot(app);
    fileSystem().__write(uri, damagedText);
    const result = await app.store.restore(uri);
    expect(result.ok).toBe(false);
    expect(await snapshot(app)).toEqual(before);
  }

  function envelopeOf(uri: string): DamageableEnvelope {
    return JSON.parse(fileSystem().__read(uri)) as DamageableEnvelope;
  }

  it('truncated JSON', async () => {
    const { app, uri } = await seedCurrent();
    const full = fileSystem().__read(uri);
    await restoreAndExpectRefusal(app, uri, full.slice(0, Math.floor(full.length / 2)));
  });

  it('a file that is not a backup at all', async () => {
    const { app, uri } = await seedCurrent();
    await restoreAndExpectRefusal(app, uri, JSON.stringify({ hello: 'world' }));
    await restoreAndExpectRefusal(app, uri, '[1,2,3]');
    await restoreAndExpectRefusal(app, uri, 'null');
  });

  it('a table whose value is the wrong shape', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.task = {} as never;
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a wrong-typed value: a text where a number belongs (doses_per_day)', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.task[0] = { ...env.tables.task[0], doses_per_day: 'many' };
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a wrong-typed value: a number where a name belongs', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.task[0] = { ...env.tables.task[0], name: 42 };
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('duplicate task ids', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.task.push({ ...env.tables.task[0], name: 'a copy with the same id' });
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a day log pointing at a task that is not in the file', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.day_log.push({ ...env.tables.day_log[0], id: 'orphan-log', task_id: 'ghost-task', date: '2025-07-01' });
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a negative XP amount', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.xp_award[0] = { ...env.tables.xp_award[0], amount: -50 };
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a fractional XP amount', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.xp_award[0] = { ...env.tables.xp_award[0], amount: 2.5 };
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a missing settings singleton', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.settings = [];
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a file from a newer schema version', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.schemaVersion = CURRENT + 1;
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a column the app does not know (possible injection through a column name)', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.tables.task[0] = { ...env.tables.task[0], 'name) VALUES (1); DROP TABLE task; --': 'x' };
    await restoreAndExpectRefusal(app, uri, JSON.stringify(env));
  });

  it('a missing file', async () => {
    const { app } = await seedCurrent();
    const before = await snapshot(app);
    const result = await app.store.restore('file:///does/not/exist.fallbackbak');
    expect(result.ok).toBe(false);
    expect(await snapshot(app)).toEqual(before);
  });

  it('a good backup from an older schema (no retired_day table in it) restores', async () => {
    const { app, uri } = await seedCurrent();
    const env = envelopeOf(uri);
    env.schemaVersion = 7;
    delete (env.tables as Record<string, unknown>).retired_day;
    fileSystem().__write(uri, JSON.stringify(env));
    expect(await app.store.restore(uri)).toEqual({ ok: true, value: undefined });
  });
});

describe('erase all data', () => {
  it('leaves a usable, empty store and clears every SecureStore key', async () => {
    buildStoreAtVersion(CURRENT, (c) => seedRealisticData(c));
    const app = await openReady();
    secureStore().set('byo.apiKey', 'k');
    secureStore().set('byo.model', 'm');
    secureStore().set('fallback.sounds', 'on');
    expect((await app.store.eraseAll()).ok).toBe(true);

    expect(secureStore().size).toBe(0);
    expect(app.store.status()).toBe('ready');
    expect(await app.repos.tasks.list({ includeDeleted: true })).toEqual([]);
    const settings: Settings = await app.repos.settings.get();
    expect(settings.theme).toBe('auto');
    expect(settings.notifications.dailyDigestTime).toBe('08:00');
    const created = await app.repos.tasks.insert(mkTask({ id: 'fresh' as Id, name: 'After erase' }), []);
    expect(created.ok).toBe(true);
    expect((await app.repos.tasks.list()).map((t) => t.name)).toEqual(['After erase']);
    expect(userVersion()).toBe(CURRENT);
  });
});

describe('settings persist every field across a reopen', () => {
  it('writes each field and reads it back exactly after a fresh launch', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'pin-task' as Id, name: 'Pinned' }), []);
    const patch: Partial<Settings> = {
      theme: 'light',
      accent: 'hue-200' as Settings['accent'],
      onboardingCompletedAt: '2025-03-04T10:00:00.000Z' as Instant,
      tenureAnchorDate: '2024-11-30' as LocalDate,
      cycleCadence: 'weekly',
      notifications: {
        master: true,
        routineDue: true,
        eventStarting: true,
        courseDose: true,
        courseEndingSoon: true,
        gentleReentry: true,
        milestoneReached: true,
        dailyDigest: true,
        dailyDigestTime: '21:45',
      },
      assistant: { language: 'fr-FR', voice: 'calm' },
      widgets: [
        { size: 'small-today', mode: 'smart-next-due', fixedTaskId: null },
        { size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 'pin-task' as Id },
        { size: 'medium-up-next', mode: 'fixed-task', fixedTaskId: null },
      ],
      sync: { enabled: true, lastSyncedAt: '2025-06-01T01:00:00.000Z' as Instant, lastError: 'offline' },
      lastBackupAt: '2025-06-02T02:00:00.000Z' as Instant,
    };
    const saved = await app.repos.settings.patch(patch);
    expect(saved.ok).toBe(true);

    const reopened = await openReady();
    const got = await reopened.repos.settings.get();
    expect(got.theme).toBe('light');
    expect(got.accent).toBe('hue-200');
    expect(got.onboardingCompletedAt).toBe('2025-03-04T10:00:00.000Z');
    expect(got.tenureAnchorDate).toBe('2024-11-30');
    expect(got.cycleCadence).toBe('weekly');
    expect(got.notifications).toEqual(patch.notifications);
    expect(got.assistant).toEqual({ language: 'fr-FR', voice: 'calm' });
    expect(got.widgets).toEqual(patch.widgets);
    expect(got.sync).toEqual({ enabled: true, lastSyncedAt: '2025-06-01T01:00:00.000Z', lastError: 'offline' });
    expect(got.lastBackupAt).toBe('2025-06-02T02:00:00.000Z');
  });

  it('a fixed widget whose task is deleted for good falls back to no task, and the rest survives', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'gone' as Id, name: 'Going' }), []);
    await app.repos.settings.patch({
      theme: 'dark',
      widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 'gone' as Id }],
    });
    await app.repos.tasks.softDelete('gone' as Id);
    await app.repos.tasks.deleteForever('gone' as Id, []);
    const reopened = await openReady();
    const got = await reopened.repos.settings.get();
    expect(got.theme).toBe('dark');
    expect(got.widgets).toEqual([{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: null }]);
  });
});

describe('concurrent writes through the serial proxy', () => {
  it('200 log writes fired at once all land', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'busy' as Id, name: 'Busy' }), []);
    const writes = Array.from({ length: 200 }, (_, i) =>
      app.repos.logs.upsert({
        id: newId() as Id,
        taskId: 'busy' as Id,
        date: addDays('2025-06-01', i),
        chipState: 'done',
        isManualOverride: true,
        completedStepIds: [],
        dosesCompleted: 0,
        movedToDate: null,
        createdAt: T_UPDATED,
        updatedAt: T_UPDATED,
      }),
    );
    const results = await Promise.all(writes);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(rawCount(`SELECT COUNT(*) AS n FROM day_log WHERE task_id = 'busy'`)).toBe(200);
  });

  it('50 racing taps on one occurrence leave exactly one row holding the last state', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'tap' as Id, name: 'Tap' }), []);
    const states = ['done', 'fallback', 'skip', 'todo'] as const;
    const writes = Array.from({ length: 50 }, (_, i) =>
      app.repos.logs.upsert({
        id: newId() as Id,
        taskId: 'tap' as Id,
        date: '2025-06-10' as LocalDate,
        chipState: states[i % states.length]!,
        isManualOverride: true,
        completedStepIds: [],
        dosesCompleted: 0,
        movedToDate: null,
        createdAt: T_UPDATED,
        updatedAt: T_UPDATED,
      }),
    );
    await Promise.all(writes);
    expect(rawCount(`SELECT COUNT(*) AS n FROM day_log WHERE task_id = 'tap' AND date = '2025-06-10'`)).toBe(1);
    const rows = await app.repos.logs.listRange('2025-06-10' as LocalDate, '2025-06-10' as LocalDate);
    expect(rows[0]?.chipState).toBe(states[49 % states.length]);
  });

  it('20 settings patches fired together each keep their own change (no lost update)', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    const digests = Array.from({ length: 20 }, (_, i) => i);
    await Promise.all([
      app.repos.settings.patch({ theme: 'dark' }),
      app.repos.settings.patch({ cycleCadence: 'weekly' }),
      ...digests.map((i) =>
        app.repos.settings.patch({ assistant: { language: `en-${i}`, voice: 'warm' } }),
      ),
      app.repos.settings.patch({ notifications: { master: true } as Settings['notifications'] }),
    ]);
    const got = await app.repos.settings.get();
    expect(got.theme).toBe('dark');
    expect(got.cycleCadence).toBe('weekly');
    expect(got.notifications.master).toBe(true);
    expect(got.assistant.language).toBe('en-19');
  });

  it('racing XP awards for one day count once, and mixed writes with a backup stay consistent', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'xp' as Id, name: 'XP' }), []);
    const cycleId = newId() as Id;
    const awards = Array.from({ length: 30 }, (_, i) =>
      app.repos.progress.appendXpAward({
        id: newId() as Id,
        taskId: 'xp' as Id,
        date: '2025-06-03' as LocalDate,
        kind: 'ideal',
        amount: i % 2 === 0 ? 10 : 4,
        cycleId,
        createdAt: T_UPDATED,
      }),
    );
    const mixed = [
      app.store.backup(),
      ...Array.from({ length: 20 }, (_, i) =>
        app.repos.tasks.insert(mkTask({ id: `mix-${i}` as Id, name: `Mix ${i}` }), []),
      ),
    ];
    const [results, backups] = await Promise.all([Promise.all(awards), Promise.all(mixed)]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(rawCount(`SELECT COUNT(*) AS n FROM xp_award WHERE task_id = 'xp'`)).toBe(1);
    expect(await app.repos.progress.lifetimeXp()).toBe(4);
    const backup = backups[0] as { ok: boolean };
    expect(backup.ok).toBe(true);
  });

  it('a backup taken while logs and XP are being written has every XP award backed by its day log', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'snap' as Id, name: 'Snap' }), []);
    const cycleId = newId() as Id;
    // Each day is one log plus its XP award, written one after the other while the backup runs.
    const writer = (async () => {
      for (let i = 0; i < 200; i++) {
        const date = addDays('2025-01-01', i) as LocalDate;
        await app.repos.logs.upsert({
          id: newId() as Id,
          taskId: 'snap' as Id,
          date,
          chipState: 'done',
          isManualOverride: true,
          completedStepIds: [],
          dosesCompleted: 0,
          movedToDate: null,
          createdAt: T_UPDATED,
          updatedAt: T_UPDATED,
        });
        await app.repos.progress.appendXpAward({
          id: newId() as Id,
          taskId: 'snap' as Id,
          date,
          kind: 'ideal',
          amount: 10,
          cycleId,
          createdAt: T_UPDATED,
        });
      }
    })();
    const backed = await app.store.backup();
    await writer;
    expect(backed.ok).toBe(true);
    if (!backed.ok) return;
    const env = JSON.parse(fileSystem().__read(backed.value.uri)) as {
      tables: { day_log: { date: string }[]; xp_award: { date: string }[] };
    };
    const logDates = new Set(env.tables.day_log.map((l) => l.date));
    const orphanAwards = env.tables.xp_award.filter((a) => !logDates.has(a.date));
    expect(orphanAwards).toEqual([]);
  });
});

describe('busy and locked database', () => {
  it('a lock released within the retry wait is recovered from', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    const holder = rawConnection();
    holder.exec('BEGIN EXCLUSIVE');
    const release = setTimeout(() => holder.exec('COMMIT'), 40);
    try {
      const result = await app.repos.tasks.insert(mkTask({ id: 'after-lock' as Id, name: 'After lock' }), []);
      expect(result).toEqual({ ok: true, value: 'after-lock' });
    } finally {
      clearTimeout(release);
      try {
        holder.exec('COMMIT');
      } catch {
        /* already committed */
      }
      holder.close();
    }
  });

  it('a lock held longer than the single retry becomes a calm WRITE_FAILED, not a crash', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'locked' as Id, name: 'Locked' }), []);
    const holder = rawConnection();
    holder.exec('BEGIN EXCLUSIVE');
    const release = setTimeout(() => holder.exec('COMMIT'), 1500);
    try {
      const result = await app.repos.logs.upsert({
        id: newId() as Id,
        taskId: 'locked' as Id,
        date: '2025-06-01' as LocalDate,
        chipState: 'done',
        isManualOverride: true,
        completedStepIds: [],
        dosesCompleted: 0,
        movedToDate: null,
        createdAt: T_UPDATED,
        updatedAt: T_UPDATED,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('WRITE_FAILED');
    } finally {
      clearTimeout(release);
      try {
        holder.exec('COMMIT');
      } catch {
        /* already committed */
      }
      holder.close();
    }
  }, 20_000);
});

describe('unique constraints under racing writes', () => {
  it('one log per task per date: a second raw insert on the same pair is refused', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await app.repos.tasks.insert(mkTask({ id: 'uniq' as Id, name: 'Uniq' }), []);
    await app.repos.logs.upsert({
      id: 'first' as Id,
      taskId: 'uniq' as Id,
      date: '2025-06-01' as LocalDate,
      chipState: 'done',
      isManualOverride: true,
      completedStepIds: [],
      dosesCompleted: 0,
      movedToDate: null,
      createdAt: T_UPDATED,
      updatedAt: T_UPDATED,
    });
    const raw = rawConnection();
    try {
      expect(() =>
        raw
          .prepare(
            `INSERT INTO day_log (id, task_id, date, chip_state, is_manual_override, completed_step_ids, doses_completed, moved_to_date, created_at, updated_at)
             VALUES ('second','uniq','2025-06-01','fallback',0,'[]',0,NULL,?,?)`,
          )
          .run(T_UPDATED, T_UPDATED),
      ).toThrow(/UNIQUE/);
    } finally {
      raw.close();
    }
  });

  it('two whole-day off marks for one date cannot both exist, even when raced', async () => {
    buildStoreAtVersion(CURRENT, () => undefined);
    const app = await openReady();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        app.repos.offDays.mark({
          id: `off-${i}` as Id,
          date: '2025-06-15' as LocalDate,
          taskId: null,
          priorChipState: null,
          createdAt: T_UPDATED,
        }),
      ),
    );
    expect(rawCount(`SELECT COUNT(*) AS n FROM off_day_mark WHERE task_id IS NULL AND date = '2025-06-15'`)).toBe(1);
  });

  it('two whole-day off marks for one date are not allowed by a v1 store either: migration 2 keeps one', async () => {
    buildStoreAtVersion(1, (c) => {
      c.exec(
        `INSERT INTO off_day_mark (id, date, task_id, prior_chip_state, created_at) VALUES ('a','2025-06-15',NULL,NULL,'${T_UPDATED}'),('b','2025-06-15',NULL,NULL,'${T_UPDATED}')`,
      );
    });
    await openReady();
    expect(rawCount(`SELECT COUNT(*) AS n FROM off_day_mark WHERE date = '2025-06-15'`)).toBe(1);
  });
});

describe('restoring a backup is not a way around the rules', () => {
  it('a restored backup cannot bring back two whole-day marks for one date', async () => {
    buildStoreAtVersion(CURRENT, (c) => seedRealisticData(c));
    const app = await openReady();
    const backed = await app.store.backup();
    if (!backed.ok) throw new Error('setup backup failed');
    const env = JSON.parse(fileSystem().__read(backed.value.uri)) as { tables: { off_day_mark: Record<string, unknown>[] } };
    env.tables.off_day_mark.push({ ...env.tables.off_day_mark[0], id: 'dupe-off' });
    fileSystem().__write(backed.value.uri, JSON.stringify(env));
    const result = await app.store.restore(backed.value.uri);
    expect(result.ok).toBe(false);
    expect(rawCount(`SELECT COUNT(*) AS n FROM off_day_mark WHERE task_id IS NULL`)).toBe(1);
  });
});
