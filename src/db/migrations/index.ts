/**
 * M1. Ordered, forward-only migrations. `user_version` is the schema version (F1).
 * Every migration runs inside one transaction; a failure rolls back and the store
 * reports STORE_CORRUPT rather than half-applying. See `src/db/migrate.ts` for the runner.
 */
import { MIGRATION_001_INITIAL } from './001_initial';
import { MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE } from './002_offday_whole_day_unique';
import type { Migration } from './types';

export type { Migration } from './types';

export const MIGRATIONS: readonly Migration[] = [MIGRATION_001_INITIAL, MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE];

export const CURRENT_SCHEMA_VERSION: number = MIGRATIONS[MIGRATIONS.length - 1]!.version;
