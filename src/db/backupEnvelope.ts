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

/** Structural validation only — no referential "repair". A NULL xp_award.task_id is legal (SCHEMA §9). */
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
  return ok(value as BackupEnvelope);
}

/**
 * Transactional wipe-and-load of the 11 backed-up tables. Wrapped in ONE transaction, so a
 * thrown error (a genuine FK/CHECK violation, a malformed row) rolls back BOTH the deletes
 * and the inserts — existing data is left untouched on any failure (SCHEMA §9's
 * non-destructive-restore rule), with no separate staging schema needed for that guarantee.
 */
export async function applyBackupEnvelope(db: DbClient, envelope: BackupEnvelope): Promise<Result<void>> {
  try {
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
