/**
 * M1 test-only. Minimal ambient typing for Node's built-in `node:sqlite` module (stable
 * since Node 22; ships with the Node binary itself, not an npm package — no
 * `@types/node`/`node` dependency exists in this project's `package.json`, so there is
 * nothing to type it against otherwise). Only the members `expoSqliteTestDouble.ts` uses.
 */
declare module 'node:sqlite' {
  export interface StatementResultingChanges {
    readonly lastInsertRowid: number | bigint;
    readonly changes: number | bigint;
  }

  export class StatementSync {
    run(...params: unknown[]): StatementResultingChanges;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  }

  export class DatabaseSync {
    constructor(location: string, options?: Record<string, unknown>);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
