import type { Migration } from './types';

/**
 * Themes beyond the original four (a fifth named theme, and a person's own colour as
 * `hue-<n>`). `settings.accent` carries a CHECK for the original four, and SQLite cannot relax
 * a CHECK without rebuilding the table, so the wider value lives beside it: when `accent_ext`
 * is set it wins, and `accent` keeps the last original theme as the fallback.
 */
export const MIGRATION_006_SETTINGS_ACCENT_EXT: Migration = {
  version: 6,
  name: 'settings.accent_ext — more themes and a custom colour',
  up: `
    ALTER TABLE settings ADD COLUMN accent_ext TEXT;
  `,
};
