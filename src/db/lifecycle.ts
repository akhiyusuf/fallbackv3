/**
 * M1. `StoreLifecycle` — docs/API.md §1.1 / docs/SCHEMA.md §9. `open` (incl. the hard
 * delete sweep + singleton seed), atomic `eraseAll`, `backup`, non-destructive `restore`.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';

import { newId } from '@/lib/id';
import { now, today } from '@/lib/date';
import { err, ok } from '@/types';
import type { Instant, Result, StoreLifecycle, StoreStatus } from '@/types';

import { applyBackupEnvelope, buildBackupEnvelope, validateBackupEnvelope } from './backupEnvelope';
import type { DbClient, DbClientProxy } from './client';
import { deleteDatabaseFile, openClient } from './client';
import { seedCycleWindow } from './cycleWindowSeed';
import { runMigrations } from './migrate';
import { createCycleStateRepository } from './repositories/cycleStateRepository';

/**
 * The BYO key lives ONLY in SecureStore (SCHEMA §1, API.md §5) under these two keys.
 * `eraseAll` must clear them; nothing else in the app may read/write them (M6-owned
 * concern) — M1 only needs the key NAMES to fulfil F25's "clears SecureStore keys" clause.
 */
const SECURE_STORE_KEYS = ['byo.baseUrl', 'byo.apiKey'] as const;

const BACKUP_DIR = FileSystem.documentDirectory ?? '';

async function ensureSingletons(db: DbClient): Promise<void> {
  const settingsRow = await db.getFirstAsync<{ id: number }>(`SELECT id FROM settings WHERE id = 1`);
  if (!settingsRow) {
    // F29 anchor (SCHEMA §7) — the device-local date the store is first created.
    await db.runAsync(`INSERT INTO settings (id, tenure_anchor_date, updated_at) VALUES (1, ?, ?)`, [today(), now()]);
  }

  const entitlementRow = await db.getFirstAsync<{ id: number }>(`SELECT id FROM entitlement WHERE id = 1`);
  if (!entitlementRow) {
    await db.runAsync(`INSERT INTO entitlement (id, updated_at) VALUES (1, ?)`, [now()]);
  }

  const cycleStateRow = await db.getFirstAsync<{ id: number }>(`SELECT id FROM cycle_state WHERE id = 1`);
  if (!cycleStateRow) {
    const settings = await db.getFirstAsync<{ cycle_cadence: string }>(`SELECT cycle_cadence FROM settings WHERE id = 1`);
    const cadence = (settings?.cycle_cadence ?? 'monthly') as 'weekly' | 'monthly';
    const window = seedCycleWindow(cadence, today());
    await db.runAsync(`INSERT INTO cycle_state (id, current_cycle_id, cadence, start_date, end_date) VALUES (1,?,?,?,?)`, [
      newId(),
      window.cadence,
      window.startDate,
      window.endDate,
    ]);
  }
}

/**
 * The hard cascade — SCHEMA §2.3. Runs on every `open()`, nothing else triggers it. A
 * single statement: FK actions declared in the migrations (CASCADE for
 * step/day_log/off_day_mark/as_needed_use, SET NULL for xp_award/widget_config) reproduce
 * the pinned split exactly, so there is no second hand-written copy of the cascade rule to
 * drift from the schema.
 */
async function hardDeleteSweep(db: DbClient): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`DELETE FROM task WHERE deleted_at IS NOT NULL;`);
  });
}

async function clearSecureStoreKeys(): Promise<void> {
  for (const key of SECURE_STORE_KEYS) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Best-effort: a missing key is not a failure.
    }
  }
}

export function createStoreLifecycle(proxy: DbClientProxy) {
  let status: StoreStatus = 'uninitialised';

  async function openInternal(): Promise<StoreStatus> {
    const db = await openClient();
    const migrated = await runMigrations(db);
    if (!migrated.ok) {
      // MIGRATION_FAILED -> calm S50, never a crash loop (docs/API.md §1.1).
      return 'corrupt';
    }
    await hardDeleteSweep(db);
    await ensureSingletons(db);
    proxy.setClient(db);
    return 'ready';
  }

  return {
    async open(): Promise<Result<StoreStatus>> {
      try {
        status = await openInternal();
        return ok(status);
      } catch {
        // A thrown error opening/reading the store is exactly the corrupt case S01 must
        // route to S50 for — calmly, never an exception the caller has to catch.
        status = 'corrupt';
        return ok(status);
      }
    },

    status(): StoreStatus {
      return status;
    },

    // F25 — atomic. Order matters: clear SecureStore FIRST (idempotent, safe to repeat)
    // and only delete the database file once that has succeeded, so a failure never lands
    // between "secrets gone" and "data gone" — the store stays fully intact until the
    // point where nothing can meaningfully fail anymore.
    async eraseAll(): Promise<Result<void>> {
      try {
        await clearSecureStoreKeys();
        // Best-effort: nothing to close/delete on an already-empty/never-opened store.
        try {
          await proxy.closeAsync();
        } catch {
          /* not open — fine */
        }
        proxy.setClient(null);
        try {
          await deleteDatabaseFile();
        } catch {
          /* file may not exist yet — fine, recreation below still produces a clean store */
        }

        status = await openInternal();
        if (status !== 'ready') {
          return err({ code: 'WRITE_FAILED', message: 'store could not be recreated after erase' });
        }
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'erase failed', cause });
      }
    },

    // F19. Writes the pinned JSON envelope (SCHEMA §9) to a file and returns its uri; the
    // caller (S47) hands that uri to the OS share sheet. Never contains the BYO key, the
    // store receipt or the entitlement row — `buildBackupEnvelope` only ever touches the
    // eleven pinned tables, `entitlement` is not among them.
    async backup(): Promise<Result<{ uri: string; createdAt: Instant }>> {
      try {
        const envelope = await buildBackupEnvelope(proxy);
        const filename = `fallback-backup-${envelope.createdAt.slice(0, 10)}.fallbackbak`;
        const uri = `${BACKUP_DIR}${filename}`;
        await FileSystem.writeAsStringAsync(uri, JSON.stringify(envelope));
        await proxy.runAsync(`UPDATE settings SET last_backup_at = ? WHERE id = 1`, [envelope.createdAt]);
        return ok({ uri, createdAt: envelope.createdAt });
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'backup failed', cause });
      }
    },

    // Non-destructive on failure (docs/API.md §1.1): validation happens BEFORE the
    // transaction opens, and the wipe+load itself is one transaction
    // (`applyBackupEnvelope`), so a bad file or a mid-write error never touches existing
    // data.
    async restore(uri: string): Promise<Result<void>> {
      try {
        const raw = await FileSystem.readAsStringAsync(uri);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return err({ code: 'VALIDATION_FAILED', message: 'backup file is not valid JSON' });
        }
        const validated = validateBackupEnvelope(parsed);
        if (!validated.ok) return validated;
        return await applyBackupEnvelope(proxy, validated.value);
      } catch (cause) {
        return err({ code: 'VALIDATION_FAILED', message: cause instanceof Error ? cause.message : 'restore failed', cause });
      }
    },
  } satisfies StoreLifecycle;
}

export function createCycleStateAccessor(proxy: DbClientProxy) {
  return createCycleStateRepository(proxy);
}
