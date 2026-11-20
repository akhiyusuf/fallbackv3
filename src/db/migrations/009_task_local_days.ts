import type { Migration } from './types';

/**
 * The calendar day a task was created and deleted, as the device saw it at the time. The record
 * used to re-derive these from the UTC instants in whatever zone the phone is in NOW, so a person
 * who travelled could gain a missed day that never happened, or lose a real one. Existing rows are
 * filled from the instants in the device's current zone (the best that can be known).
 */
export const MIGRATION_009_TASK_LOCAL_DAYS: Migration = {
  version: 9,
  name: 'task.created_on and task.deleted_on: local days fixed at the moment they happened',
  up: `
    ALTER TABLE task ADD COLUMN created_on TEXT;
    ALTER TABLE task ADD COLUMN deleted_on TEXT;
    UPDATE task SET created_on = date(created_at, 'localtime');
    UPDATE task SET deleted_on = date(deleted_at, 'localtime') WHERE deleted_at IS NOT NULL;
  `,
};
