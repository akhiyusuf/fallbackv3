import type { Migration } from './types';

/** A task can say that every dose or step is needed: part of the day is then not a fallback. */
export const MIGRATION_010_TASK_ALL_REQUIRED: Migration = {
  version: 10,
  name: 'task.all_required: every dose or step needed (off by default)',
  up: `
    ALTER TABLE task ADD COLUMN all_required INTEGER NOT NULL DEFAULT 0;
  `,
};
