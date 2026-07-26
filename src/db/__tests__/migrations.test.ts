import './testHarness';

import * as SQLite from 'expo-sqlite';

import type { DbClient } from '../client';
import { openClient } from '../client';
import { currentUserVersion, runMigrations } from '../migrate';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from '../migrations';
import { MIGRATION_001_INITIAL } from '../migrations/001_initial';

async function openRawClient(name: string): Promise<DbClient> {
  const db = await SQLite.openDatabaseAsync(name);
  return db as unknown as DbClient;
}

describe('migrations', () => {
  it('MIGRATIONS is forward-only and ends at CURRENT_SCHEMA_VERSION', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(CURRENT_SCHEMA_VERSION).toBe(versions[versions.length - 1]);
  });

  it('a fresh store reaches CURRENT_SCHEMA_VERSION after runMigrations', async () => {
    const db = await openRawClient('fresh.db');
    const result = await runMigrations(db);
    expect(result.ok).toBe(true);
    expect(await currentUserVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
  });

  // F1 — mandatory: an older-version fixture opens and migrates forward without data loss.
  it('an older-version (v1) fixture migrates to v2 without losing data, and gains the new constraint', async () => {
    const db = await openRawClient('older-version-fixture.db');

    // Apply ONLY migration 1 — this is the "older version" fixture, pre-migration-2.
    await db.execAsync(MIGRATION_001_INITIAL.up);
    await db.execAsync('PRAGMA user_version = 1;');

    // Seed some real data at v1, including two off-day whole-day rows for the SAME date —
    // legal under v1's plain UNIQUE(date, task_id), because SQLite treats every NULL as
    // distinct in a unique constraint. This is exactly the gap migration 2's index closes,
    // so the fixture must actually contain it (not seed it AFTER migrating) for this to be
    // a genuine test of "migrates without losing data" against real prior-version data.
    await db.runAsync(`INSERT INTO task (id, type, name, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`, [
      'task-1',
      'routine',
      'Read',
      'Repeat',
      'forge-orange',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
    await db.runAsync(`INSERT INTO xp_award (id, task_id, date, kind, amount, cycle_id, created_at) VALUES (?,?,?,?,?,?,?)`, [
      'xp-1',
      'task-1',
      '2026-01-02',
      'ideal',
      10,
      'cycle-1',
      '2026-01-02T00:00:00.000Z',
    ]);
    // Two legal-under-v1 whole-day marks for the SAME date, inserted in a known order.
    await db.runAsync(`INSERT INTO off_day_mark (id, date, task_id, created_at) VALUES (?,?,?,?)`, [
      'off-legacy-1',
      '2026-02-01',
      null,
      '2026-02-01T00:00:00.000Z',
    ]);
    await db.runAsync(`INSERT INTO off_day_mark (id, date, task_id, created_at) VALUES (?,?,?,?)`, [
      'off-legacy-2',
      '2026-02-01',
      null,
      '2026-02-01T00:00:01.000Z',
    ]);
    expect(await db.getAllAsync(`SELECT id FROM off_day_mark WHERE date = '2026-02-01'`)).toHaveLength(2);

    expect(await currentUserVersion(db)).toBe(1);

    const result = await runMigrations(db);
    expect(result.ok).toBe(true);
    expect(await currentUserVersion(db)).toBe(CURRENT_SCHEMA_VERSION);

    // No data loss on the rows the split cascade / XP ledger actually cares about.
    const task = await db.getFirstAsync<{ id: string }>(`SELECT id FROM task WHERE id = 'task-1'`);
    expect(task?.id).toBe('task-1');
    const award = await db.getFirstAsync<{ amount: number }>(`SELECT amount FROM xp_award WHERE id = 'xp-1'`);
    expect(award?.amount).toBe(10);

    // The legal-under-v1 duplicate was deduped by migration 2's own DELETE, keeping the
    // earliest (lowest-rowid) survivor rather than migration 2 throwing on real prior data.
    const survivors = await db.getAllAsync<{ id: string }>(`SELECT id FROM off_day_mark WHERE date = '2026-02-01'`);
    expect(survivors).toHaveLength(1);
    expect(survivors[0]?.id).toBe('off-legacy-1');

    // The migration-2 constraint is now live: a second whole-day off mark for a date that
    // already has one is rejected.
    await db.runAsync(`INSERT INTO off_day_mark (id, date, task_id, created_at) VALUES (?,?,?,?)`, [
      'off-new',
      '2026-03-01',
      null,
      '2026-03-01T00:00:00.000Z',
    ]);
    await expect(
      db.runAsync(`INSERT INTO off_day_mark (id, date, task_id, created_at) VALUES (?,?,?,?)`, [
        'off-new-2',
        '2026-03-01',
        null,
        '2026-03-01T00:00:00.000Z',
      ]),
    ).rejects.toThrow();
  });

  it('migrating a store already at CURRENT_SCHEMA_VERSION is a no-op', async () => {
    const db = await openRawClient('already-current.db');
    expect((await runMigrations(db)).ok).toBe(true);
    expect((await runMigrations(db)).ok).toBe(true);
    expect(await currentUserVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('a failed migration rolls back and reports MIGRATION_FAILED, not a half-applied schema', async () => {
    const db = await openRawClient('broken-migration.db');
    // Corrupt user_version tracking by inserting a syntactically bad statement mid-way:
    // simulate by running a client whose migration set includes an invalid SQL string.
    const badResult = await runMigrations({
      ...db,
      execAsync: async (sql: string) => {
        if (sql.includes('CREATE TABLE settings')) throw new Error('simulated failure');
        return db.execAsync(sql);
      },
    } as DbClient);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) expect(badResult.error.code).toBe('MIGRATION_FAILED');
    // Nothing committed — user_version stayed at 0.
    expect(await currentUserVersion(db)).toBe(0);
  });
});
