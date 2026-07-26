/**
 * M1. The thin async surface the rest of `src/db` depends on. Keeping it small (rather
 * than importing the full `expo-sqlite` API everywhere) is what lets
 * `src/db/testSupport/expoSqliteTestDouble.ts` stand in for it in jest, where the native
 * module has no binding (see that file's header comment for why).
 */
import * as SQLite from 'expo-sqlite';

export type SqlParams = readonly unknown[] | Record<string, unknown>;

export interface RunResult {
  readonly lastInsertRowId: number;
  readonly changes: number;
}

export interface DbClient {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParams): Promise<RunResult>;
  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}

/** The one database file the whole app shares (docs/SCHEMA.md, ARCHITECTURE.md §8). */
export const DB_NAME = 'fallback.db';

export async function openClient(): Promise<DbClient> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // ARCHITECTURE §8 — WAL journal, foreign keys on.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db as unknown as DbClient;
}

export async function deleteDatabaseFile(): Promise<void> {
  await SQLite.deleteDatabaseAsync(DB_NAME);
}

/**
 * A stable `DbClient` whose underlying connection can be swapped out from under it.
 * Repositories are constructed once, against this proxy, at module load; `StoreLifecycle`
 * re-points it whenever the real connection changes (first `open()`, and the
 * close-delete-reopen inside `eraseAll()`) so no repository ever holds a stale, closed
 * handle.
 */
export class DbClientProxy implements DbClient {
  private current: DbClient | null = null;

  setClient(client: DbClient | null): void {
    this.current = client;
  }

  private live(): DbClient {
    if (!this.current) {
      throw Object.assign(new Error('Database is not open yet.'), { code: 'STORE_UNAVAILABLE' });
    }
    return this.current;
  }

  execAsync(sql: string): Promise<void> {
    return this.live().execAsync(sql);
  }

  runAsync(sql: string, params?: SqlParams): Promise<RunResult> {
    return this.live().runAsync(sql, params);
  }

  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]> {
    return this.live().getAllAsync<T>(sql, params);
  }

  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null> {
    return this.live().getFirstAsync<T>(sql, params);
  }

  withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    return this.live().withTransactionAsync(fn);
  }

  closeAsync(): Promise<void> {
    return this.live().closeAsync();
  }
}
