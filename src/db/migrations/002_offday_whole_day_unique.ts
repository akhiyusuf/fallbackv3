/**
 * M1. Migration 2 — SCHEMA §5's partial unique index: "at most one whole-day row per
 * date". `off_day_mark`'s plain `UNIQUE (date, task_id)` from migration 1 does not enforce
 * this on its own — SQLite treats every NULL in a unique index as distinct, so two
 * whole-day rows (`task_id IS NULL`) for the same date would both satisfy it. This is a
 * genuine second migration (not a cosmetic one) so F1's "older-version fixture opens
 * without data loss" has real forward SQL to apply — see
 * `src/db/__tests__/migrations.test.ts`.
 *
 * A v1 store CAN legally hold two whole-day rows for the same date (that is exactly the
 * gap this index closes), so `CREATE UNIQUE INDEX` alone would throw on real prior data —
 * review pass 1, non-blocking note 1. The DELETE below dedupes first, keeping the
 * lowest-`rowid` (earliest-inserted) whole-day row per date and discarding the rest, so
 * the index creation that follows always succeeds on data that was legal a version ago.
 */
import type { Migration } from './types';

export const MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE: Migration = {
  version: 2,
  name: 'off_day_mark whole-day partial unique index',
  up: `
    DELETE FROM off_day_mark
    WHERE task_id IS NULL
      AND rowid NOT IN (
        SELECT MIN(rowid) FROM off_day_mark WHERE task_id IS NULL GROUP BY date
      );
    CREATE UNIQUE INDEX idx_offday_whole_day ON off_day_mark(date) WHERE task_id IS NULL;
  `,
};
