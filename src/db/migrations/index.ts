/**
 * M1. Ordered, forward-only migrations. `user_version` is the schema version (F1).
 * Every migration runs inside one transaction; a failure rolls back and the store
 * reports STORE_CORRUPT rather than half-applying. See `src/db/migrate.ts` for the runner.
 */
import { MIGRATION_001_INITIAL } from './001_initial';
import { MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE } from './002_offday_whole_day_unique';
import { MIGRATION_003_SNOOZABLE_AND_ONE_HOP_CHECK } from './003_snoozable_and_one_hop_check';
import { MIGRATION_004_ASSISTANT_VOICE_LANGUAGE } from './004_assistant_voice_language';
import type { Migration } from './types';

export type { Migration } from './types';

export const MIGRATIONS: readonly Migration[] = [
  MIGRATION_001_INITIAL,
  MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE,
  MIGRATION_003_SNOOZABLE_AND_ONE_HOP_CHECK,
  MIGRATION_004_ASSISTANT_VOICE_LANGUAGE,
];

export const CURRENT_SCHEMA_VERSION: number = MIGRATIONS[MIGRATIONS.length - 1]!.version;
