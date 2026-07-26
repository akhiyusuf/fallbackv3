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
import { now } from '@/lib/date';
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
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

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
    return err({ code: 'VALIDATION_FAILED', message: `unrecognised backup format: ${String(v.format)}` });
  }
  if (typeof v.formatVersion !== 'number') {
    return err({ code: 'VALIDATION_FAILED', message: 'missing formatVersion' });
  }
  if (typeof v.schemaVersion !== 'number') {
    return err({ code: 'VALIDATION_FAILED', message: 'missing schemaVersion' });
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
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(tables[table])) {
      return err({ code: 'VALIDATION_FAILED', message: `backup missing table "${table}"` });
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
 * Cheap SQL-injection hardening (review note 3): column NAMES from the backup file are
 * otherwise interpolated straight into the generated `INSERT` statement. A single-statement
 * `prepare()` and the enclosing rollback-on-throw transaction already bound the blast radius
 * to "this restore, this user's own file", but allowlisting is one query per table and turns
 * a crafted/foreign-schema key into a clean, deterministic `VALIDATION_FAILED` instead of an
 * incidental one.
 */
async function validateBackupColumns(db: DbClient, envelope: BackupEnvelope): Promise<Result<void>> {
  for (const table of BACKUP_TABLES) {
    const rows = envelope.tables[table];
    if (rows.length === 0) continue;
    const columnInfo = await db.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info(?)`, [table]);
    const allowed = new Set(columnInfo.map((c) => c.name));
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!allowed.has(key)) {
          return err({ code: 'VALIDATION_FAILED', message: `backup has an unrecognised column "${table}.${key}"` });
        }
      }
    }
  }
  return ok(undefined);
}

/**
 * Transactional wipe-and-load of the 11 backed-up tables. Wrapped in ONE transaction, so a
 * thrown error (a genuine FK/CHECK violation, a malformed row) rolls back BOTH the deletes
 * and the inserts — existing data is left untouched on any failure (SCHEMA §9's
 * non-destructive-restore rule), with no separate staging schema needed for that guarantee.
 */
export async function applyBackupEnvelope(db: DbClient, envelope: BackupEnvelope): Promise<Result<void>> {
  try {
    // Checked BEFORE the transaction opens, same reasoning as validateBackupEnvelope's
    // singleton check: a rejection here must never touch existing data.
    const columnsResult = await validateBackupColumns(db, envelope);
    if (!columnsResult.ok) return columnsResult;

    await db.withTransactionAsync(async () => {
      for (const table of DELETE_ORDER) {
        await db.execAsync(`DELETE FROM ${table};`);
      }
      for (const table of BACKUP_TABLES) {
        for (const row of envelope.tables[table]) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;
          const placeholders = columns.map(() => '?').join(',');
          await db.runAsync(
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
