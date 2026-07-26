/**
 * M1. Migration 2 — SCHEMA §5's partial unique index: "at most one whole-day row per
 * date". `off_day_mark`'s plain `UNIQUE (date, task_id)` from migration 1 does not enforce
 * this on its own — SQLite treats every NULL in a unique index as distinct, so two
 * whole-day rows (`task_id IS NULL`) for the same date would both satisfy it. This is a
 * genuine second migration (not a cosmetic one) so F1's "older-version fixture opens
 * without data loss" has real forward SQL to apply — see
 * `src/db/__tests__/migrations.test.ts`.
 */
import type { Migration } from './types';

export const MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE: Migration = {
  version: 2,
  name: 'off_day_mark whole-day partial unique index',
  up: `
    CREATE UNIQUE INDEX idx_offday_whole_day ON off_day_mark(date) WHERE task_id IS NULL;
  `,
};
