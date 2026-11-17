import type { Migration } from './types';

/**
 * A person's own order inside each importance level (High, Medium, Low). Lower comes first.
 * NULL means "not placed yet": such tasks sit after the placed ones, oldest first. Changing a
 * task's importance clears its rank, so it joins the end of its new level.
 */
export const MIGRATION_007_TASK_PRIORITY_RANK: Migration = {
  version: 7,
  name: 'task.priority_rank — the user\'s order within an importance level',
  up: `
    ALTER TABLE task ADD COLUMN priority_rank INTEGER;
  `,
};
