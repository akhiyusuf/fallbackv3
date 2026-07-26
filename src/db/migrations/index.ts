/**
 * M1. Ordered, forward-only migrations. `user_version` is the schema version (F1).
 * Every migration runs inside one transaction; a failure rolls back and the store
 * reports STORE_CORRUPT rather than half-applying. STUB — M1 implements.
 */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: string;
}

export declare const MIGRATIONS: readonly Migration[];
export declare const CURRENT_SCHEMA_VERSION: number;
