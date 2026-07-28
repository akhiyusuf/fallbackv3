/**
 * M1 (landed by the architect). Migration 4 — architect CR-6, raised in wave-2 code review.
 *
 * S36's "Voice & language" selection (F16, PRD §3.6) had no durable home: M6 shipped it as
 * in-process module state because `docs/SCHEMA.md` declared no column and `@/queries` was
 * frozen. It belongs on the `settings` singleton with the other user preferences
 * (theme/accent/notification toggles) rather than in a new table — one row, wiped by F25 with
 * everything else, and carried by the F19 backup envelope with no change to its table list.
 *
 * Two plain `ADD COLUMN`s with non-NULL defaults: no table rebuild, no data movement, and an
 * older backup file (whose `settings` row simply lacks these keys) restores cleanly because
 * `applyBackupEnvelope` inserts only the columns the file actually carries and SQLite fills
 * the rest from these defaults. That is a CONTRACT, not an incidental property, and it is
 * pinned by `src/db/__tests__/backupRestore.test.ts` ("a pre-v4 (v3-shaped) backup ...") —
 * if you ever normalise restore to a fixed column list, or add a column without a default,
 * that test is the one that will tell you every pre-existing backup file just broke.
 *
 * No CHECK constraint on either column — see `AssistantPrefs` in `src/types/settings.ts`:
 * the option lists are M6's to grow without a migration, and an unknown value degrades to
 * "the picker shows no selection", never to a corrupt store.
 */
import type { Migration } from './types';

export const MIGRATION_004_ASSISTANT_VOICE_LANGUAGE: Migration = {
  version: 4,
  name: 'settings.assistant_language + settings.assistant_voice (architect CR-6)',
  up: `
    ALTER TABLE settings ADD COLUMN assistant_language TEXT NOT NULL DEFAULT 'en-US';
    ALTER TABLE settings ADD COLUMN assistant_voice TEXT NOT NULL DEFAULT 'warm';
  `,
};
