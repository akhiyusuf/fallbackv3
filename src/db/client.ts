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
  /** `fn` receives the connection to run its statements on (inside a transaction, never the proxy). */
  withTransactionAsync(fn: (tx: DbClient) => Promise<void>): Promise<void>;
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
/** SQLite's "the file is busy for a moment" errors, which a short wait clears. */
const BUSY = /database is locked|SQLITE_BUSY|database table is locked|SQLITE_LOCKED/i;

/**
 * A job that fails only because the database file was busy for a moment (another write, the
 * phone's own housekeeping of the WAL file) is tried once more after a short wait. A failed
 * transaction has rolled back, so a second try is safe. Any other error is returned at once.
 */
export async function runWithBusyRetry<T>(run: () => Promise<T>, waitMs = 150): Promise<T> {
  try {
    return await run();
  } catch (e) {
    // Read the message structurally, not with `instanceof Error`: a native SQLite error can come
    // from another JS realm (it is not `instanceof Error` under jest's VM context), and a driver
    // may reject with a plain object that carries a `message`.
    const message =
      typeof e === 'object' && e !== null && typeof (e as { message?: unknown }).message === 'string'
        ? (e as { message: string }).message
        : undefined;
    if (message === undefined || !BUSY.test(message)) throw e;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return run();
  }
}

export class DbClientProxy implements DbClient {
  private current: DbClient | null = null;
  /** Every job the proxy runs, chained: each starts only after the one before it has finished. */
  private queue: Promise<unknown> = Promise.resolve();

  setClient(client: DbClient | null): void {
    this.current = client;
  }

  private live(): DbClient {
    if (!this.current) {
      throw Object.assign(new Error('Database is not open yet.'), { code: 'STORE_UNAVAILABLE' });
    }
    return this.current;
  }

  /**
   * Runs one database job after every job queued before it. expo-sqlite's `withTransactionAsync`
   * is NOT exclusive: any statement issued on the connection while a transaction is open runs
   * inside it, so a neighbouring write that reported success was rolled back when that
   * transaction failed (a deleted task came back), and a second `BEGIN` failed outright ("cannot
   * start a transaction within a transaction"). Serialising every job here means nothing else
   * touches the connection while a transaction is open.
   */
  private serial<T>(job: (client: DbClient) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => runWithBusyRetry(() => job(this.live())));
    this.queue = result.catch(() => undefined);
    return result;
  }

  execAsync(sql: string): Promise<void> {
    return this.serial((client) => client.execAsync(sql));
  }

  runAsync(sql: string, params?: SqlParams): Promise<RunResult> {
    return this.serial((client) => client.runAsync(sql, params));
  }

  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]> {
    return this.serial((client) => client.getAllAsync<T>(sql, params));
  }

  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null> {
    return this.serial((client) => client.getFirstAsync<T>(sql, params));
  }

  /**
   * The callback gets the live connection, NOT this proxy. A statement issued through the proxy
   * from inside the callback would queue behind the very transaction waiting for it (a hang), so
   * everything a transaction does goes through the `tx` it is handed.
   */
  withTransactionAsync(fn: (tx: DbClient) => Promise<void>): Promise<void> {
    return this.serial((client) => client.withTransactionAsync(() => fn(client)));
  }

  closeAsync(): Promise<void> {
    return this.serial((client) => client.closeAsync());
  }
}
