/**
 * Settings survive an app update that runs migrations (review pass 10, data layer).
 *
 * Each case builds a REAL database file exactly as an older build left it: the migrations up
 * to version N are applied and the settings row is written with that version's columns only.
 * Then the current app is launched against that file. Every saved value must still be there.
 */
import { joinPath, makeTempDir, removeDir, removeFile, writeTextFile } from '../testSupport/nodeTempFiles';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) removeDir(dir);
});

function newDatabaseDir(): void {
  const dir = makeTempDir('fallback-upgrade-');
  createdDirs.push(dir);
  (globalThis as { __fallbackUpgradeDir?: string }).__fallbackUpgradeDir = dir;
}

jest.mock('expo-sqlite', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('../testSupport/expoSqliteTestDouble') as typeof import('../testSupport/expoSqliteTestDouble')).createExpoSqliteTestDouble({
    directory: (globalThis as { __fallbackUpgradeDir?: string }).__fallbackUpgradeDir,
  }),
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => (globalThis as unknown as { crypto: Crypto }).crypto.randomUUID(),
}));
jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

import type { DbClient } from '../client';
import { currentUserVersion, runMigrations } from '../migrate';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from '../migrations';
import type { Settings } from '@/types';

type App = typeof import('@/db');

function launch(): App {
  jest.resetModules();
  return require('@/db') as App;
}

async function coldStart(): Promise<App> {
  const app = launch();
  const opened = await app.store.open();
  if (!opened.ok || opened.value !== 'ready') throw new Error(`store did not open ready: ${JSON.stringify(opened)}`);
  return app;
}

/** A raw connection to the same file, for seeding an older schema and inspecting the result. */
async function openRaw(): Promise<DbClient> {
  const sqlite = require('expo-sqlite') as typeof import('expo-sqlite');
  return (await sqlite.openDatabaseAsync('fallback.db')) as unknown as DbClient;
}

/** Apply only the migrations up to `version`, as the build of that era did. */
async function migrateTo(db: DbClient, version: number): Promise<void> {
  for (const m of MIGRATIONS.filter((x) => x.version <= version)) {
    await db.execAsync(m.up);
    await db.execAsync(`PRAGMA user_version = ${m.version};`);
  }
}

const SAVED_UPDATED_AT = '2026-02-02T08:00:00.000Z';
const ONBOARDED = '2026-02-01T07:30:00.000Z';
const SYNCED = '2026-02-03T09:15:00.000Z';
const BACKUP = '2026-02-04T10:45:00.000Z';

/** The row a user had saved, written with the columns that existed at schema `version`. */
async function seedSettingsAt(db: DbClient, version: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (id, theme, accent, onboarding_completed_at, tenure_anchor_date, cycle_cadence,
       notif_master, notif_routine_due, notif_event_starting, notif_course_dose, notif_course_ending_soon,
       notif_gentle_reentry, notif_milestone_reached, notif_daily_digest, notif_digest_time,
       sync_enabled, sync_last_synced_at, sync_last_error, last_backup_at, updated_at)
     VALUES (1, 'dark', 'plum', ?, '2026-01-10', 'weekly', 1, 0, 1, 0, 0, 1, 0, 1, '06:30', 1, ?, 'offline', ?, ?)`,
    [ONBOARDED, SYNCED, BACKUP, SAVED_UPDATED_AT],
  );
  if (version >= 4) {
    await db.runAsync(`UPDATE settings SET assistant_language = 'fr-FR', assistant_voice = 'calm' WHERE id = 1`);
  }
  if (version >= 6) {
    await db.runAsync(`UPDATE settings SET accent_ext = 'hue-210' WHERE id = 1`);
  }
  await db.runAsync(
    `INSERT INTO widget_config (size, mode, fixed_task_id) VALUES ('small-today', 'smart-next-due', NULL)`,
  );
}

/** A store last written by the build at schema `version`, closed cleanly, ready for an update. */
async function storeAtVersion(version: number): Promise<void> {
  newDatabaseDir();
  // A fresh module registry, so the expo-sqlite double is built against THIS test's directory.
  jest.resetModules();
  const raw = await openRaw();
  await migrateTo(raw, version);
  await seedSettingsAt(raw, version);
  expect(await currentUserVersion(raw)).toBe(version);
  await raw.closeAsync();
}

function expectedSettings(version: number): Partial<Settings> {
  return {
    theme: 'dark',
    accent: version >= 6 ? 'hue-210' : 'plum',
    onboardingCompletedAt: ONBOARDED as Settings['onboardingCompletedAt'],
    cycleCadence: 'weekly',
    notifications: {
      master: true,
      routineDue: false,
      eventStarting: true,
      courseDose: false,
      courseEndingSoon: false,
      gentleReentry: true,
      milestoneReached: false,
      dailyDigest: true,
      dailyDigestTime: '06:30',
    },
    // Before schema 4 there was no assistant row to keep; the defaults apply.
    assistant: version >= 4 ? { language: 'fr-FR', voice: 'calm' } : { language: 'en-US', voice: 'warm' },
    widgets: [{ size: 'small-today', mode: 'smart-next-due', fixedTaskId: null }],
    sync: { enabled: true, lastSyncedAt: SYNCED as Settings['sync']['lastSyncedAt'], lastError: 'offline' },
    lastBackupAt: BACKUP as Settings['lastBackupAt'],
  };
}

describe('settings across an app update that runs migrations', () => {
  it.each([3, 5, 6])('a store last opened at schema v%i keeps every saved setting', async (version) => {
    await storeAtVersion(version);
    const app = await coldStart();
    const read = await app.repos.settings.get();

    expect(read).toMatchObject(expectedSettings(version));
    expect(read.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(read.updatedAt).toBe(SAVED_UPDATED_AT);
    expect(read.tenureAnchorDate).toBe('2026-01-10');
  });

  it.each([3, 5, 6])('after upgrading from v%i, a new save and a restart keep both old and new values', async (version) => {
    await storeAtVersion(version);
    const first = await coldStart();
    const saved = await first.repos.settings.patch({ accent: 'hue-300' as Settings['accent'] });
    expect(saved.ok).toBe(true);

    const second = await coldStart();
    const read = await second.repos.settings.get();
    expect(read.accent).toBe('hue-300');
    expect(read).toMatchObject({
      theme: 'dark',
      notifications: expectedSettings(version).notifications,
      assistant: expectedSettings(version).assistant,
      sync: expectedSettings(version).sync,
    });
  });

  it.each([3, 5, 6])('upgrading from v%i records the current schema version, and a second open changes nothing', async (version) => {
    await storeAtVersion(version);
    const first = await coldStart();
    const afterFirst = await first.repos.settings.get();

    const second = await coldStart();
    expect(await second.repos.settings.get()).toEqual(afterFirst);

    const raw = await openRaw();
    expect(await currentUserVersion(raw)).toBe(CURRENT_SCHEMA_VERSION);
    await raw.closeAsync();
  });

  it('a store already at the current version is not migrated again', async () => {
    newDatabaseDir();
    const app = await coldStart();
    await app.repos.settings.patch({ accent: 'indigo', theme: 'light' });

    const raw = await openRaw();
    // Re-running a migration on a current store would fail (e.g. "duplicate column name"), and
    // the runner must treat the store as already done.
    const again = await runMigrations(raw);
    expect(again.ok).toBe(true);
    expect(await currentUserVersion(raw)).toBe(CURRENT_SCHEMA_VERSION);
    await raw.closeAsync();

    const reopened = await coldStart();
    expect(await reopened.repos.settings.get()).toMatchObject({ accent: 'indigo', theme: 'light' });
  });
});
