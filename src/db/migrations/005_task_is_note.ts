import type { Migration } from './types';

/**
 * A To-do and a Note are both `type = 'todo'`. Until now the To-dos screen told them apart by
 * whether the row had note text, so a to-do with an optional detail was filed as a Note. This
 * makes the kind an explicit fact. Existing rows keep the list they were already shown in.
 */
export const MIGRATION_005_TASK_IS_NOTE: Migration = {
  version: 5,
  name: 'task.is_note — explicit To-do vs Note',
  up: `
    ALTER TABLE task ADD COLUMN is_note INTEGER NOT NULL DEFAULT 0 CHECK (is_note IN (0,1));
    UPDATE task SET is_note = 1 WHERE type = 'todo' AND note IS NOT NULL AND trim(note) <> '';
  `,
};
