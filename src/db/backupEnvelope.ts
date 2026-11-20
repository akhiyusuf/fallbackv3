/**
 * M1. The F19 backup envelope (docs/SCHEMA.md §9) — construction and (validated,
 * transactional) application. Deliberately separated from `lifecycle.ts`'s file I/O: this
 * module only ever talks to a `DbClient`, so it is exercised directly by
 * `src/db/__tests__/backupRestore.test.ts` against the real-SQL test double, independent of
 * `expo-file-system` (which has no working native binding under jest — see
 * `testSupport/expoSqliteTestDouble.ts`'s header for why the same is true of `expo-sqlite`
 * itself, and why we don't fight it the same way for pure file I/O plumbing).
 *
 * Row objects are the RAW `SELECT *` shape (snake_case DB columns) end to end — no domain
 * mapping. That is what lets a `NULL xp_award.task_id` survive untouched: it is just
 * another column value, never treated as a broken reference to "repair" (SCHEMA §2.3, §9).
 */
import { now, toLocalDate } from '@/lib/date';
import { err, ok } from '@/types';
import type { Instant, Result } from '@/types';

import type { DbClient } from './client';
import { CURRENT_SCHEMA_VERSION } from './migrations';

export const BACKUP_FORMAT = 'fallback-backup' as const;
export const BACKUP_FORMAT_VERSION = 1 as const;

/** Parent-first — also the pinned envelope table set (SCHEMA §9). No secrets, ever:
 * `entitlement` and the BYO SecureStore key are excluded by construction (not listed here). */
export const BACKUP_TABLES = [
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

export type BackupTableName = (typeof BACKUP_TABLES)[number];

/** Tables that older backups do not have, with the schema version that added them. */
const TABLES_ADDED_IN: readonly (readonly [BackupTableName, number])[] = [['retired_day', 8]];

/** Children-first, the safe order to DELETE in under `PRAGMA foreign_keys = ON`. */
const DELETE_ORDER: readonly BackupTableName[] = [...BACKUP_TABLES].reverse();

export type BackupRow = Record<string, unknown>;

export interface BackupEnvelope {
  readonly format: typeof BACKUP_FORMAT;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly schemaVersion: number;
  readonly createdAt: Instant;
  readonly tables: Record<BackupTableName, readonly BackupRow[]>;
}

export async function buildBackupEnvelope(db: DbClient): Promise<BackupEnvelope> {
  const tables = {} as Record<BackupTableName, readonly BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    tables[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: now(),
    tables,
  };
}

/**
 * Structural validation — no referential "repair" (a NULL xp_award.task_id is legal, SCHEMA
 * §9, and stays untouched). This DOES reject a file that is structurally well-formed but
 * SEMANTICALLY IMPOSSIBLE for `buildBackupEnvelope` to have produced: `buildBackupEnvelope`
 * always serialises exactly one `settings` row and one `cycle_state` row (both real
 * singletons, SCHEMA §1/§8), so an envelope missing either — e.g. all 11 tables `[]` — is
 * malformed by construction, and SCHEMA §9's "a malformed file leaves existing data
 * untouched" applies to it just as much as to a truncated/corrupt file. Catching this here,
 * before `applyBackupEnvelope` ever opens a transaction, is what keeps the
 * non-destructive-on-failure guarantee structural rather than incidental (review pass 1,
 * blocking item 1).
 */
export function validateBackupEnvelope(value: unknown): Result<BackupEnvelope> {
  if (typeof value !== 'object' || value === null) {
    return err({ code: 'VALIDATION_FAILED', message: 'backup file is not a JSON object' });
  }
  const v = value as Record<string, unknown>;
  if (v.format !== BACKUP_FORMAT) {
    const shown = typeof v.format === 'string' ? v.format : typeof v.format;
    return err({ code: 'VALIDATION_FAILED', message: `unrecognised backup format: ${shown}` });
  }
  // Only the envelope version this build writes is readable; anything else (a string "1", 0, or a
  // future version) is refused up front rather than half-read (review 34, fuzzing).
  if (v.formatVersion !== BACKUP_FORMAT_VERSION) {
    return err({ code: 'VALIDATION_FAILED', message: `unsupported backup formatVersion ${String(v.formatVersion)}` });
  }
  if (typeof v.schemaVersion !== 'number') {
    return err({ code: 'VALIDATION_FAILED', message: 'missing schemaVersion' });
  }
  if (!Number.isInteger(v.schemaVersion) || v.schemaVersion < 1) {
    return err({ code: 'VALIDATION_FAILED', message: `backup schemaVersion ${String(v.schemaVersion)} is not a valid schema version` });
  }
  // A backup from a future schema version fails deterministically here, rather than only
  // incidentally on some unrecognised column deep inside the transaction (review note 4).
  if (v.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return err({
      code: 'VALIDATION_FAILED',
      message: `backup schemaVersion ${v.schemaVersion} is newer than this app's ${CURRENT_SCHEMA_VERSION}`,
    });
  }
  if (typeof v.createdAt !== 'string') {
    return err({ code: 'VALIDATION_FAILED', message: 'missing createdAt' });
  }
  if (typeof v.tables !== 'object' || v.tables === null) {
    return err({ code: 'VALIDATION_FAILED', message: 'missing tables' });
  }
  const tables = v.tables as Record<string, unknown>;
  // Tables added after a backup was made are simply empty in it (a version-7 backup has no
  // retired days): fill them in rather than refusing an otherwise good backup.
  for (const [table, since] of TABLES_ADDED_IN) {
    if ((v.schemaVersion as number) < since && tables[table] === undefined) tables[table] = [];
  }
  for (const table of BACKUP_TABLES) {
    const rows = tables[table];
    if (!Array.isArray(rows)) {
      return err({ code: 'VALIDATION_FAILED', message: `backup missing table "${table}"` });
    }
    // Every row is a record of columns. A bare null, number, string or array is not a row.
    if (rows.some((row) => typeof row !== 'object' || row === null || Array.isArray(row))) {
      return err({ code: 'VALIDATION_FAILED', message: `backup table "${table}" has a row that is not a record` });
    }
  }

  // The two real singletons a genuine backup always carries exactly one row of each
  // (SCHEMA §1 `settings`, §8 `cycle_state`) — an envelope missing either cannot have come
  // from `backup()`, however well-formed its JSON otherwise looks (review, blocking item 1).
  const settingsRows = tables.settings as readonly BackupRow[];
  if (settingsRows.length !== 1 || (settingsRows[0] as BackupRow | undefined)?.id !== 1) {
    return err({ code: 'VALIDATION_FAILED', message: 'backup is missing its settings singleton row' });
  }
  const cycleStateRows = tables.cycle_state as readonly BackupRow[];
  if (cycleStateRows.length !== 1 || (cycleStateRows[0] as BackupRow | undefined)?.id !== 1) {
    return err({ code: 'VALIDATION_FAILED', message: 'backup is missing its cycle_state singleton row' });
  }

  return ok(value as BackupEnvelope);
}

/**
 * Amounts that can never be negative, whatever the file says. A negative XP award would pull
 * lifetime XP down on restore, which SCHEMA §7 only allows through the one sanctioned retraction.
 */
const NON_NEGATIVE_INTEGER_COLUMNS: readonly (readonly [BackupTableName, string])[] = [
  ['xp_award', 'amount'],
  ['day_log', 'doses_completed'],
];

/**
 * Cheap SQL-injection hardening (review note 3): column NAMES from the backup file are
 * otherwise interpolated straight into the generated `INSERT` statement. A single-statement
 * `prepare()` and the enclosing rollback-on-throw transaction already bound the blast radius
 * to "this restore, this user's own file", but allowlisting is one query per table and turns
 * a crafted/foreign-schema key into a clean, deterministic `VALIDATION_FAILED` instead of an
 * incidental one.
 *
 * The same pass checks each value's JSON type against the column's declared SQLite type. SQLite
 * accepts a text in an INTEGER column without complaint, so without this a damaged file could
 * put `"many"` into `doses_per_day` and store it: the restore "succeeds" and the app later reads
 * garbage. A value of the wrong type refuses the whole file, before anything is written.
 */
async function validateBackupColumns(db: DbClient, envelope: BackupEnvelope): Promise<Result<void>> {
  for (const table of BACKUP_TABLES) {
    const rows = envelope.tables[table];
    if (rows.length === 0) continue;
    const columnInfo = await db.getAllAsync<{ name: string; type: string }>(
      `SELECT name, type FROM pragma_table_info(?)`,
      [table],
    );
    const declared = new Map(columnInfo.map((c) => [c.name, c.type.toUpperCase()]));
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        const type = declared.get(key);
        if (type === undefined) {
          return err({ code: 'VALIDATION_FAILED', message: `backup has an unrecognised column "${table}.${key}"` });
        }
        if (value === null) continue;
        const wrongType = type.includes('INT')
          ? typeof value !== 'number' || !Number.isInteger(value)
          : type === 'REAL'
            ? typeof value !== 'number' || !Number.isFinite(value)
            : type === 'TEXT'
              ? typeof value !== 'string'
              : false;
        if (wrongType) {
          return err({ code: 'VALIDATION_FAILED', message: `backup value for "${table}.${key}" is not a valid ${type} value` });
        }
      }
      for (const [nnTable, nnColumn] of NON_NEGATIVE_INTEGER_COLUMNS) {
        if (nnTable !== table) continue;
        const value = row[nnColumn];
        if (typeof value === 'number' && value < 0) {
          return err({ code: 'VALIDATION_FAILED', message: `backup has a negative ${table}.${nnColumn}` });
        }
      }
    }
  }
  return ok(undefined);
}

/**
 * Migration 9 added `task.created_on` and `task.deleted_on`: the local day a habit was created and
 * deleted. A backup made before it has neither key, and the insert would store NULL, leaving the
 * record to re-derive the day from the instant in whatever zone the phone is in later (the very
 * drift migration 9 exists to stop). So fill them here, as the migration does, from the instants.
 * A value the file already carries is kept exactly as it is.
 */
function withLocalDays(envelope: BackupEnvelope): BackupEnvelope {
  const localDay = (instant: unknown): string | null => {
    if (typeof instant !== 'string') return null;
    const date = new Date(instant);
    return Number.isNaN(date.getTime()) ? null : toLocalDate(date);
  };
  const task = envelope.tables.task.map((row) => ({
    ...row,
    created_on: row.created_on ?? localDay(row.created_at),
    deleted_on: row.deleted_on ?? localDay(row.deleted_at),
  }));
  return { ...envelope, tables: { ...envelope.tables, task } };
}

/**
 * Transactional wipe-and-load of the 11 backed-up tables. Wrapped in ONE transaction, so a
 * thrown error (a genuine FK/CHECK violation, a malformed row) rolls back BOTH the deletes
 * and the inserts — existing data is left untouched on any failure (SCHEMA §9's
 * non-destructive-restore rule), with no separate staging schema needed for that guarantee.
 */
export async function applyBackupEnvelope(db: DbClient, source: BackupEnvelope): Promise<Result<void>> {
  const envelope = withLocalDays(source);
  try {
    // Checked BEFORE the transaction opens, same reasoning as validateBackupEnvelope's
    // singleton check: a rejection here must never touch existing data.
    const columnsResult = await validateBackupColumns(db, envelope);
    if (!columnsResult.ok) return columnsResult;

    await db.withTransactionAsync(async (tx) => {
      for (const table of DELETE_ORDER) {
        await tx.execAsync(`DELETE FROM ${table};`);
      }
      for (const table of BACKUP_TABLES) {
        for (const row of envelope.tables[table]) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;
          const placeholders = columns.map(() => '?').join(',');
          await tx.runAsync(
            `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
            columns.map((c) => row[c]) as unknown[],
          );
        }
      }
    });
    return ok(undefined);
  } catch (cause) {
    return err({
      code: 'VALIDATION_FAILED',
      message: cause instanceof Error ? cause.message : 'restore failed',
      cause,
    });
  }
}
