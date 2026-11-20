/**
 * Round 2, area 19 (real database, restarts). The same app logic as the storage and recently
 * deleted tests, run against a REAL SQLite file (node:sqlite behind the file-backed expo-sqlite
 * double). A "launch" is a fresh module registry plus a new connection to the same file, and
 * nothing is closed first, like an app that was killed. Between launches the clock moves on.
 *
 * Mutations are the `__testing__` functions of `src/queries/mutations.ts` (the exact bodies the
 * hooks wrap). Delete, restore, end and start again are hooks there, so their bodies are mirrored
 * here line for line from `useDeleteTask`, `useRestoreTask`, `useDeleteForever`,
 * `useEmptyRecentlyDeleted`, `useEndTask` and `useStartAgain` (with `bringBackLoggedPush`), using
 * the same `@/queries/internal` helpers.
 */
import { makeTempDir, removeDir, joinPath } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

/** A new database directory. Each scenario gets its own file, so no WAL state leaks between them. */
function newDatabaseDir(): string {
  const dir = makeTempDir('fallback-edge-restarts-');
  createdDirs.push(dir);
  (globalThis as { __erDir?: string }).__erDir = dir;
  return dir;
}

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __erDir?: string }).__erDir,
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
  const clock = globalThis as { __erNow?: string };
  return {
    ...actual,
    // Both the clock every write reads and the local day every read uses follow the simulated launch.
    now: () => (clock.__erNow ? new Date(clock.__erNow).toISOString() : actual.now()),
    today: () => (clock.__erNow ? actual.toLocalDate(new Date(clock.__erNow)) : actual.today()),
  };
});

import { DatabaseSync } from 'node:sqlite';

import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from '../migrations';
import { newId } from '@/lib/id';
import { reconcileAchievements } from '@/domain';
import type { Instant, LocalDate, Occurrence, Step, Task, TaskWithSteps } from '@/types';

type App = typeof import('@/db');
type MutationsModule = typeof import('@/queries/mutations');
type InternalModule = typeof import('@/queries/internal');
type FileSystemDouble = typeof import('../testSupport/fileSystemTestDouble');

interface Ctx {
  readonly db: App;
  readonly mut: MutationsModule;
  readonly int: InternalModule;
  /** The simulated instant of this launch, and its local day. */
  readonly at: Instant;
  readonly day: LocalDate;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DB_FILE = 'fallback.db';

function currentDir(): string {
  return (globalThis as { __erDir?: string }).__erDir as string;
}
function dbPath(): string {
  return joinPath(currentDir(), DB_FILE);
}

/** A local-noon-ish instant for a local day, so the local date is the same in every time zone. */
function clockAt(day: string, hour = 12, minute = 0): Instant {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, minute).toISOString() as Instant;
}
function localDayOf(at: Instant): LocalDate {
  const d = new Date(at);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate;
}
function setClock(at: Instant | null): void {
  (globalThis as { __erNow?: string }).__erNow = at ?? undefined;
}

/**
 * One launch: fresh modules, a new connection, nothing closed first. Opens the store (it must be
 * ready), then runs the same launch work the splash screen runs: the 30-day sweep and cycle catch-up.
 */
async function launch(at: Instant, opts: { sweep?: boolean } = {}): Promise<Ctx> {
  setClock(at);
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const db = require('@/db') as App;
  const opened = await db.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error(`store did not open ready: ${JSON.stringify(opened)}`);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mut = require('@/queries/mutations') as MutationsModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const int = require('@/queries/internal') as InternalModule;
  const c: Ctx = { db, mut, int, at, day: localDayOf(at) };
  if (opts.sweep !== false) {
    await mut.sweepExpiredDeleted();
    await mut.catchUpCycles();
    // S01 also repairs a log whose XP never landed (killed between the two writes).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await (require('@/queries/healXp') as typeof import('@/queries/healXp')).healMissingXp(db.repos);
  }
  return c;
}

/** A raw read of the database file, through its own connection (the way a second screen would see it). */
function rawAll<T>(sql: string, params: unknown[] = []): T[] {
  const connection = new DatabaseSync(dbPath());
  try {
    return connection.prepare(sql).all(...(params as never[])) as T[];
  } finally {
    connection.close();
  }
}
function rawCount(sql: string, params: unknown[] = []): number {
  return Number(rawAll<{ n: number }>(sql, params)[0]?.n ?? 0);
}

/** Every table, every row, as sorted JSON: a byte-level comparison of what is stored. */
function dumpTables(): Record<string, string[]> {
  const names = rawAll<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).map(
    (r) => r.name,
  );
  const out: Record<string, string[]> = {};
  for (const table of names) {
    out[table] = rawAll<Record<string, unknown>>(`SELECT * FROM "${table}"`)
      .map((row) => JSON.stringify(Object.keys(row).sort().map((k) => [k, row[k]])))
      .sort();
  }
  return out;
}

interface Snap {
  readonly tables: Record<string, string[]>;
  /** The record as it stands for `today`, retired days shown as anonymous. */
  readonly record: string[];
  readonly lifetimeXp: number;
}

async function recordFor(c: Ctx, today: LocalDate): Promise<Occurrence[]> {
  return c.int.resolveRecordOccurrences(c.db.repos, today, today);
}
function recordLines(occs: readonly Occurrence[]): string[] {
  return occs
    .map((o) => {
      const pushed = (o as { pushedFrom?: string }).pushedFrom ?? '';
      const who = o.taskId.startsWith('retired:') ? 'retired' : o.taskId;
      return `${who}|${o.date}|${o.outcome}|${pushed}`;
    })
    .sort();
}
/** Only the days that count (outcomes the record scores), taskless: the comparison for "retiring changes nothing that counts". */
function countedShape(occs: readonly Occurrence[]): string[] {
  return occs
    .filter((o) => ['ideal', 'fallback', 'missed', 'off'].includes(o.outcome))
    .map((o) => `${o.date}|${o.outcome}`)
    .sort();
}

async function snapshot(c: Ctx, today: LocalDate): Promise<Snap> {
  return {
    tables: dumpTables(),
    record: recordLines(await recordFor(c, today)),
    lifetimeXp: await c.db.repos.progress.lifetimeXp(),
  };
}

/**
 * The invariants that must hold at every cold start: lifetime XP is exactly the sum of the award
 * rows, and every day that counts as shown up has exactly one award row (retired days included).
 */
async function assertInvariants(c: Ctx): Promise<void> {
  const xpSum = rawCount(`SELECT COALESCE(SUM(amount), 0) AS n FROM xp_award`);
  const xpRows = rawCount(`SELECT COUNT(*) AS n FROM xp_award`);
  expect(await c.db.repos.progress.lifetimeXp()).toBe(xpSum);
  // Every shown-up day has its award. The reverse is not true: marking a day off keeps the XP already
  // earned (review pass 2, N2), so an award can sit under a day that now reads off.
  const shownUp = (await recordFor(c, c.day)).filter((o) => o.outcome === 'ideal' || o.outcome === 'fallback');
  for (const o of shownUp) {
    if (o.taskId.startsWith('retired:')) continue;
    const pushed = (o as { pushedFrom?: string }).pushedFrom ?? o.date;
    expect(rawCount(`SELECT COUNT(*) AS n FROM xp_award WHERE task_id = ? AND date = ?`, [o.taskId, pushed])).toBe(1);
  }
  expect(shownUp.length).toBeLessThanOrEqual(xpRows);
}

/* ----------------------------------------------------------------- building blocks */

function makeRoutine(createdAt: Instant, name: string): { task: Task; steps: Step[] } {
  const id = newId();
  const task: Task = {
    id,
    type: 'routine',
    name,
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
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    endedOn: null,
    snoozable: true,
  } as Task;
  const steps: Step[] = [
    { id: newId(), taskId: id as never, role: 'ideal', text: `${name}: the full version`, position: 0, dueWeekdays: null },
    { id: newId(), taskId: id as never, role: 'fallback', text: `${name}: the small version`, position: 0, dueWeekdays: null },
  ];
  return { task, steps };
}

function makeTodo(createdAt: Instant, name: string): { task: Task; steps: Step[] } {
  const routine = makeRoutine(createdAt, name);
  return { task: { ...routine.task, type: 'todo', cadence: null, isNote: false } as Task, steps: [] };
}

async function addTask(c: Ctx, built: { task: Task; steps: Step[] }): Promise<string> {
  const result = await c.db.repos.tasks.insert(built.task, built.steps);
  if (!result.ok) throw new Error(`insert failed: ${JSON.stringify(result)}`);
  return built.task.id;
}

async function liveTask(c: Ctx, id: string): Promise<TaskWithSteps | null> {
  const task = await c.db.repos.tasks.get(id as never);
  return task && task.deletedAt === null ? task : null;
}

/* Mirrors of the hook bodies in src/queries/mutations.ts (see the header of this file). */

async function persistEarnedBadgesMirror(c: Ctx): Promise<void> {
  const { repos } = c.db;
  const [unlocks, settings, all] = await Promise.all([repos.progress.listUnlocks(), repos.settings.get(), recordFor(c, c.day)]);
  const fresh = reconcileAchievements({ occurrences: all, tenureAnchor: settings.tenureAnchorDate, today: c.day, alreadyUnlocked: unlocks, now: c.at });
  for (const u of fresh) await repos.progress.upsertUnlock(u);
}

/** useDeleteTask */
async function deleteTaskMirror(c: Ctx, id: string) {
  await persistEarnedBadgesMirror(c);
  return c.db.repos.tasks.softDelete(id as never);
}

/** useRestoreTask */
async function restoreTaskMirror(c: Ctx, id: string) {
  const { repos } = c.db;
  const task = (await repos.tasks.listDeleted()).find((t) => t.id === id);
  if (!task) return { ok: false as const, error: { code: 'NOT_FOUND' } };
  const deletedOn = c.int.deletionDay(task);
  if (deletedOn !== null) {
    const occ = await c.int.resolveOneOccurrence(repos, task, deletedOn, c.day);
    const logged = occ.outcome === 'ideal' || occ.outcome === 'fallback';
    const away = await c.int.markAwayDaysOff(repos, task, logged ? addOne(deletedOn) : deletedOn, addDays(c.day, -1));
    if (!away.ok) return away;
  }
  return repos.tasks.restore(id as never);
}

/** useDeleteForever */
async function deleteForeverMirror(c: Ctx, id: string) {
  const { repos } = c.db;
  const task = (await repos.tasks.listDeleted()).find((t) => t.id === id);
  if (!task) return { ok: false as const, error: { code: 'NOT_FOUND' } };
  await c.int.keepBadgesBeforeRetiring(repos, c.day, c.at);
  return c.int.retireForGood(repos, task, c.day);
}

/** useEmptyRecentlyDeleted */
async function emptyRecentlyDeletedMirror(c: Ctx) {
  return c.int.retireDeleted(c.db.repos, 'all');
}

/** bringBackLoggedPush (private in mutations.ts) */
async function bringBackLoggedPushMirror(c: Ctx, task: TaskWithSteps, date: LocalDate): Promise<void> {
  const { repos } = c.db;
  const row = (await repos.logs.listForTask(task.id, date, date))[0] ?? null;
  if (!row || row.movedToDate === null) return;
  const pushed = await c.int.resolveOneOccurrence(repos, task, row.movedToDate, c.day, date);
  if (pushed.outcome !== 'ideal' && pushed.outcome !== 'fallback') return;
  const result = await repos.logs.upsert({ ...row, movedToDate: null, updatedAt: c.at });
  if (result.ok) await c.mut.__testing__.reconcileOccurrence(task.id, date);
}

/** useEndTask */
async function endTaskMirror(c: Ctx, id: string) {
  const { repos } = c.db;
  const task = await liveTask(c, id);
  if (!task) return { ok: false as const, error: { code: 'NOT_FOUND' } };
  if (task.endedOn) return { ok: true as const, value: task.endedOn };
  await bringBackLoggedPushMirror(c, task, c.day);
  const occs = await recordFor(c, c.day);
  const doneToday = occs.some((o) => o.taskId === id && o.date === c.day && (o.outcome === 'ideal' || o.outcome === 'fallback'));
  const endedOn = doneToday ? c.day : addDays(c.day, -1);
  if (endedOn !== c.day) await bringBackLoggedPushMirror(c, task, endedOn);
  const result = await repos.tasks.update(id as never, { endedOn });
  if (!result.ok) return result;
  return { ok: true as const, value: endedOn };
}

/** useStartAgain */
async function startAgainMirror(c: Ctx, id: string) {
  const task = await liveTask(c, id);
  if (!task) return { ok: false as const, error: { code: 'NOT_FOUND' } };
  if (!task.endedOn) return { ok: true as const, value: undefined };
  const resumed = { ...task, endedOn: null };
  const away = await c.int.markAwayDaysOff(c.db.repos, resumed, addDays(task.endedOn, 1), addDays(c.day, -1));
  if (!away.ok) return away;
  return c.db.repos.tasks.update(id as never, { endedOn: null });
}

function addDays(day: LocalDate, n: number): LocalDate {
  // Calendar arithmetic in UTC on the date part only: no time zone can shift a day here.
  const [y, m, d] = day.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d! + n);
  return new Date(t).toISOString().slice(0, 10) as LocalDate;
}
function addOne(day: LocalDate): LocalDate {
  return addDays(day, 1);
}

/** The record lines for one task and date, as outcomes (sorted). */
async function outcomesOf(c: Ctx, taskId: string, date: string, today: LocalDate = c.day): Promise<string[]> {
  return (await recordFor(c, today)).filter((o) => o.taskId === taskId && o.date === date).map((o) => o.outcome).sort();
}

/* ----------------------------------------------------------------- 1. the two-week script */

interface Shared {
  stretch: string;
  read: string;
  dentist: string;
  backupText: string;
  backupSnap: Snap;
  backupUri: string;
}
const shared = {} as Shared;

interface ScriptStep {
  readonly label: string;
  readonly day: string;
  readonly hour: number;
  readonly minute?: number;
  run(c: Ctx): Promise<void>;
}

const logStep = (c: Ctx, taskId: string, date: string, chip: 'done' | 'fallback' | 'todo' | 'skip') =>
  c.mut.__testing__.logState({ taskId: taskId as never, date: date as LocalDate, chip });

const SCRIPT: ScriptStep[] = [
  {
    label: 'S01 create Stretch (routine, daily)',
    day: '2026-11-02',
    hour: 9,
    async run(c) {
      shared.stretch = await addTask(c, makeRoutine(c.at, 'Stretch'));
      expect(await outcomesOf(c, shared.stretch, '2026-11-02')).toEqual(['pending']);
    },
  },
  {
    label: 'S02 create Read (routine, daily)',
    day: '2026-11-02',
    hour: 9,
    minute: 5,
    async run(c) {
      shared.read = await addTask(c, makeRoutine(c.at, 'Read'));
      expect(await outcomesOf(c, shared.read, '2026-11-02')).toEqual(['pending']);
    },
  },
  {
    label: 'S03 create Dentist (to-do)',
    day: '2026-11-02',
    hour: 9,
    minute: 10,
    async run(c) {
      shared.dentist = await addTask(c, makeTodo(c.at, 'Call the dentist'));
      expect((await liveTask(c, shared.dentist))?.name).toBe('Call the dentist');
    },
  },
  {
    label: 'S04 log Stretch done (ideal, +10)',
    day: '2026-11-02',
    hour: 10,
    async run(c) {
      const r = await logStep(c, shared.stretch, '2026-11-02', 'done');
      expect(r).toMatchObject({ ok: true, value: { outcome: 'ideal', xpAwarded: 10 } });
      expect(await c.db.repos.progress.lifetimeXp()).toBe(10);
    },
  },
  {
    label: 'S05 log Read fallback (+6)',
    day: '2026-11-02',
    hour: 10,
    minute: 5,
    async run(c) {
      const r = await logStep(c, shared.read, '2026-11-02', 'fallback');
      expect(r).toMatchObject({ ok: true, value: { outcome: 'fallback', xpAwarded: 6 } });
      expect(await c.db.repos.progress.lifetimeXp()).toBe(16);
    },
  },
  {
    label: 'S06 undo Read to todo (retracts the +6)',
    day: '2026-11-02',
    hour: 10,
    minute: 10,
    async run(c) {
      const r = await logStep(c, shared.read, '2026-11-02', 'todo');
      expect(r).toMatchObject({ ok: true, value: { outcome: 'pending', xpAwarded: 0 } });
      expect(await c.db.repos.progress.lifetimeXp()).toBe(10);
    },
  },
  {
    label: 'S07 log Read fallback again (+6)',
    day: '2026-11-02',
    hour: 10,
    minute: 15,
    async run(c) {
      await logStep(c, shared.read, '2026-11-02', 'fallback');
      expect(await c.db.repos.progress.lifetimeXp()).toBe(16);
    },
  },
  {
    label: 'S08 Stretch skipped on Nov 3 (missed, no XP)',
    day: '2026-11-03',
    hour: 8,
    async run(c) {
      await logStep(c, shared.stretch, '2026-11-03', 'skip');
      expect(await outcomesOf(c, shared.stretch, '2026-11-03')).toEqual(['missed']);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(16);
    },
  },
  {
    label: 'S09 push Read Nov 3 to tomorrow (additive)',
    day: '2026-11-03',
    hour: 9,
    async run(c) {
      const r = await c.mut.__testing__.snoozeOccurrence({ taskId: shared.read as never, date: '2026-11-03' as LocalDate });
      expect(r.ok).toBe(true);
      expect(await outcomesOf(c, shared.read, '2026-11-03')).toEqual(['not-due']);
    },
  },
  {
    label: 'S10 log the pushed Read occurrence done (XP keyed to Nov 3)',
    day: '2026-11-04',
    hour: 8,
    async run(c) {
      // Nov 4 now carries two Read occurrences: its own, and the one pushed from Nov 3.
      const before = await recordFor(c, c.day);
      const onNov4 = before.filter((o) => o.taskId === shared.read && o.date === '2026-11-04');
      expect(onNov4.map((o) => (o as { pushedFrom?: string }).pushedFrom ?? '').sort()).toEqual(['', '2026-11-03']);
      const r = await c.mut.__testing__.logState({ taskId: shared.read as never, date: '2026-11-04' as LocalDate, pushedFrom: '2026-11-03' as LocalDate, chip: 'done' });
      expect(r).toMatchObject({ ok: true, value: { outcome: 'ideal', xpAwarded: 10 } });
      expect(rawCount(`SELECT COUNT(*) AS n FROM xp_award WHERE task_id = ? AND date = '2026-11-03'`, [shared.read])).toBe(1);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(26);
    },
  },
  {
    label: 'S11 emergency day off for Stretch on Nov 4',
    day: '2026-11-04',
    hour: 9,
    async run(c) {
      const r = await c.mut.__testing__.markOffDay({ date: '2026-11-04' as LocalDate, taskId: shared.stretch as never, mark: true });
      expect(r.ok).toBe(true);
      expect(await outcomesOf(c, shared.stretch, '2026-11-04')).toEqual(['off']);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(26);
    },
  },
  {
    label: 'S12 log Read own occurrence Nov 4 fallback (+6)',
    day: '2026-11-04',
    hour: 9,
    minute: 5,
    async run(c) {
      await logStep(c, shared.read, '2026-11-04', 'fallback');
      expect(await outcomesOf(c, shared.read, '2026-11-04')).toEqual(['fallback', 'ideal']);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(32);
    },
  },
  {
    label: 'S13 whole-day off for everything on Nov 5 (sick day)',
    day: '2026-11-05',
    hour: 8,
    async run(c) {
      const r = await c.mut.__testing__.markOffDay({ date: '2026-11-05' as LocalDate, taskId: null, mark: true });
      expect(r.ok).toBe(true);
      expect(await outcomesOf(c, shared.stretch, '2026-11-05')).toEqual(['off']);
      expect(await outcomesOf(c, shared.read, '2026-11-05')).toEqual(['off']);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(32);
    },
  },
  {
    label: 'S14 end routine Read (not done today, so it ends yesterday)',
    day: '2026-11-05',
    hour: 8,
    minute: 30,
    async run(c) {
      const r = await endTaskMirror(c, shared.read);
      expect(r).toMatchObject({ ok: true, value: '2026-11-04' });
      expect(await outcomesOf(c, shared.read, '2026-11-05')).toEqual([]);
    },
  },
  {
    label: 'S15 log Stretch Nov 6 done (+10)',
    day: '2026-11-06',
    hour: 8,
    async run(c) {
      await logStep(c, shared.stretch, '2026-11-06', 'done');
      expect(await c.db.repos.progress.lifetimeXp()).toBe(42);
    },
  },
  {
    label: 'S16 start Read again (the ended days are marked off)',
    day: '2026-11-06',
    hour: 8,
    minute: 10,
    async run(c) {
      const r = await startAgainMirror(c, shared.read);
      expect(r.ok).toBe(true);
      expect((await liveTask(c, shared.read))?.endedOn).toBeNull();
      expect(await outcomesOf(c, shared.read, '2026-11-05')).toEqual(['off']);
    },
  },
  {
    label: 'S17 delete Stretch (to Recently deleted, history kept)',
    day: '2026-11-07',
    hour: 9,
    async run(c) {
      expect((await deleteTaskMirror(c, shared.stretch)).ok).toBe(true);
      expect((await c.db.repos.tasks.listDeleted()).map((t) => t.id)).toContain(shared.stretch);
      expect(await outcomesOf(c, shared.stretch, '2026-11-06')).toEqual(['ideal']);
      expect(await outcomesOf(c, shared.stretch, '2026-11-07')).toEqual([]);
    },
  },
  {
    label: 'S18 restore Stretch (the day it was deleted is marked off)',
    day: '2026-11-08',
    hour: 9,
    async run(c) {
      expect((await restoreTaskMirror(c, shared.stretch)).ok).toBe(true);
      expect(await outcomesOf(c, shared.stretch, '2026-11-07')).toEqual(['off']);
      expect(await liveTask(c, shared.stretch)).not.toBeNull();
    },
  },
  {
    label: 'S19 delete Read',
    day: '2026-11-08',
    hour: 9,
    minute: 30,
    async run(c) {
      expect((await deleteTaskMirror(c, shared.read)).ok).toBe(true);
      expect(await outcomesOf(c, shared.read, '2026-11-08')).toEqual([]);
      expect(await outcomesOf(c, shared.read, '2026-11-05')).toEqual(['off']);
    },
  },
  {
    label: 'S20 log Stretch Nov 9 fallback (+6)',
    day: '2026-11-09',
    hour: 8,
    async run(c) {
      await logStep(c, shared.stretch, '2026-11-09', 'fallback');
      expect(await c.db.repos.progress.lifetimeXp()).toBe(48);
    },
  },
  {
    label: 'S21 delete Dentist',
    day: '2026-11-09',
    hour: 8,
    minute: 10,
    async run(c) {
      expect((await deleteTaskMirror(c, shared.dentist)).ok).toBe(true);
    },
  },
  {
    label: 'S22 delete Read for good (its past days stay in the record)',
    day: '2026-11-10',
    hour: 9,
    async run(c) {
      const before = countedShape(await recordFor(c, c.day));
      expect((await deleteForeverMirror(c, shared.read)).ok).toBe(true);
      expect(rawCount(`SELECT COUNT(*) AS n FROM task WHERE id = ?`, [shared.read])).toBe(0);
      expect(countedShape(await recordFor(c, c.day))).toEqual(before);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(48);
    },
  },
  {
    label: 'S23 backup taken (the script continues after it)',
    day: '2026-11-10',
    hour: 10,
    async run(c) {
      shared.backupSnap = await snapshot(c, c.day);
      const backed = await c.db.store.backup();
      if (!backed.ok) throw new Error('backup failed');
      shared.backupUri = backed.value.uri;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('../testSupport/fileSystemTestDouble') as FileSystemDouble;
      shared.backupText = fs.__read(shared.backupUri);
      expect(JSON.parse(shared.backupText)).toBeTruthy();
    },
  },
  {
    label: 'S24 restore Dentist (to-do) from Recently deleted',
    day: '2026-11-11',
    hour: 9,
    async run(c) {
      expect((await restoreTaskMirror(c, shared.dentist)).ok).toBe(true);
      expect(await liveTask(c, shared.dentist)).not.toBeNull();
    },
  },
  {
    label: 'S25 log Stretch Nov 11 done (+10, after the backup)',
    day: '2026-11-11',
    hour: 9,
    minute: 5,
    async run(c) {
      await logStep(c, shared.stretch, '2026-11-11', 'done');
      expect(await c.db.repos.progress.lifetimeXp()).toBe(58);
    },
  },
  {
    label: 'S26 delete Dentist for good',
    day: '2026-11-11',
    hour: 9,
    minute: 10,
    async run(c) {
      await deleteTaskMirror(c, shared.dentist);
      const before = countedShape(await recordFor(c, c.day));
      expect((await deleteForeverMirror(c, shared.dentist)).ok).toBe(true);
      expect(countedShape(await recordFor(c, c.day))).toEqual(before);
    },
  },
  {
    label: 'S27 log Stretch Nov 12 fallback (+6, after the backup)',
    day: '2026-11-12',
    hour: 8,
    async run(c) {
      await logStep(c, shared.stretch, '2026-11-12', 'fallback');
      expect(await c.db.repos.progress.lifetimeXp()).toBe(64);
    },
  },
  {
    label: 'S28 delete Stretch',
    day: '2026-11-12',
    hour: 8,
    minute: 10,
    async run(c) {
      expect((await deleteTaskMirror(c, shared.stretch)).ok).toBe(true);
    },
  },
  {
    label: 'S29 empty Recently deleted (delete everything for good)',
    day: '2026-11-13',
    hour: 8,
    async run(c) {
      const before = countedShape(await recordFor(c, c.day));
      const r = await emptyRecentlyDeletedMirror(c);
      expect(r).toEqual({ ok: true, value: 1 });
      expect(rawCount(`SELECT COUNT(*) AS n FROM task`)).toBe(0);
      expect(countedShape(await recordFor(c, c.day))).toEqual(before);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(64);
    },
  },
  {
    label: 'S30 restore the Nov 10 backup (everything after it is gone)',
    day: '2026-11-14',
    hour: 8,
    async run(c) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('../testSupport/fileSystemTestDouble') as FileSystemDouble;
      fs.__write(shared.backupUri, shared.backupText);
      const r = await c.db.store.restore(shared.backupUri);
      expect(r.ok).toBe(true);
      const after = await snapshot(c, '2026-11-10' as LocalDate);
      expect(after.tables).toEqual(shared.backupSnap.tables);
      expect(after.record).toEqual(shared.backupSnap.record);
      expect(after.lifetimeXp).toBe(shared.backupSnap.lifetimeXp);
      expect(await c.db.repos.progress.lifetimeXp()).toBe(48);
    },
  },
  {
    label: 'S31 after the restore: Stretch is back, the post-backup days are gone',
    day: '2026-11-14',
    hour: 8,
    minute: 30,
    async run(c) {
      expect((await liveTask(c, shared.stretch))?.name).toBe('Stretch');
      expect(await outcomesOf(c, shared.stretch, '2026-11-11')).toEqual(['missed']);
      expect(await outcomesOf(c, shared.stretch, '2026-11-12')).toEqual(['missed']);
      // The Nov 10 backup was taken while Dentist sat in Recently deleted, so it comes back there.
      expect(await liveTask(c, shared.dentist)).toBeNull();
      expect(rawCount(`SELECT COUNT(*) AS n FROM task WHERE id = ? AND deleted_at IS NOT NULL`, [shared.dentist])).toBe(1);
      await logStep(c, shared.stretch, '2026-11-14', 'done');
      expect(await c.db.repos.progress.lifetimeXp()).toBe(58);
    },
  },
];

describe('two-week script with a cold start before every step (real SQLite, file-backed)', () => {
  it('every step reads back exactly what the previous step wrote, and the record and lifetime XP survive each restart', async () => {
    newDatabaseDir();
    let prev: { label: string; day: LocalDate; snap: Snap } | null = null;
    for (const step of SCRIPT) {
      const c = await launch(clockAt(step.day, step.hour, step.minute ?? 0));
      if (prev) {
        // Compare with the previous step's clock, so a day rolling over does not count as a change.
        const now = await snapshot(c, prev.day);
        expect({ after: prev.label, snap: now }).toEqual({ after: prev.label, snap: prev.snap });
      }
      await step.run(c);
      await assertInvariants(c);
      prev = { label: step.label, day: c.day, snap: await snapshot(c, c.day) };
    }
  }, 300000);
});

/* ----------------------------------------------------------------- shared helpers for the scenarios below */

function makeDir(): string {
  const dir = makeTempDir('fallback-edge-restarts-');
  createdDirs.push(dir);
  return dir;
}
/** Points the next launch at another database directory (the expo-sqlite double reads it on launch). */
function useDir(dir: string): void {
  (globalThis as { __erDir?: string }).__erDir = dir;
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function instantPlus(at: Instant, ms: number): Instant {
  return new Date(Date.parse(at) + ms).toISOString() as Instant;
}

/** Builds a store file at `version` with the real migration SQL, then runs `seed` on it. */
function buildStore(dir: string, version: number, seed?: (c: DatabaseSync) => void): void {
  const c = new DatabaseSync(joinPath(dir, DB_FILE));
  try {
    for (const m of MIGRATIONS.filter((x) => x.version <= version)) {
      c.exec(m.up);
      c.exec(`PRAGMA user_version = ${m.version};`);
    }
    seed?.(c);
  } finally {
    c.close();
  }
}

/** Inserts only the columns that exist at the version the row is written for. */
function insertRow(c: DatabaseSync, table: string, row: Record<string, unknown>): void {
  const existing = new Set((c.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[]).map((r) => r.name));
  const keys = Object.keys(row).filter((k) => existing.has(k));
  c.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...(keys.map((k) => row[k]) as never[]));
}

/**
 * Makes every repository call from this launch hang from call number `killAt` on, which is what a
 * kill looks like to the rest of the app: the statement at that point never runs. `killAt` null
 * changes nothing. The counter counts every repository call, reads included.
 */
function instrumentWrites(c: Ctx, killAt: number | null, counter: { n: number }): void {
  for (const repo of Object.values(c.db.repos) as unknown as Record<string, unknown>[]) {
    for (const key of Object.keys(repo)) {
      const fn = repo[key];
      if (typeof fn !== 'function') continue;
      repo[key] = (...args: unknown[]) => {
        const index = counter.n;
        counter.n += 1;
        if (killAt !== null && index >= killAt) return new Promise<never>(() => undefined);
        return (fn as (...a: unknown[]) => unknown).apply(repo, args);
      };
    }
  }
}

/** Runs steps with a cold start before each, comparing what is stored with the previous step's state. */
async function runSteps(steps: readonly ScriptStep[]): Promise<void> {
  let prev: { label: string; day: LocalDate; snap: Snap } | null = null;
  for (const step of steps) {
    const c = await launch(clockAt(step.day, step.hour, step.minute ?? 0));
    if (prev) {
      const now = await snapshot(c, prev.day);
      expect({ after: prev.label, snap: now }).toEqual({ after: prev.label, snap: prev.snap });
    }
    await step.run(c);
    await assertInvariants(c);
    prev = { label: step.label, day: c.day, snap: await snapshot(c, c.day) };
  }
}

/* ----------------------------------------------------------------- 2. a kill in the middle of a write */

/** Logs one routine done with the app killed at repository call `killAt` (null: not killed). */
async function logWithKillAt(killAt: number | null): Promise<{ total: number; logRows: number; awardRows: number; lifetime: number }> {
  newDatabaseDir();
  const a = await launch(clockAt('2026-11-02', 9));
  const taskId = await addTask(a, makeRoutine(a.at, 'Stretch'));
  const counter = { n: 0 };
  instrumentWrites(a, killAt, counter);
  const write = a.mut.__testing__.logState({ taskId: taskId as never, date: '2026-11-02' as LocalDate, chip: 'done' });
  if (killAt === null) await write;
  else await sleep(30);
  const total = counter.n;
  const b = await launch(clockAt('2026-11-02', 10));
  return {
    total,
    logRows: rawCount(`SELECT COUNT(*) AS n FROM day_log WHERE task_id = ? AND chip_state = 'done'`, [taskId]),
    awardRows: rawCount(`SELECT COUNT(*) AS n FROM xp_award WHERE task_id = ?`, [taskId]),
    lifetime: await b.db.repos.progress.lifetimeXp(),
  };
}

describe('a write cut short by the app being killed, then a cold start', () => {
  it('a kill before the first statement leaves the old state, with no XP and no logged day', async () => {
    const r = await logWithKillAt(0);
    expect({ logRows: r.logRows, awardRows: r.awardRows, lifetime: r.lifetime }).toEqual({ logRows: 0, awardRows: 0, lifetime: 0 });
  }, 60000);

  it('a kill after the write completes keeps the new state: the logged day and its XP together', async () => {
    const r = await logWithKillAt(null);
    expect({ logRows: r.logRows, awardRows: r.awardRows, lifetime: r.lifetime }).toEqual({ logRows: 1, awardRows: 1, lifetime: 10 });
  }, 60000);

  // Was a defect: `logState` writes the day log, then `reconcileOccurrence` writes the XP award as a
  // separate statement, so a kill in between left a logged day with no XP. The next launch now runs
  // `healMissingXp` (src/queries/healXp.ts), which adds any award a logged day is owed.
  it('a kill at any point of a log write never leaves a logged day without its XP after the next launch', async () => {
    const base = await logWithKillAt(null);
    const bad: Array<{ killAt: number; logRows: number; awardRows: number }> = [];
    for (let k = 0; k < base.total; k++) {
      const r = await logWithKillAt(k);
      if (r.logRows !== r.awardRows) bad.push({ killAt: k, logRows: r.logRows, awardRows: r.awardRows });
    }
    expect(bad).toEqual([]);
  }, 300000);

  it('a cold start while a log write is still in flight on the old connection sees a consistent store, and the write lands', async () => {
    for (const ticks of [0, 1, 2, 4, 8]) {
      newDatabaseDir();
      const a = await launch(clockAt('2026-11-02', 9));
      const taskId = await addTask(a, makeRoutine(a.at, 'Stretch'));
      const write = a.mut.__testing__.logState({ taskId: taskId as never, date: '2026-11-02' as LocalDate, chip: 'done' });
      for (let i = 0; i < ticks; i++) await sleep(0);
      // Not awaited: the new launch opens while the old write is still running.
      const b = await launch(clockAt('2026-11-02', 10));
      expect(await b.db.store.status()).toBe('ready');
      await write;
      const c = await launch(clockAt('2026-11-02', 11));
      expect(rawCount(`SELECT COUNT(*) AS n FROM day_log WHERE task_id = ? AND chip_state = 'done'`, [taskId])).toBe(1);
      expect(rawCount(`SELECT COUNT(*) AS n FROM xp_award WHERE task_id = ?`, [taskId])).toBe(1);
      await assertInvariants(c);
    }
  }, 120000);
});

/* ----------------------------------------------------------------- 3. two connections open at once */

describe('an old screen still holding a connection while a new launch writes', () => {
  it('both connections write, each sees the other, and a fresh launch agrees with both', async () => {
    newDatabaseDir();
    const a = await launch(clockAt('2026-11-01', 9));
    const stretch = await addTask(a, makeRoutine(a.at, 'Stretch'));
    const read = await addTask(a, makeRoutine(a.at, 'Read'));
    // `a` stays open, as an old screen would; `b` is a new launch on the same file.
    const b = await launch(clockAt('2026-11-12', 9), { sweep: false });
    const a2 = { ...a, at: clockAt('2026-11-12', 9), day: '2026-11-12' as LocalDate };

    for (let r = 0; r < 10; r++) {
      const date = addDays('2026-11-02' as LocalDate, r);
      const results = await Promise.all([
        a.mut.__testing__.logState({ taskId: stretch as never, date, chip: 'done' }),
        b.mut.__testing__.logState({ taskId: read as never, date, chip: 'fallback' }),
      ]);
      expect(results.map((x) => x.ok)).toEqual([true, true]);
    }
    // Both sides racing on one occurrence: the last write wins, and the award follows it.
    await Promise.all([
      a.mut.__testing__.logState({ taskId: stretch as never, date: '2026-11-11' as LocalDate, chip: 'done' }),
      b.mut.__testing__.logState({ taskId: stretch as never, date: '2026-11-11' as LocalDate, chip: 'fallback' }),
    ]);
    const outcome = (await recordFor(a2, '2026-11-12' as LocalDate)).find((o) => o.taskId === stretch && o.date === '2026-11-11');
    const award = rawAll<{ kind: string; amount: number }>(`SELECT kind, amount FROM xp_award WHERE task_id = ? AND date = '2026-11-11'`, [stretch]);
    expect(outcome?.outcome === 'ideal' || outcome?.outcome === 'fallback').toBe(true);
    expect(award).toHaveLength(1);
    expect(award[0]).toEqual({ kind: outcome!.outcome, amount: outcome!.outcome === 'ideal' ? 10 : 6 });

    // A third launch, after both are gone, reads exactly what both connections see.
    const c = await launch(clockAt('2026-11-12', 10), { sweep: false });
    expect(await snapshot(c, '2026-11-12' as LocalDate)).toEqual(await snapshot(a2 as Ctx, '2026-11-12' as LocalDate));
    expect(await snapshot(c, '2026-11-12' as LocalDate)).toEqual(await snapshot(b, '2026-11-12' as LocalDate));
    await assertInvariants(c);
  }, 120000);
});

/* ----------------------------------------------------------------- 4. the 30-day sweep across relaunches */

/** A routine with twelve days of history, then deleted at 2026-10-01 09:00 (the clock is set per day). */
async function deletedHabitWithHistory(): Promise<{ id: string; deletedAt: Instant }> {
  newDatabaseDir();
  const created = clockAt('2026-09-20', 9);
  const first = await launch(created);
  const id = await addTask(first, makeRoutine(created, 'Walk'));
  const chips = ['done', 'fallback', 'skip', 'done', 'todo', 'fallback'] as const;
  for (let i = 0; i < 10; i++) {
    const day = addDays('2026-09-21' as LocalDate, i);
    setClock(clockAt(day, 10));
    await first.mut.__testing__.logState({ taskId: id as never, date: day, chip: chips[i % chips.length]! });
  }
  const deletedAt = clockAt('2026-10-01', 9);
  const onDelete = await launch(deletedAt);
  expect((await deleteTaskMirror(onDelete, id)).ok).toBe(true);
  return { id, deletedAt };
}

describe('the 30-day sweep, across many relaunches', () => {
  it('removes the habit only once, at the first launch past 30 days, and what counts is unchanged for a fixed day', async () => {
    const { id, deletedAt } = await deletedHabitWithHistory();
    const fixedDay = '2026-10-15' as LocalDate;
    const before = await snapshot(await launch(instantPlus(deletedAt, DAY_MS), { sweep: false }), fixedDay);
    const beforeCounted = countedShape(await recordFor(await launch(instantPlus(deletedAt, DAY_MS), { sweep: false }), fixedDay));
    expect(before.record.some((line) => line.startsWith(`${id}|`))).toBe(true);

    const kept = [1, 5, 10, 20, 29, 30].map((days) => instantPlus(deletedAt, days * DAY_MS));
    for (const at of kept) {
      const c = await launch(at);
      expect(rawCount(`SELECT COUNT(*) AS n FROM task WHERE id = ?`, [id])).toBe(1);
      expect(recordLines(await recordFor(c, fixedDay))).toEqual(before.record);
      await assertInvariants(c);
    }

    // 30 days and one millisecond: the first launch that removes it.
    const removing = await launch(instantPlus(deletedAt, 30 * DAY_MS + 1));
    expect(rawCount(`SELECT COUNT(*) AS n FROM task WHERE id = ?`, [id])).toBe(0);
    const keptDays = rawCount(`SELECT COUNT(*) AS n FROM retired_day`);
    expect(keptDays).toBeGreaterThan(0);
    expect(countedShape(await recordFor(removing, fixedDay))).toEqual(beforeCounted);
    await assertInvariants(removing);

    // Many launches afterwards, some a year later: nothing is removed again, nothing is duplicated.
    for (const days of [31, 35, 60, 365, 400]) {
      const c = await launch(instantPlus(deletedAt, days * DAY_MS));
      expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(keptDays);
      expect(countedShape(await recordFor(c, fixedDay))).toEqual(beforeCounted);
      await assertInvariants(c);
    }
  }, 300000);

  it('two launches sweeping at the same moment remove the habit once between them', async () => {
    const { id, deletedAt } = await deletedHabitWithHistory();
    const at = instantPlus(deletedAt, 31 * DAY_MS);
    const a = await launch(at, { sweep: false });
    const b = await launch(at, { sweep: false });
    const [na, nb] = await Promise.all([a.int.retireDeleted(a.db.repos, 'expired'), b.int.retireDeleted(b.db.repos, 'expired')]);
    expect(na.ok && nb.ok).toBe(true);
    expect((na.ok ? na.value : 0) + (nb.ok ? nb.value : 0)).toBe(1);
    expect(rawCount(`SELECT COUNT(*) AS n FROM task WHERE id = ?`, [id])).toBe(0);
    const keptDays = rawCount(`SELECT COUNT(*) AS n FROM retired_day`);
    const c = await launch(instantPlus(deletedAt, 32 * DAY_MS));
    expect(rawCount(`SELECT COUNT(*) AS n FROM retired_day`)).toBe(keptDays);
    await assertInvariants(c);
  }, 120000);
});

/* ----------------------------------------------------------------- 5. upgrade from a v7 store with real data */

const T_SEED = '2026-10-19T09:00:00.000Z';

/** Realistic v7 data: two routines with three weeks of logs, an off mark for everything and for one habit, XP per shown-up day, a deleted habit. */
function seedV7(c: DatabaseSync): void {
  insertRow(c, 'settings', {
    id: 1,
    theme: 'dark',
    accent: 'indigo',
    tenure_anchor_date: '2026-10-19',
    cycle_cadence: 'monthly',
    notif_master: 1,
    notif_routine_due: 1,
    notif_digest_time: '07:30',
    updated_at: T_SEED,
  });
  insertRow(c, 'cycle_state', { id: 1, current_cycle_id: 'cyc-nov', cadence: 'monthly', start_date: '2026-11-01', end_date: '2026-11-30' });
  const base = { icon: 'Repeat', color: 'indigo', is_as_needed: 0, doses_per_day: 1, is_tracked: 0, created_at: T_SEED, updated_at: T_SEED, cadence_kind: 'daily' };
  insertRow(c, 'task', { ...base, id: 't-read', type: 'routine', name: 'Read 📚 "twice"\nsecond line', note: null, deleted_at: null });
  insertRow(c, 'task', { ...base, id: 't-walk', type: 'routine', name: 'Walk', note: null, deleted_at: null });
  insertRow(c, 'task', { ...base, id: 't-old', type: 'routine', name: 'Old habit', note: null, deleted_at: '2026-10-28T09:00:00.000Z' });
  insertRow(c, 'step', { id: 's-read-1', task_id: 't-read', role: 'ideal', text: 'Open the book', position: 0 });
  insertRow(c, 'step', { id: 's-read-2', task_id: 't-read', role: 'fallback', text: 'Read one line', position: 0 });
  insertRow(c, 'step', { id: 's-walk-1', task_id: 't-walk', role: 'ideal', text: 'Walk 20 min', position: 0 });
  const chipsRead = ['done', 'fallback', 'skip', 'todo'] as const;
  for (let i = 0; i < 13; i++) {
    const date = addDays('2026-10-20' as LocalDate, i);
    const read = chipsRead[i % 4]!;
    insertRow(c, 'day_log', {
      id: `log-read-${date}`,
      task_id: 't-read',
      date,
      chip_state: read,
      is_manual_override: 1,
      completed_step_ids: read === 'done' ? '["s-read-1"]' : '[]',
      doses_completed: 0,
      created_at: T_SEED,
      updated_at: T_SEED,
    });
    if (read === 'done' || read === 'fallback') {
      insertRow(c, 'xp_award', { id: `xp-read-${date}`, task_id: 't-read', date, kind: read === 'done' ? 'ideal' : 'fallback', amount: read === 'done' ? 10 : 6, cycle_id: 'cyc-nov', created_at: T_SEED });
    }
    if (i !== 7) {
      const walk = i % 3 === 0 ? 'done' : null;
      if (walk) {
        insertRow(c, 'day_log', { id: `log-walk-${date}`, task_id: 't-walk', date, chip_state: walk, is_manual_override: 1, completed_step_ids: '["s-walk-1"]', doses_completed: 0, created_at: T_SEED, updated_at: T_SEED });
        insertRow(c, 'xp_award', { id: `xp-walk-${date}`, task_id: 't-walk', date, kind: 'ideal', amount: 10, cycle_id: 'cyc-nov', created_at: T_SEED });
      }
    }
  }
  insertRow(c, 'off_day_mark', { id: 'off-all-oct25', date: '2026-10-25', task_id: null, prior_chip_state: null, created_at: T_SEED });
  insertRow(c, 'off_day_mark', { id: 'off-walk-oct27', date: '2026-10-27', task_id: 't-walk', prior_chip_state: null, created_at: T_SEED });
}

describe('upgrade from a v7 store with real data, then on to v8', () => {
  it('the upgraded store matches a store built at v8 from the same data, and the script continues on it', async () => {
    const upgradeDir = makeDir();
    const twinDir = makeDir();
    buildStore(upgradeDir, 7, seedV7);
    buildStore(twinDir, 8, seedV7);

    useDir(twinDir);
    const twin = await launch(clockAt('2026-11-02', 10));
    const twinSnap = await snapshot(twin, '2026-11-02' as LocalDate);

    useDir(upgradeDir);
    const up = await launch(clockAt('2026-11-02', 10));
    expect(rawAll<{ user_version: number }>('PRAGMA user_version')[0]?.user_version).toBe(CURRENT_SCHEMA_VERSION);
    const upSnap = await snapshot(up, '2026-11-02' as LocalDate);
    expect(upSnap.tables).toEqual(twinSnap.tables);
    expect(upSnap.record).toEqual(twinSnap.record);
    expect(upSnap.lifetimeXp).toBe(twinSnap.lifetimeXp);
    expect(upSnap.lifetimeXp).toBe(rawCount(`SELECT COALESCE(SUM(amount), 0) AS n FROM xp_award`));
    expect(rawCount(`SELECT COUNT(*) AS n FROM day_log WHERE task_id = 't-read'`)).toBe(13);
    await assertInvariants(up);

    // The script goes on, on the upgraded store, with a cold start before each step.
    const base = upSnap.lifetimeXp;
    await runSteps([
      {
        label: 'U1 log Read Nov 2 done (+10, ended days are untouched)',
        day: '2026-11-02',
        hour: 11,
        async run(c) {
          const r = await c.mut.__testing__.logState({ taskId: 't-read' as never, date: '2026-11-02' as LocalDate, chip: 'done' });
          expect(r).toMatchObject({ ok: true, value: { outcome: 'ideal', xpAwarded: 10 } });
          expect(await c.db.repos.progress.lifetimeXp()).toBe(base + 10);
        },
      },
      {
        label: 'U2 end Read (done today, so it ends today)',
        day: '2026-11-02',
        hour: 12,
        async run(c) {
          const r = await endTaskMirror(c, 't-read');
          expect(r).toMatchObject({ ok: true, value: '2026-11-02' });
          expect(await outcomesOf(c, 't-read', '2026-11-02')).toEqual(['ideal']);
        },
      },
      {
        label: 'U3 delete Walk',
        day: '2026-11-03',
        hour: 9,
        async run(c) {
          const before = countedShape(await recordFor(c, c.day));
          expect((await deleteTaskMirror(c, 't-walk')).ok).toBe(true);
          expect(countedShape(await recordFor(c, c.day))).toEqual(before);
        },
      },
      {
        label: 'U4 delete Walk for good (the record keeps its days)',
        day: '2026-11-04',
        hour: 9,
        async run(c) {
          const before = countedShape(await recordFor(c, c.day));
          expect((await deleteForeverMirror(c, 't-walk')).ok).toBe(true);
          expect(countedShape(await recordFor(c, c.day))).toEqual(before);
          expect(await c.db.repos.progress.lifetimeXp()).toBe(rawCount(`SELECT COALESCE(SUM(amount), 0) AS n FROM xp_award`));
        },
      },
    ]);
  }, 180000);
});

/* ----------------------------------------------------------------- 6. a backup that is restored after a week */

describe('backup taken, then restored after the store has moved on', () => {
  it('the restore brings back exactly the backed-up state, with the days logged after the backup gone', async () => {
    newDatabaseDir();
    const a = await launch(clockAt('2026-11-02', 9));
    const id = await addTask(a, makeRoutine(a.at, 'Stretch'));
    await a.mut.__testing__.logState({ taskId: id as never, date: '2026-11-02' as LocalDate, chip: 'done' });
    const c1 = await launch(clockAt('2026-11-03', 9));
    await c1.mut.__testing__.logState({ taskId: id as never, date: '2026-11-03' as LocalDate, chip: 'fallback' });
    const c2 = await launch(clockAt('2026-11-04', 9));
    const snapAtBackup = await snapshot(c2, '2026-11-04' as LocalDate);
    const backed = await c2.db.store.backup();
    if (!backed.ok) throw new Error('backup failed');
    const fs = require('../testSupport/fileSystemTestDouble') as FileSystemDouble;
    const text = fs.__read(backed.value.uri);
    // The store moves on: a shown-up day, a deletion and a removal for good.
    const c3 = await launch(clockAt('2026-11-05', 9));
    await c3.mut.__testing__.logState({ taskId: id as never, date: '2026-11-05' as LocalDate, chip: 'done' });
    expect((await deleteTaskMirror(c3, id)).ok).toBe(true);

    const c4 = await launch(clockAt('2026-11-06', 9));
    // The file double keeps files per module registry, so write into this launch's copy.
    const fsNow = require('../testSupport/fileSystemTestDouble') as FileSystemDouble;
    fsNow.__write(backed.value.uri, text);
    const restoreResult = await c4.db.store.restore(backed.value.uri);
    expect(restoreResult).toEqual({ ok: true, value: undefined });
    const restored = await snapshot(c4, '2026-11-04' as LocalDate);
    expect(restored.tables).toEqual(snapAtBackup.tables);
    expect(restored.record).toEqual(snapAtBackup.record);
    expect(restored.lifetimeXp).toBe(snapAtBackup.lifetimeXp);

    // Cold start after the restore: nothing moves, and the Nov 5 win is gone for good.
    const c5 = await launch(clockAt('2026-11-07', 9));
    expect(await snapshot(c5, '2026-11-04' as LocalDate)).toEqual(restored);
    expect(await outcomesOf(c5, id, '2026-11-05')).toEqual(['missed']);
    await assertInvariants(c5);
  }, 120000);
});
