/**
 * M1. The migration runner. Applies every pending `Migration` (ordered by `version`,
 * forward-only) each inside its own transaction; a failure rolls back that migration and
 * reports `MIGRATION_FAILED`, never a half-applied schema (docs/SCHEMA.md §9).
 */
import { err, ok } from '@/types';
import type { Result } from '@/types';

import type { DbClient } from './client';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from './migrations';

export async function currentUserVersion(db: DbClient): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

export async function runMigrations(db: DbClient): Promise<Result<void>> {
  try {
    const version = await currentUserVersion(db);
    // A store written by a NEWER app build (say, after a rollback to an older build) must not be
    // opened, migrated or written to: this build does not know that schema, and writing to it can
    // silently drop what the newer build stored. Refused untouched; the caller reports it calmly.
    if (version > CURRENT_SCHEMA_VERSION) {
      return err({
        code: 'MIGRATION_FAILED',
        message: `store schema ${version} is newer than this app's ${CURRENT_SCHEMA_VERSION}; it is left unchanged`,
      });
    }
    const pending = MIGRATIONS.filter((m) => m.version > version).slice().sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(migration.up);
        // PRAGMA doesn't accept bound parameters; the version is our own numeric constant.
        await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      });
    }

    return ok(undefined);
  } catch (cause) {
    return err({
      code: 'MIGRATION_FAILED',
      message: cause instanceof Error ? cause.message : 'Migration failed',
      cause,
    });
  }
}
