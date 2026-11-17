import './testHarness';

jest.mock('expo-file-system/legacy', () => require('../testSupport/fileSystemTestDouble'));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

import * as SQLite from 'expo-sqlite';

import type { DbClient } from '../client';
import { currentUserVersion, runMigrations } from '../migrate';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from '../migrations';
import { newId } from '@/lib/id';

import { validateBackupEnvelope } from '../backupEnvelope';

async function openRawClient(name: string): Promise<DbClient> {
  const db = await SQLite.openDatabaseAsync(name);
  return db as unknown as DbClient;
}

/** Apply only the migrations up to and including `version`, the way an app at that version left its store. */
async function migrateTo(db: DbClient, version: number): Promise<void> {
  for (const m of MIGRATIONS.filter((x) => x.version <= version)) {
    await db.execAsync(m.up);
    await db.execAsync(`PRAGMA user_version = ${m.version};`);
  }
}

async function schemaSignature(db: DbClient): Promise<string[]> {
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  const out: string[] = [];
  for (const { name } of tables) {
    const cols = await db.getAllAsync<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(
      `SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?)`,
      [name],
    );
    for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
      out.push(`${name}.${c.name} ${c.type} notnull=${c.notnull} default=${c.dflt_value} pk=${c.pk}`);
    }
  }
  const indexes = await db.getAllAsync<{ name: string; tbl_name: string }>(
    `SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  for (const i of indexes) out.push(`index ${i.name} on ${i.tbl_name}`);
  return out;
}

const TS = '2026-01-01T00:00:00.000Z';

async function seedSettings(db: DbClient) {
  await db.runAsync(`INSERT INTO settings (id, tenure_anchor_date, updated_at) VALUES (1, ?, ?)`, ['2026-01-01', TS]);
}

async function seedTodo(db: DbClient, id: string, note: string | null) {
  await db.runAsync(
    `INSERT INTO task (id, type, name, note, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    [id, 'todo', `Todo ${id}`, note, 'Repeat', 'forge-orange', TS, TS],
  );
}

describe('upgrade paths to the current schema', () => {
  it('a fresh install and a store upgraded from v1 end with the same tables, columns and indexes', async () => {
    const fresh = await openRawClient('schema-fresh.db');
    expect((await runMigrations(fresh)).ok).toBe(true);

    const upgraded = await openRawClient('schema-from-v1.db');
    await migrateTo(upgraded, 1);
    expect((await runMigrations(upgraded)).ok).toBe(true);

    expect(await currentUserVersion(upgraded)).toBe(CURRENT_SCHEMA_VERSION);
    expect(await schemaSignature(upgraded)).toEqual(await schemaSignature(fresh));
  });

  it('the new v5-v7 columns exist on a fresh install with their defaults', async () => {
    const db = await openRawClient('fresh-new-columns.db');
    expect((await runMigrations(db)).ok).toBe(true);
    const cols = await db.getAllAsync<{ name: string; dflt_value: string | null; notnull: number }>(
      `SELECT name, dflt_value, "notnull" FROM pragma_table_info('task')`,
    );
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]));
    expect(byName.is_note).toMatchObject({ dflt_value: '0', notnull: 1 });
    expect(byName.priority_rank).toMatchObject({ dflt_value: null, notnull: 0 });
    const settingsCols = await db.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('settings')`);
    expect(settingsCols.map((c) => c.name)).toContain('accent_ext');
  });

  it('from v4: a To-do with note text becomes a Note, a To-do without one stays a To-do, and nothing else changes', async () => {
    const db = await openRawClient('upgrade-from-v4.db');
    await migrateTo(db, 4);
    await seedSettings(db);

    await db.runAsync(`INSERT INTO task (id, type, name, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`, [
      'routine-1', 'routine', 'Read', 'Repeat', 'forge-orange', TS, TS,
    ]);
    await db.runAsync(`UPDATE task SET note = 'a note' WHERE id = 'routine-1'`);
    await seedTodo(db, 'todo-with-note', 'Buy oat milk');
    await seedTodo(db, 'todo-blank-note', '   ');
    await seedTodo(db, 'todo-null-note', null);
    await db.runAsync(`UPDATE settings SET accent = 'berry' WHERE id = 1`);

    expect((await runMigrations(db)).ok).toBe(true);
    expect(await currentUserVersion(db)).toBe(CURRENT_SCHEMA_VERSION);

    const rows = await db.getAllAsync<{ id: string; is_note: number; priority_rank: number | null; note: string | null }>(
      `SELECT id, is_note, priority_rank, note FROM task ORDER BY id`,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['todo-with-note']).toMatchObject({ is_note: 1, note: 'Buy oat milk', priority_rank: null });
    expect(byId['todo-blank-note']).toMatchObject({ is_note: 0, priority_rank: null });
    expect(byId['todo-null-note']).toMatchObject({ is_note: 0, priority_rank: null });
    // A routine with a note is not a To-do, so the backfill leaves it at 0.
    expect(byId['routine-1']).toMatchObject({ is_note: 0, note: 'a note' });

    const settings = await db.getFirstAsync<{ accent: string; accent_ext: string | null }>(
      `SELECT accent, accent_ext FROM settings WHERE id = 1`,
    );
    expect(settings).toEqual({ accent: 'berry', accent_ext: null });
  });

  it('from v5: a Note stays a Note and a To-do stays a To-do, even where their text no longer matches the old guess', async () => {
    const db = await openRawClient('upgrade-from-v5.db');
    await migrateTo(db, 5);

    await seedTodo(db, 'explicit-note', null);
    await db.runAsync(`UPDATE task SET is_note = 1 WHERE id = 'explicit-note'`);
    await seedTodo(db, 'todo-with-detail', 'optional detail');
    await db.runAsync(`UPDATE task SET is_note = 0 WHERE id = 'todo-with-detail'`);

    expect((await runMigrations(db)).ok).toBe(true);
    expect(await currentUserVersion(db)).toBe(CURRENT_SCHEMA_VERSION);

    // Migration 5's backfill ran once at v4 -> v5; upgrading again must not re-derive the flag.
    const rows = await db.getAllAsync<{ id: string; is_note: number; priority_rank: number | null }>(
      `SELECT id, is_note, priority_rank FROM task ORDER BY id`,
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['explicit-note']).toMatchObject({ is_note: 1, priority_rank: null });
    expect(byId['todo-with-detail']).toMatchObject({ is_note: 0, priority_rank: null });
  });

  it('from v6: an existing custom accent in accent_ext survives the move to v7 untouched', async () => {
    const db = await openRawClient('upgrade-from-v6.db');
    await migrateTo(db, 6);
    await seedSettings(db);
    await db.runAsync(`UPDATE settings SET accent = 'plum', accent_ext = 'hue-200' WHERE id = 1`);
    await db.runAsync(`INSERT INTO task (id, type, name, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`, [
      'ranked', 'todo', 'Ranked', 'Repeat', 'forge-orange', TS, TS,
    ]);

    expect((await runMigrations(db)).ok).toBe(true);
    expect(await currentUserVersion(db)).toBe(CURRENT_SCHEMA_VERSION);

    expect(await db.getFirstAsync(`SELECT accent, accent_ext FROM settings WHERE id = 1`)).toEqual({
      accent: 'plum',
      accent_ext: 'hue-200',
    });
    expect(await db.getFirstAsync(`SELECT priority_rank FROM task WHERE id = 'ranked'`)).toEqual({ priority_rank: null });
  });

  it('a store already at v7 gains no rows or changes when migrations run again', async () => {
    const db = await openRawClient('upgrade-idempotent.db');
    expect((await runMigrations(db)).ok).toBe(true);
    await seedTodo(db, 'todo-x', 'hello');
    expect((await runMigrations(db)).ok).toBe(true);
    expect(await db.getFirstAsync(`SELECT is_note, priority_rank FROM task WHERE id = 'todo-x'`)).toEqual({
      is_note: 0,
      priority_rank: null,
    });
  });
});

describe('backup and restore carry the v5-v7 fields', () => {
  async function freshStore() {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require('expo-sqlite') as { __reset: () => void }).__reset();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require('../testSupport/fileSystemTestDouble') as { __reset: () => void }).__reset();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const db = require('../index') as typeof import('../index');
    const opened = await db.store.open();
    expect(opened.ok).toBe(true);
    return db;
  }

  it('a Note, a placed priority and a custom accent round-trip through backup, erase and restore', async () => {
    const { repos, store } = await freshStore();

    const note = {
      id: newId(),
      type: 'todo' as const,
      name: 'Idea',
      note: 'some text',
      icon: 'Repeat',
      color: 'forge-orange' as const,
      isAsNeeded: false,
      cadence: null,
      eventDate: null,
      timeOfDay: null,
      startDate: null,
      endDate: null,
      dosesPerDay: 1,
      isTracked: false,
      importance: 'high' as const,
      necessity: null,
      todoDoneAt: null,
      priorityRank: 2,
      isNote: true,
      createdAt: TS as never,
      updatedAt: TS as never,
      deletedAt: null,
      snoozable: true,
    };
    await repos.tasks.insert(note as never, []);
    await repos.settings.patch({ accent: 'hue-200' as never });

    const backup = await store.backup();
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;

    const reset = await store.eraseAll();
    expect(reset.ok).toBe(true);
    expect(await repos.tasks.get(note.id as never)).toBeFalsy();

    const restored = await store.restore(backup.value.uri);
    expect(restored.ok).toBe(true);

    const back = await repos.tasks.get(note.id as never);
    expect(back).toMatchObject({ isNote: true, priorityRank: 2, importance: 'high' });
    const settings = await repos.settings.get();
    expect(settings.accent).toBe('hue-200');
  });

  it('the backup file is named by the device-local day of its creation time', async () => {
    const { store } = await freshStore();
    const backup = await store.backup();
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('../testSupport/fileSystemTestDouble') as typeof import('../testSupport/fileSystemTestDouble');
    const envelope = JSON.parse(await fs.readAsStringAsync(backup.value.uri)) as { createdAt: string };
    const d = new Date(envelope.createdAt);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(backup.value.uri.endsWith(`fallback-backup-${local}.fallbackbak`)).toBe(true);
  });

  it('a backup taken before v5-v7 (no is_note, priority_rank or accent_ext columns) restores with those defaults', async () => {
    const { repos, store } = await freshStore();
    const now = '2025-12-01T09:00:00.000Z';
    const settingsRow = {
      id: 1,
      theme: 'dark',
      accent: 'plum',
      onboarding_completed_at: now,
      tenure_anchor_date: '2025-12-01',
      cycle_cadence: 'monthly',
      notif_master: 0,
      notif_routine_due: 0,
      notif_event_starting: 0,
      notif_course_dose: 0,
      notif_course_ending_soon: 0,
      notif_gentle_reentry: 0,
      notif_milestone_reached: 0,
      notif_daily_digest: 0,
      notif_digest_time: '08:00',
      sync_enabled: 0,
      sync_last_synced_at: null,
      sync_last_error: null,
      last_backup_at: null,
      updated_at: now,
    };
    const taskRow = {
      id: 'legacy-todo',
      type: 'todo',
      name: 'Old to-do',
      note: 'detail',
      icon: 'Repeat',
      color: 'forge-orange',
      is_as_needed: 0,
      cadence_kind: null,
      cadence_weekdays: null,
      cadence_weekday: null,
      cadence_day_of_month: null,
      cadence_month: null,
      cadence_anchor_date: null,
      event_date: null,
      time_of_day: null,
      start_date: null,
      end_date: null,
      doses_per_day: 1,
      is_tracked: 0,
      importance: null,
      necessity: null,
      todo_done_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      snoozable: 1,
    };
    const envelope = {
      format: 'fallback-backup',
      formatVersion: 1,
      schemaVersion: 4,
      createdAt: now,
      tables: {
        settings: [settingsRow],
        task: [taskRow],
        step: [],
        day_log: [],
        off_day_mark: [],
        as_needed_use: [],
        xp_award: [],
        achievement_unlock: [],
        cycle_record: [],
        cycle_state: [{ id: 1, current_cycle_id: 'cycle-1', cadence: 'monthly', start_date: '2025-12-01', end_date: '2025-12-31' }],
        widget_config: [],
      },
    };
    expect(validateBackupEnvelope(envelope).ok).toBe(true);

    // Write the handcrafted v4-shaped file where the store's restore reads it from.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('../testSupport/fileSystemTestDouble') as typeof import('../testSupport/fileSystemTestDouble');
    const uri = `${fs.documentDirectory}legacy-v4.json`;
    await fs.writeAsStringAsync(uri, JSON.stringify(envelope));

    const restored = await store.restore(uri);
    expect(restored.ok).toBe(true);

    const todo = await repos.tasks.get('legacy-todo' as never);
    expect(todo).toMatchObject({ name: 'Old to-do', isNote: false, priorityRank: null });
    const settings = await repos.settings.get();
    expect(settings.accent).toBe('plum');
    expect(settings.theme).toBe('dark');
  });
});
