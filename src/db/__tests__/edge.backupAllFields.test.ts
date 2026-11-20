/**
 * Backup and restore with EVERY column (edge campaign, round 4, area 47). Real SQLite through the
 * file-backed expo-sqlite double (same harness as `edge.storage.test.ts`). The store is seeded
 * with a non-default value in every column of every backed-up table, backed up, erased, restored,
 * and compared field by field. Columns come from `PRAGMA table_info`, so a column added later is
 * compared automatically. Old envelopes (schema 7 and 8) are hand-built with only the columns those
 * versions had, restored into a v9 store, and the record is compared before and after.
 */
import { makeTempDir, removeDir, joinPath } from '../testSupport/nodeTempFiles';

import { DatabaseSync } from 'node:sqlite';

import { DB_NAME } from '../client';
import { MIGRATIONS } from '../migrations';
import type { LocalDate } from '@/types';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});
function newDir(): string {
  const dir = makeTempDir('fallback-edge-backup-');
  createdDirs.push(dir);
  return dir;
}

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __ebDir?: string }).__ebDir,
  }),
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));
// The double is the in-memory file store; the Storage Access Framework calls are plain mocks,
// configured per test (see the offer tests below).
jest.mock('expo-file-system/legacy', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const double = require('../testSupport/fileSystemTestDouble');
  return { ...double, StorageAccessFramework: { requestDirectoryPermissionsAsync: jest.fn(), createFileAsync: jest.fn() } };
});
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Share: { share: jest.fn(async () => ({ action: 'sharedAction' })) },
}));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  return {
    ...actual,
    now: () => ((globalThis as { __ebNow?: string }).__ebNow as ReturnType<typeof actual.now>) ?? actual.now(),
  };
});

type App = typeof import('@/db');
type Row = Record<string, unknown>;
type Rows = Record<string, Row[]>;
interface ColumnInfo {
  name: string;
  type: string;
  dflt_value: string | null;
}
interface FileDouble {
  readAsStringAsync(uri: string): Promise<string>;
  writeAsStringAsync(uri: string, contents: string): Promise<void>;
  __read(uri: string): string;
  __write(uri: string, contents: string): void;
  documentDirectory: string;
}
interface SafDouble {
  requestDirectoryPermissionsAsync: jest.Mock;
  createFileAsync: jest.Mock;
}

const TODAY = '2026-03-30' as LocalDate;
const MB = 1024 * 1024;

// Jest sandboxes process.env, so a TZ set inside a test never reaches Date or SQLite. Every expected
// local day below comes from the app's own helper instead, so the test holds in whatever zone the
// process runs in (run `TZ=Pacific/Kiritimati npx jest ...` to try another zone).
beforeEach(() => {
  (globalThis as { __ebNow?: string }).__ebNow = undefined;
});
function setClock(instant: string | undefined): void {
  (globalThis as { __ebNow?: string }).__ebNow = instant;
}

/** A new app launch on the directory: fresh modules, a new connection. Every later require reads that registry. */
async function start(dir: string): Promise<App> {
  (globalThis as { __ebDir?: string }).__ebDir = dir;
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const app = require('@/db') as App;
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error(`store did not open ready: ${JSON.stringify(opened)}`);
  return app;
}
function fileDouble(): FileDouble {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system/legacy') as FileDouble;
}
function saf(): SafDouble {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('expo-file-system/legacy') as unknown as { StorageAccessFramework: SafDouble }).StorageAccessFramework;
}
/** The UTF-8 bytes of a string, as a comparable string of byte values (no Buffer in this project's types). */
function utf8(text: string): string {
  return unescape(encodeURIComponent(text));
}
function localDay(instant: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('@/lib/date') as typeof import('@/lib/date')).toLocalDate(new Date(instant));
}

// ---------------------------------------------------------------- raw SQLite helpers

function openRaw(dir: string): DatabaseSync {
  const conn = new DatabaseSync(joinPath(dir, DB_NAME));
  conn.exec('PRAGMA foreign_keys = ON;');
  return conn;
}
function withRaw<T>(dir: string, fn: (conn: DatabaseSync) => T): T {
  const conn = openRaw(dir);
  try {
    return fn(conn);
  } finally {
    conn.close();
  }
}
/** A file at the given schema version, built by running the real migration SQL. */
function createStoreAt(dir: string, upTo: number): void {
  withRaw(dir, (conn) => {
    for (const m of MIGRATIONS.filter((x) => x.version <= upTo)) {
      conn.exec('BEGIN');
      conn.exec(m.up);
      conn.exec(`PRAGMA user_version = ${m.version};`);
      conn.exec('COMMIT');
    }
  });
}
function columnsOf(conn: DatabaseSync, table: string): ColumnInfo[] {
  return conn.prepare(`PRAGMA table_info(${table})`).all() as unknown as ColumnInfo[];
}
function userTables(conn: DatabaseSync): string[] {
  return (
    conn.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as {
      name: string;
    }[]
  ).map((r) => r.name);
}
function genericValue(col: ColumnInfo): unknown {
  const t = col.type.toUpperCase();
  if (t.includes('INT')) return 1;
  if (t === 'REAL') return 0.5;
  return `x-${col.name}`;
}
/** Inserts rows with explicit columns. `fill` adds a non-default generic value for any column not named. */
function insertRows(conn: DatabaseSync, table: string, rows: Row[], fill: boolean): void {
  const info = columnsOf(conn, table);
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!info.some((c) => c.name === key)) throw new Error(`${table} has no column "${key}" at this schema`);
    }
    const full: Row = { ...row };
    if (fill) for (const col of info) if (!(col.name in full)) full[col.name] = genericValue(col);
    const names = Object.keys(full);
    conn
      .prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`)
      .run(...(names.map((n) => full[n]) as (string | number | null)[]));
  }
}

// ---------------------------------------------------------------- the full v9 seed

const TASK_BASE: Row = {
  id: '',
  type: 'routine',
  name: '',
  note: null,
  icon: 'Repeat',
  color: 'forge-orange',
  is_as_needed: 0,
  cadence_kind: 'daily',
  cadence_weekdays: null,
  cadence_weekday: null,
  cadence_day_of_month: null,
  cadence_month: null,
  cadence_anchor_date: null,
  event_date: null,
  time_of_day: null,
  start_date: null,
  end_date: null,
  doses_per_day: 1,
  is_tracked: 0,
  importance: null,
  necessity: null,
  todo_done_at: null,
  created_at: '2026-02-01T12:00:00.000Z',
  updated_at: '2026-02-01T12:00:00.000Z',
  deleted_at: null,
  snoozable: 1,
  is_note: 0,
  priority_rank: null,
};

const SETTINGS_V9: Row = {
  id: 1,
  theme: 'dark',
  accent: 'berry',
  accent_ext: 'hue-200',
  onboarding_completed_at: '2026-01-02T08:00:00.000Z',
  tenure_anchor_date: '2025-12-31',
  cycle_cadence: 'weekly',
  notif_master: 1,
  notif_routine_due: 1,
  notif_event_starting: 1,
  notif_course_dose: 1,
  notif_course_ending_soon: 1,
  notif_gentle_reentry: 1,
  notif_milestone_reached: 1,
  notif_daily_digest: 1,
  notif_digest_time: '07:15',
  assistant_language: 'fr-FR',
  assistant_voice: 'brisk',
  sync_enabled: 1,
  sync_last_synced_at: '2026-06-08T06:00:00.000Z',
  sync_last_error: 'timeout after 30s',
  last_backup_at: '2026-06-08T00:00:00.000Z',
  updated_at: '2026-06-08T07:00:00.000Z',
};

const TASKS_V9: Row[] = [
  {
    ...TASK_BASE,
    id: 'task-a',
    type: 'routine',
    name: 'Stretch 🧘‍♀️ café 日本',
    note: 'Line one\nline "two"',
    icon: 'Flame',
    color: 'plum',
    is_as_needed: 1,
    cadence_kind: 'specific-weekdays',
    cadence_weekdays: '[1,3,5]',
    cadence_weekday: 2,
    cadence_day_of_month: 15,
    cadence_month: 6,
    cadence_anchor_date: '2026-01-05',
    event_date: '2026-06-30',
    time_of_day: '09:30',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    doses_per_day: 3,
    is_tracked: 1,
    importance: 'high',
    necessity: 'must-do',
    created_at: '2026-01-15T23:30:00.000Z',
    updated_at: '2026-06-08T06:30:00.000Z',
    snoozable: 0,
    is_note: 0,
    priority_rank: 4,
    ended_on: null,
    // Stored as the device saw the day; deliberately NOT the UTC date of created_at (23:30Z).
    created_on: '2026-01-16',
    deleted_on: null,
  },
  {
    // Ended AND soft-deleted: its local deletion day differs from the UTC day of deleted_at.
    ...TASK_BASE,
    id: 'task-b',
    type: 'routine',
    name: 'Read "quoted"\r\nCRLF \\ backslash',
    note: null,
    icon: 'BookOpen',
    color: 'indigo',
    cadence_kind: 'bi-weekly',
    cadence_weekday: 5,
    cadence_anchor_date: '2026-02-02',
    importance: 'med',
    necessity: 'recommended',
    created_at: '2026-02-02T12:00:00.000Z',
    updated_at: '2026-06-02T23:30:00.000Z',
    deleted_at: '2026-06-02T23:30:00.000Z',
    priority_rank: null,
    ended_on: '2026-05-31',
    created_on: '2026-02-02',
    deleted_on: '2026-06-03',
  },
  {
    ...TASK_BASE,
    id: 'task-c',
    type: 'course',
    name: 'Course 💊',
    icon: 'Pill',
    color: 'berry',
    cadence_kind: 'daily',
    start_date: '2026-03-01',
    end_date: '2026-04-30',
    doses_per_day: 2,
    is_tracked: 1,
    importance: 'low',
    necessity: 'optional',
    created_at: '2026-02-28T09:00:00.000Z',
    updated_at: '2026-02-28T09:00:00.000Z',
    priority_rank: 1,
    ended_on: null,
    created_on: '2026-02-28',
    deleted_on: null,
  },
  {
    ...TASK_BASE,
    id: 'task-d',
    type: 'event',
    name: 'Dentist',
    icon: 'Stethoscope',
    color: 'forge-orange',
    cadence_kind: null,
    event_date: '2026-07-01',
    time_of_day: '14:45',
    created_at: '2026-06-01T08:00:00.000Z',
    updated_at: '2026-06-01T08:00:00.000Z',
    ended_on: null,
    created_on: '2026-06-01',
    deleted_on: null,
  },
  {
    ...TASK_BASE,
    id: 'task-e',
    type: 'todo',
    name: 'Renew passport',
    note: 'Bring photos',
    icon: 'FileText',
    color: 'indigo',
    cadence_kind: null,
    todo_done_at: '2026-06-09T09:00:00.000Z',
    is_note: 1,
    importance: 'low',
    necessity: 'optional',
    created_at: '2026-06-05T10:00:00.000Z',
    updated_at: '2026-06-09T09:00:00.000Z',
    ended_on: null,
    created_on: '2026-06-05',
    deleted_on: null,
  },
  {
    ...TASK_BASE,
    id: 'task-f',
    name: 'Gone habit',
    color: 'berry',
    priority_rank: 2,
    created_at: '2026-02-03T07:00:00.000Z',
    updated_at: '2026-08-10T18:00:00.000Z',
    deleted_at: '2026-08-10T18:00:00.000Z',
    ended_on: null,
    created_on: '2026-02-03',
    deleted_on: '2026-08-11',
  },
];

const STEPS: Row[] = [
  { id: 'step-a1', task_id: 'task-a', role: 'ideal', text: 'Stretch 5 min ✨', position: 0, due_weekdays: '[1,3]' },
  { id: 'step-a2', task_id: 'task-a', role: 'fallback', text: 'Two breaths', position: 1, due_weekdays: null },
  { id: 'step-b1', task_id: 'task-b', role: 'ideal', text: 'Read 10 pages', position: 0, due_weekdays: '[0,6]' },
];

const LOG_AT = '2026-06-01T07:00:00.000Z';
const LOGS: Row[] = [
  { id: 'log-1', task_id: 'task-a', date: '2026-06-01', chip_state: 'done', is_manual_override: 1, completed_step_ids: '["step-a1"]', doses_completed: 3, moved_to_date: null, created_at: LOG_AT, updated_at: LOG_AT },
  // A pushed log: moved one day on (the one-hop CHECK requires date + 1).
  { id: 'log-2', task_id: 'task-a', date: '2026-06-02', chip_state: 'fallback', is_manual_override: 0, completed_step_ids: '["step-a2"]', doses_completed: 0, moved_to_date: '2026-06-03', created_at: LOG_AT, updated_at: LOG_AT },
  { id: 'log-3', task_id: 'task-a', date: '2026-06-03', chip_state: 'skip', is_manual_override: 0, completed_step_ids: '[]', doses_completed: 0, moved_to_date: null, created_at: LOG_AT, updated_at: LOG_AT },
  { id: 'log-4', task_id: 'task-b', date: '2026-05-30', chip_state: 'todo', is_manual_override: 0, completed_step_ids: '[]', doses_completed: 0, moved_to_date: null, created_at: LOG_AT, updated_at: LOG_AT },
  { id: 'log-5', task_id: 'task-e', date: '2026-06-10', chip_state: 'done', is_manual_override: 0, completed_step_ids: '[]', doses_completed: 1, moved_to_date: null, created_at: LOG_AT, updated_at: LOG_AT },
];

const OFFS: Row[] = [
  { id: 'off-1', date: '2026-06-04', task_id: null, prior_chip_state: null, created_at: LOG_AT },
  { id: 'off-2', date: '2026-06-05', task_id: 'task-a', prior_chip_state: 'done', created_at: LOG_AT },
  { id: 'off-3', date: '2026-06-05', task_id: 'task-b', prior_chip_state: 'skip', created_at: LOG_AT },
];

const ANU: Row[] = [
  { id: 'anu-1', task_id: 'task-a', date: '2026-06-06', marker: 'ideal', created_at: LOG_AT },
  { id: 'anu-2', task_id: 'task-a', date: '2026-06-07', marker: 'fallback', created_at: LOG_AT },
  { id: 'anu-3', task_id: 'task-a', date: '2026-06-08', marker: null, created_at: LOG_AT },
];

const XP: Row[] = [
  { id: 'xp-1', task_id: 'task-a', date: '2026-06-01', kind: 'ideal', amount: 25, cycle_id: 'cyc-1', created_at: LOG_AT },
  // An award whose habit is gone: task_id NULL (ON DELETE SET NULL).
  { id: 'xp-2', task_id: null, date: '2026-06-02', kind: 'fallback', amount: 5, cycle_id: 'cyc-1', created_at: LOG_AT },
  { id: 'xp-3', task_id: 'task-b', date: '2026-05-30', kind: 'ideal', amount: 10, cycle_id: 'cyc-0', created_at: LOG_AT },
];

const ACHIEVEMENTS: Row[] = [
  { key: 'streak-7', unlocked_on: '2026-06-07', created_at: LOG_AT },
  { key: 'fallback-comeback', unlocked_on: '2026-06-01', created_at: LOG_AT },
];

const CYCLE_RECORDS: Row[] = [
  {
    id: 'cr-1',
    cadence: 'monthly',
    start_date: '2026-05-01',
    end_date: '2026-05-31',
    consistency_percent: 83,
    breakdown_ideal: 12.5,
    breakdown_fallback: 3.25,
    breakdown_off: 2,
    breakdown_missed: 1,
    cycling_xp_final: 310,
    badge_keys_unlocked: '["streak-7","fallback-comeback"]',
    is_short_cycle: 1,
    finalized_at: '2026-06-01T00:10:00.000Z',
  },
  {
    id: 'cr-2',
    cadence: 'weekly',
    start_date: '2026-05-25',
    end_date: '2026-05-31',
    consistency_percent: null,
    breakdown_ideal: 0,
    breakdown_fallback: 0,
    breakdown_off: 7,
    breakdown_missed: 0,
    cycling_xp_final: 0,
    badge_keys_unlocked: '[]',
    is_short_cycle: 0,
    finalized_at: '2026-06-01T00:10:00.000Z',
  },
];

const CYCLE_STATE: Row = { id: 1, current_cycle_id: 'cyc-1', cadence: 'weekly', start_date: '2026-06-01', end_date: '2026-06-07' };

const WIDGETS: Row[] = [
  { size: 'small-one-task', mode: 'fixed-task', fixed_task_id: 'task-a' },
  { size: 'medium-up-next', mode: 'smart-next-due', fixed_task_id: null },
  { size: 'small-today', mode: 'fixed-task', fixed_task_id: 'task-c' },
];

const RETIRED: Row[] = [
  { id: 'rd-1', date: '2026-04-01', outcome: 'missed', retired_at: '2026-06-03T00:00:00.000Z' },
  { id: 'rd-2', date: '2026-04-02', outcome: 'off', retired_at: '2026-06-03T00:00:00.000Z' },
  { id: 'rd-3', date: '2026-04-03', outcome: 'ideal', retired_at: '2026-06-03T00:00:00.000Z' },
  { id: 'rd-4', date: '2026-04-04', outcome: 'fallback', retired_at: '2026-06-03T00:00:00.000Z' },
];

// Outside the pinned backup set (SCHEMA §9): must never reach the file.
const ENTITLEMENT: Row = {
  id: 1,
  source: 'subscription',
  plan: 'annual',
  status: 'active',
  renews_on: '2027-06-01',
  trial_ends_on: null,
  has_byo_key: 0,
  byo_supports_transcription: 0,
  updated_at: LOG_AT,
};
const CONVERSATION: Row = {
  id: 'conv-1',
  started_at: LOG_AT,
  updated_at: LOG_AT,
  modality: 'voice+text',
  summary: 'chat-marker-123',
  task_ids_touched: '["task-a"]',
};
const MESSAGE: Row = { id: 'msg-1', conversation_id: 'conv-1', role: 'user', text: 'chat-marker-123 hello', tool_calls: '[]', created_at: LOG_AT };

/** Every backed-up table, in FK order, with every column set to a non-default value. */
function seedFull(dir: string): void {
  withRaw(dir, (conn) => {
    insertRows(conn, 'settings', [SETTINGS_V9], true);
    insertRows(conn, 'task', TASKS_V9, true);
    insertRows(conn, 'step', STEPS, true);
    insertRows(conn, 'day_log', LOGS, true);
    insertRows(conn, 'off_day_mark', OFFS, true);
    insertRows(conn, 'as_needed_use', ANU, true);
    insertRows(conn, 'xp_award', XP, true);
    insertRows(conn, 'achievement_unlock', ACHIEVEMENTS, true);
    insertRows(conn, 'cycle_record', CYCLE_RECORDS, true);
    insertRows(conn, 'cycle_state', [CYCLE_STATE], true);
    insertRows(conn, 'widget_config', WIDGETS, true);
    insertRows(conn, 'retired_day', RETIRED, true);
    insertRows(conn, 'entitlement', [ENTITLEMENT], true);
    insertRows(conn, 'assistant_conversation', [CONVERSATION], true);
    insertRows(conn, 'assistant_message', [MESSAGE], true);
  });
}

// ---------------------------------------------------------------- snapshots and comparison

const BACKED_UP = [
  'settings',
  'task',
  'step',
  'day_log',
  'off_day_mark',
  'as_needed_use',
  'xp_award',
  'achievement_unlock',
  'cycle_record',
  'cycle_state',
  'widget_config',
  'retired_day',
] as const;
const NOT_BACKED_UP = ['entitlement', 'assistant_conversation', 'assistant_message'] as const;

interface Snapshot {
  columns: Record<string, string[]>;
  rows: Record<string, Row[]>;
}

/** Every row of every backed-up table, sorted by content so two snapshots line up row for row. */
function snapshot(dir: string): Snapshot {
  return withRaw(dir, (conn) => {
    const out: Snapshot = { columns: {}, rows: {} };
    for (const table of BACKED_UP) {
      out.columns[table] = columnsOf(conn, table).map((c) => c.name);
      const rows = conn.prepare(`SELECT * FROM ${table}`).all() as unknown as Row[];
      out.rows[table] = rows.map((r) => ({ ...r })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    return out;
  });
}

function short(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

/** Field-by-field differences between two snapshots. Empty means identical. */
function diffSnapshots(before: Snapshot, after: Snapshot): string[] {
  const diffs: string[] = [];
  for (const table of BACKED_UP) {
    const a = before.rows[table] ?? [];
    const b = after.rows[table] ?? [];
    if (a.length !== b.length) {
      diffs.push(`${table}: ${a.length} rows before, ${b.length} after`);
      continue;
    }
    if (before.columns[table]?.join(',') !== after.columns[table]?.join(',')) diffs.push(`${table}: column list changed`);
    a.forEach((row, i) => {
      for (const col of before.columns[table] ?? []) {
        if (!Object.is(row[col], b[i]?.[col])) diffs.push(`${table}[${i}].${col}: ${short(row[col])} -> ${short(b[i]?.[col])}`);
      }
    });
  }
  return diffs;
}

/** The record as the app reads it (live, soft-deleted and retired days), normalised for comparison. */
async function recordOf(app: App): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const internal = require('@/queries/internal') as typeof import('@/queries/internal');
  const occurrences = await internal.resolveRecordOccurrences(app.repos, TODAY, TODAY);
  return occurrences.map((o) => JSON.stringify(o)).sort();
}

// ---------------------------------------------------------------- tests

describe('backup and restore with every column', () => {
  it('seeds every column of every backed-up table with a non-default value (the seed is the test)', () => {
    const dir = newDir();
    createStoreAt(dir, 9);
    seedFull(dir);
    const problems: string[] = [];
    withRaw(dir, (conn) => {
      for (const table of BACKED_UP) {
        const rows = conn.prepare(`SELECT * FROM ${table}`).all() as unknown as Row[];
        for (const col of columnsOf(conn, table)) {
          const values = rows.map((r) => r[col.name]);
          const dflt = col.dflt_value === null ? null : col.dflt_value.replace(/^'(.*)'$/s, '$1');
          const covered =
            dflt === null
              ? values.some((v) => v !== null)
              : values.some((v) => v !== null && String(v) !== dflt);
          if (!covered) problems.push(`${table}.${col.name}`);
        }
      }
    });
    expect(problems).toEqual([]);
  });

  it('the backed-up table list is the whole schema minus the pinned exclusions (a new table must be decided)', () => {
    const dir = newDir();
    createStoreAt(dir, 9);
    const tables = withRaw(dir, (conn) => userTables(conn));
    expect(tables.filter((t) => !(BACKED_UP as readonly string[]).includes(t) && !(NOT_BACKED_UP as readonly string[]).includes(t))).toEqual([]);
  });

  it('backup, erase and restore reproduce every field of every backed-up row', async () => {
    const dir = newDir();
    createStoreAt(dir, 9);
    seedFull(dir);
    const app = await start(dir);
    const before = snapshot(dir);
    const recordBefore = await recordOf(app);
    expect(before.rows.task).toHaveLength(TASKS_V9.length);

    const backup = await app.store.backup();
    expect(backup.ok).toBe(true);
    const uri = backup.ok ? backup.value.uri : '';
    const text = fileDouble().__read(uri);
    const envelope = JSON.parse(text) as { schemaVersion: number; tables: Rows };
    expect(envelope.schemaVersion).toBe(9);
    expect(Object.keys(envelope.tables).sort()).toEqual([...BACKED_UP].sort());
    // Excluded by design: no chat, no entitlement, no receipt.
    expect(text).not.toContain('chat-marker-123');
    expect(text).not.toContain('renews_on');

    expect((await app.store.eraseAll()).ok).toBe(true);
    const erased = snapshot(dir);
    expect(erased.rows.task).toHaveLength(0);
    expect(erased.rows.settings?.[0]?.theme).toBe('auto');

    const restored = await app.store.restore(uri);
    expect(restored.ok).toBe(true);
    const after = snapshot(dir);
    expect(diffSnapshots(before, after)).toEqual([]);
    expect(await recordOf(app)).toEqual(recordBefore);
  });

  it('a backup larger than 5 MB round-trips exactly', async () => {
    const dir = newDir();
    createStoreAt(dir, 9);
    const bigNote = 'Line é☕ with "quotes" and\nnewlines. '.repeat(9000); // about 0.3 MB of text per habit
    withRaw(dir, (conn) => {
      insertRows(conn, 'settings', [SETTINGS_V9], true);
      const tasks: Row[] = Array.from({ length: 20 }, (_, i) => ({
        ...TASK_BASE,
        id: `big-${i}`,
        name: `Big ${i}`,
        note: `${i}-${bigNote}`,
        ended_on: null,
        created_on: '2026-01-01',
        deleted_on: null,
      }));
      insertRows(conn, 'task', tasks, false);
    });
    const app = await start(dir);
    const before = snapshot(dir);
    const backup = await app.store.backup();
    expect(backup.ok).toBe(true);
    const uri = backup.ok ? backup.value.uri : '';
    const bytes = utf8(fileDouble().__read(uri)).length;
    expect(bytes).toBeGreaterThan(5 * MB);

    expect((await app.store.eraseAll()).ok).toBe(true);
    expect((await app.store.restore(uri)).ok).toBe(true);
    const after = snapshot(dir);
    expect(after.rows.task).toHaveLength(20);
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it('the file is named by the device-local day of the backup, in the zone the phone is in at that moment', async () => {
    const dir = newDir();
    createStoreAt(dir, 9);
    const instant = '2026-11-20T23:30:00.000Z';
    setClock(instant);
    const app = await start(dir);
    const backup = await app.store.backup();
    expect(backup.ok && backup.value.uri).toBe(`${fileDouble().documentDirectory}fallback-backup-${localDay(instant)}.fallbackbak`);
  });
});

// ---------------------------------------------------------------- older envelopes

const SETTINGS_V7: Row = {
  id: 1,
  theme: 'dark',
  accent: 'indigo',
  onboarding_completed_at: '2026-03-01T08:00:00.000Z',
  tenure_anchor_date: '2026-03-01',
  cycle_cadence: 'monthly',
  notif_master: 1,
  notif_routine_due: 1,
  notif_event_starting: 0,
  notif_course_dose: 0,
  notif_course_ending_soon: 0,
  notif_gentle_reentry: 1,
  notif_milestone_reached: 0,
  notif_daily_digest: 1,
  notif_digest_time: '08:30',
  sync_enabled: 0,
  sync_last_synced_at: null,
  sync_last_error: null,
  last_backup_at: null,
  updated_at: '2026-03-25T08:00:00.000Z',
};
const CYCLE_STATE_V7: Row = { id: 1, current_cycle_id: 'cyc-m', cadence: 'monthly', start_date: '2026-03-01', end_date: '2026-03-31' };

// Times chosen so the local day differs from the UTC day in UTC+14 (created 11:30Z, deleted 10:30Z).
const LEGACY_TASKS: Row[] = [
  { ...TASK_BASE, id: 'task-p', name: 'Walk', icon: 'Footprints', color: 'indigo', created_at: '2026-03-10T11:30:00.000Z', updated_at: '2026-03-10T11:30:00.000Z' },
  {
    ...TASK_BASE,
    id: 'task-q',
    name: 'Old habit',
    color: 'berry',
    created_at: '2026-03-01T12:00:00.000Z',
    updated_at: '2026-03-20T10:30:00.000Z',
    deleted_at: '2026-03-20T10:30:00.000Z',
  },
  { ...TASK_BASE, id: 'task-r', name: 'Water', created_at: '2026-03-05T12:00:00.000Z', updated_at: '2026-03-05T12:00:00.000Z' },
];
const LEGACY_LOGS: Row[] = [
  { id: 'lg-p1', task_id: 'task-p', date: '2026-03-11', chip_state: 'done', is_manual_override: 0, completed_step_ids: '[]', doses_completed: 0, moved_to_date: null, created_at: '2026-03-11T20:00:00.000Z', updated_at: '2026-03-11T20:00:00.000Z' },
  { id: 'lg-p2', task_id: 'task-p', date: '2026-03-12', chip_state: 'skip', is_manual_override: 0, completed_step_ids: '[]', doses_completed: 0, moved_to_date: null, created_at: '2026-03-12T20:00:00.000Z', updated_at: '2026-03-12T20:00:00.000Z' },
  { id: 'lg-q1', task_id: 'task-q', date: '2026-03-03', chip_state: 'done', is_manual_override: 0, completed_step_ids: '[]', doses_completed: 0, moved_to_date: null, created_at: '2026-03-03T20:00:00.000Z', updated_at: '2026-03-03T20:00:00.000Z' },
  { id: 'lg-r1', task_id: 'task-r', date: '2026-03-06', chip_state: 'fallback', is_manual_override: 0, completed_step_ids: '[]', doses_completed: 0, moved_to_date: null, created_at: '2026-03-06T20:00:00.000Z', updated_at: '2026-03-06T20:00:00.000Z' },
];
const LEGACY_XP: Row[] = [{ id: 'xp-p1', task_id: 'task-p', date: '2026-03-11', kind: 'ideal', amount: 10, cycle_id: 'cyc-m', created_at: '2026-03-11T20:00:00.000Z' }];
const LEGACY_OFF: Row[] = [{ id: 'off-1', date: '2026-03-13', task_id: null, prior_chip_state: null, created_at: '2026-03-13T00:00:00.000Z' }];

/** A version-8 extra: a habit ended on a day (migration 8), and two retired days from a removed habit. */
const V8_ONLY = {
  taskREndedOn: '2026-03-28',
  retired: [{ id: 'rd-1', date: '2026-03-02', outcome: 'fallback', retired_at: '2026-03-25T00:00:00.000Z' }] as Row[],
  settings: { assistant_language: 'en-GB', assistant_voice: 'warm', accent_ext: null } as Row,
};

/** The tables an envelope of this version holds, built by hand with only the columns that version had. */
function legacyTables(version: 7 | 8): Rows {
  const tasks = LEGACY_TASKS.map((t) => (version === 8 && t.id === 'task-r' ? { ...t, ended_on: V8_ONLY.taskREndedOn } : { ...t }));
  const settings = version === 8 ? { ...SETTINGS_V7, ...V8_ONLY.settings } : { ...SETTINGS_V7 };
  const tables: Rows = {
    settings: [settings],
    task: tasks,
    step: [],
    day_log: LEGACY_LOGS,
    off_day_mark: LEGACY_OFF,
    as_needed_use: [],
    xp_award: LEGACY_XP,
    achievement_unlock: [],
    cycle_record: [],
    cycle_state: [CYCLE_STATE_V7],
    widget_config: [],
  };
  if (version === 8) tables.retired_day = V8_ONLY.retired;
  return tables;
}

function legacyEnvelope(version: 7 | 8): { format: string; formatVersion: number; schemaVersion: number; createdAt: string; tables: Rows } {
  return {
    format: 'fallback-backup',
    formatVersion: 1,
    schemaVersion: version,
    createdAt: '2026-03-25T09:00:00.000Z',
    tables: legacyTables(version),
  };
}

/** Columns an older version had, from the real migrations (not hand-written DDL). */
function columnsAtVersion(version: number, table: string): string[] {
  const conn = new DatabaseSync(':memory:');
  try {
    conn.exec('PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS.filter((x) => x.version <= version)) conn.exec(m.up);
    return columnsOf(conn, table).map((c) => c.name);
  } finally {
    conn.close();
  }
}

describe('restoring an older backup into a schema 9 store', () => {
  for (const version of [7, 8] as const) {
    it(`a schema ${version} envelope, hand-built with only its columns, restores with derived days and the same record`, async () => {
      const dir = newDir();
      createStoreAt(dir, version);
      const legacy = legacyTables(version);
      withRaw(dir, (conn) => {
        for (const [table, rows] of Object.entries(legacy)) insertRows(conn, table, rows, false);
      });

      // The envelope may only use columns that version had.
      for (const [table, rows] of Object.entries(legacy)) {
        const allowed = columnsAtVersion(version, table);
        for (const row of rows) for (const key of Object.keys(row)) expect(allowed).toContain(key);
      }

      // The store as a person on that version would have it after upgrading to 9.
      const app = await start(dir);
      const beforeRecord = await recordOf(app);
      const upgraded = withRaw(dir, (conn) => {
        const rows = conn.prepare(`SELECT id, created_on, deleted_on, date(created_at, 'localtime') AS sql_created, date(deleted_at, 'localtime') AS sql_deleted FROM task`).all() as Record<string, string | null>[];
        return rows;
      });
      for (const row of upgraded) {
        expect(row.created_on).toBe(row.sql_created);
        expect(row.deleted_on).toBe(row.sql_deleted);
      }

      // The backup file, then erase, then restore.
      fileDouble().__write('file:///test-documents/old.fallbackbak', JSON.stringify(legacyEnvelope(version)));
      expect((await app.store.eraseAll()).ok).toBe(true);
      const restored = await app.store.restore('file:///test-documents/old.fallbackbak');
      expect(restored.ok).toBe(true);

      const rows = withRaw(dir, (conn) => {
        const tasks = conn.prepare(`SELECT id, created_at, created_on, deleted_at, deleted_on, ended_on FROM task ORDER BY id`).all() as Record<string, string | null>[];
        const retired = conn.prepare(`SELECT COUNT(*) AS n FROM retired_day`).get() as { n: number };
        return { tasks, retired: Number(retired.n) };
      });
      const byId = Object.fromEntries(rows.tasks.map((t) => [t.id, t]));
      // Derived as migration 9 derives them: the local day of the instant.
      expect(byId['task-p']?.created_on).toBe(localDay('2026-03-10T11:30:00.000Z'));
      expect(byId['task-q']?.created_on).toBe(localDay('2026-03-01T12:00:00.000Z'));
      expect(byId['task-q']?.deleted_on).toBe(localDay('2026-03-20T10:30:00.000Z'));
      expect(byId['task-p']?.deleted_on).toBeNull();
      if (version === 7) {
        expect(rows.tasks.every((t) => t.ended_on === null)).toBe(true);
        expect(rows.retired).toBe(0);
      } else {
        expect(byId['task-r']?.ended_on).toBe(V8_ONLY.taskREndedOn);
        expect(rows.retired).toBe(V8_ONLY.retired.length);
      }

      // The record reads the same as it did before the backup.
      const afterRecord = await recordOf(app);
      expect(afterRecord).toEqual(beforeRecord);
    });
  }
});

// ---------------------------------------------------------------- the copy the person keeps

describe('the backup file written through the Android folder picker', () => {
  const TREE = 'content://com.android.externalstorage.documents/tree/primary%3ADownload';

  // Configured AFTER `start()`: every launch is a fresh module registry, and the SAF mock must be the
  // one `offerBackupFile` imports. Modelled on the Android documents provider: a JSON file keeps the
  // name it was given if it already ends in .json, otherwise the provider appends .json for the MIME
  // type. An assumption, not verified on a phone.
  function configureSaf(): void {
    saf().requestDirectoryPermissionsAsync.mockReset();
    saf().createFileAsync.mockReset();
    saf().requestDirectoryPermissionsAsync.mockImplementation(async () => ({ granted: true, directoryUri: TREE }));
    saf().createFileAsync.mockImplementation(async (folder: string, name: string) => {
      const display = /\.json$/i.test(name) ? name : `${name}.json`;
      const dest = `${folder}/${encodeURIComponent(display)}`;
      fileDouble().__write(dest, '');
      return dest;
    });
  }

  it('the saved file is byte-identical to the backup, including non-ASCII names, and restores', async () => {
    const dir = newDir();
    createStoreAt(dir, 9);
    seedFull(dir);
    const instant = '2026-11-20T23:30:00.000Z';
    setClock(instant);
    const app = await start(dir);
    configureSaf();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const offer = require('@/features/data/offerBackupFile') as typeof import('@/features/data/offerBackupFile');
    const backup = await app.store.backup();
    expect(backup.ok).toBe(true);
    const uri = backup.ok ? backup.value.uri : '';
    const original = fileDouble().__read(uri);

    expect(await offer.offerBackupFile(uri)).toBe('saved');
    const day = localDay(instant);
    const dest = `${TREE}/${encodeURIComponent(`fallback-backup-${day}.json`)}`;
    const saved = fileDouble().__read(dest);
    // The exact string, and the exact bytes of its UTF-8 encoding.
    expect(saved).toBe(original);
    expect(utf8(saved)).toBe(utf8(original));
    // The folder gets the backup's name without its extension; the provider adds .json.
    expect(saf().createFileAsync).toHaveBeenCalledWith(TREE, `fallback-backup-${day}`, 'application/json');

    // Restoring the copy: the picker hands the app a cache copy (file://), which is what restore reads.
    const cacheCopy = 'file:///cache/DocumentPicker/copy.json';
    fileDouble().__write(cacheCopy, saved);
    expect((await app.store.eraseAll()).ok).toBe(true);
    expect((await app.store.restore(cacheCopy)).ok).toBe(true);
    expect(snapshot(dir).rows.task).toHaveLength(TASKS_V9.length);
  });

  it('a non-ASCII backup file name keeps its characters and the saved file is byte-identical', async () => {
    const dir = newDir();
    createStoreAt(dir, 9);
    await start(dir);
    configureSaf();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const offer = require('@/features/data/offerBackupFile') as typeof import('@/features/data/offerBackupFile');
    const contents = JSON.stringify({ format: 'fallback-backup', note: 'Café ☕ 日本語 👨‍👩‍👧 "x"\r\n' });
    const uri = 'file:///data/fallback-backup-caf%C3%A9-%E6%97%A5%E6%9C%AC.fallbackbak';
    fileDouble().__write(uri, contents);
    expect(await offer.offerBackupFile(uri)).toBe('saved');
    const dest = `${TREE}/${encodeURIComponent('fallback-backup-café-日本.json')}`;
    expect(saf().createFileAsync).toHaveBeenCalledWith(TREE, 'fallback-backup-café-日本', 'application/json');
    expect(fileDouble().__read(dest)).toBe(contents);
    expect(utf8(fileDouble().__read(dest))).toBe(utf8(contents));
  });

  it('the restore picker keeps the default cache copy, so restore reads a file:// path, not a bare content:// URI', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const source = require('fs').readFileSync(joinPath(process.cwd(), 'app/settings/data/index.tsx'), 'utf8') as string;
    expect(source).toMatch(/getDocumentAsync\(\{[^}]*type:/);
    expect(source).not.toMatch(/copyToCacheDirectory:\s*false/);
  });
});
