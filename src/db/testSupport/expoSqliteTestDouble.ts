/**
 * M1 test-only double for `expo-sqlite`.
 *
 * `expo-sqlite`'s database class is a native binding — under jest (no native runtime)
 * every one of its methods is auto-mocked to a `jest.fn()` that resolves to `undefined`
 * (see `jest-expo`'s `moduleMocks/expoModules.js`), so calling `openDatabaseSync`/
 * `openDatabaseAsync` throws immediately. Rather than assert against that mock (which
 * would tell us nothing about migrations, constraints or cascades actually working), this
 * double implements the exact subset of the `expo-sqlite` surface `src/db/client.ts`
 * touches, backed by Node's built-in `node:sqlite` (`DatabaseSync`) — a real SQLite engine
 * — so M1's tests exercise real SQL semantics (CHECK constraints, ON DELETE CASCADE / SET
 * NULL, transactions, partial unique indexes).
 *
 * `node:sqlite` is a Node.js built-in (stable enough for `DatabaseSync` since Node 22),
 * not an npm package — using it here adds no dependency to `package.json` and never ships
 * in the app; production code always talks to the real `expo-sqlite` package. Reached only
 * via `jest.mock('expo-sqlite', () => createExpoSqliteTestDouble())` inside M1's own test
 * files.
 */
import { DatabaseSync } from 'node:sqlite';

import { joinPath, removeFile } from './nodeTempFiles';

type Params = readonly unknown[] | Record<string, unknown> | undefined;

function bindArgs(params: Params): unknown[] {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params as unknown[];
  return [params];
}

class FakeSQLiteDatabase {
  constructor(private readonly db: DatabaseSync) {}

  // These are declared `async` (rather than returning `Promise.resolve(...)` directly) SO
  // THAT a synchronous throw from the underlying `node:sqlite` call (e.g. a CHECK/UNIQUE/FK
  // violation) is converted into a rejected Promise, matching real `expo-sqlite`'s actual
  // async contract. A non-`async` function that throws synchronously would throw at the
  // CALL SITE instead of rejecting, which `await`/`.rejects` callers do not expect.
  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params?: Params): Promise<{ lastInsertRowId: number; changes: number }> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...bindArgs(params));
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  async getAllAsync<T>(sql: string, params?: Params): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...bindArgs(params)) as T[];
  }

  async getFirstAsync<T>(sql: string, params?: Params): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...bindArgs(params));
    return (row ?? null) as T | null;
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async closeAsync(): Promise<void> {
    this.db.close();
  }
}

export interface ExpoSqliteTestDouble {
  openDatabaseAsync(name: string): Promise<FakeSQLiteDatabase>;
  deleteDatabaseAsync(name: string): Promise<void>;
  /** Test-only escape hatch: fully resets the registry between tests. */
  __reset(): void;
}

export interface ExpoSqliteTestDoubleOptions {
  /**
   * When set, every database lives in a real file under this directory and EVERY open is a
   * NEW connection to that file, as real `expo-sqlite` behaves. A "restart" is then a second
   * open that sees exactly what the first one committed (WAL included). Left unset, the
   * default in-memory registry (one shared connection per name) is used, as before.
   */
  readonly directory?: string;
}

/** One independent registry per call — give each test file (or `describe` block) its own. */
export function createExpoSqliteTestDouble(options: ExpoSqliteTestDoubleOptions = {}): ExpoSqliteTestDouble {
  const registry = new Map<string, DatabaseSync>();
  const openFileConnections = new Set<DatabaseSync>();

  async function openDatabaseAsync(name: string): Promise<FakeSQLiteDatabase> {
    if (options.directory !== undefined) {
      const connection = new DatabaseSync(joinPath(options.directory, name));
      openFileConnections.add(connection);
      return new FakeSQLiteDatabase(connection);
    }
    let db = registry.get(name);
    if (!db) {
      db = new DatabaseSync(':memory:');
      registry.set(name, db);
    }
    return new FakeSQLiteDatabase(db);
  }

  async function deleteDatabaseAsync(name: string): Promise<void> {
    if (options.directory !== undefined) {
      for (const suffix of ['', '-wal', '-shm']) {
        removeFile(joinPath(options.directory, name + suffix));
      }
      return;
    }
    const db = registry.get(name);
    if (db) {
      // The caller (StoreLifecycle.eraseAll) already closes its own handle first; matching
      // real expo-sqlite, deleting an already-closed database must not throw.
      try {
        db.close();
      } catch {
        /* already closed */
      }
      registry.delete(name);
    }
  }

  function __reset(): void {
    for (const db of [...registry.values(), ...openFileConnections]) {
      try {
        db.close();
      } catch {
        /* already closed */
      }
    }
    registry.clear();
    openFileConnections.clear();
  }

  return { openDatabaseAsync, deleteDatabaseAsync, __reset };
}
