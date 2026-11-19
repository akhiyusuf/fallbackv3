import type { Migration } from './types';

/**
 * Ending and deleting keep a habit's past.
 *
 * - `task.ended_on`: the last day an ENDED routine was due ("End routine"). Nothing is due after
 *   it; every day up to it keeps counting toward consistency. NULL while the habit is running.
 * - `retired_day`: when a deleted habit is removed for good, its name, steps and logs go, but
 *   each of its past days is kept here as an outcome only (no name, no link to anything), so the
 *   person's consistency record stays as it was.
 */
export const MIGRATION_008_TASK_ENDED_AND_RETIRED_DAYS: Migration = {
  version: 8,
  name: 'task.ended_on and retired_day: ending or deleting keeps the consistency record',
  up: `
    ALTER TABLE task ADD COLUMN ended_on TEXT;
    CREATE TABLE retired_day (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('ideal','fallback','missed','off')),
      retired_at TEXT NOT NULL
    );
    CREATE INDEX idx_retired_day_date ON retired_day(date);
  `,
};
