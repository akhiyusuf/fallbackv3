import './testHarness';

import * as SQLite from 'expo-sqlite';

import type { DbClient } from '../client';
import { currentUserVersion, runMigrations } from '../migrate';
import { CURRENT_SCHEMA_VERSION } from '../migrations';
import { MIGRATION_001_INITIAL } from '../migrations/001_initial';
import { MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE } from '../migrations/002_offday_whole_day_unique';

/**
 * CR-4 (docs/MODULES.md top matter; docs/SCHEMA.md §4.2 / §9). Five fixtures, pinned by
 * SCHEMA §9, each asserting ROW-LEVEL ledger effects (which `xp_award` rows exist, their
 * `id`/`amount`/`cycle_id`, and which `day_log.moved_to_date` pointers survive) — not
 * merely a displayed outcome. Every branch of §4.2's decision table (A, B1, B2, B3, plus
 * destination-clear) is exercised across the five, per SCHEMA's own branch-coverage note.
 */

async function openV2Fixture(name: string): Promise<DbClient> {
  const db = (await SQLite.openDatabaseAsync(name)) as unknown as DbClient;
  // Migrations 1 + 2 — the "older version" baseline this migration must normalize forward
  // from. Migration 3 (CR-4) has not run yet; `day_log.moved_to_date` carries no CHECK.
  await db.execAsync(MIGRATION_001_INITIAL.up);
  await db.execAsync(MIGRATION_002_OFFDAY_WHOLE_DAY_UNIQUE.up);
  await db.execAsync('PRAGMA user_version = 2;');
  await db.runAsync(`INSERT INTO task (id, type, name, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`, [
    'tau',
    'routine',
    'Movement',
    'Repeat',
    'forge-orange',
    '2025-01-01T00:00:00.000Z',
    '2025-01-01T00:00:00.000Z',
  ]);
  return db;
}

function seedLog(db: DbClient, opts: { id: string; date: string; movedToDate: string | null; chipState?: string }) {
  return db.runAsync(`INSERT INTO day_log (id, task_id, date, chip_state, moved_to_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`, [
    opts.id,
    'tau',
    opts.date,
    opts.chipState ?? 'done',
    opts.movedToDate,
    `${opts.date}T00:00:00.000Z`,
    `${opts.date}T00:00:00.000Z`,
  ]);
}

function seedAward(db: DbClient, opts: { id: string; date: string; amount?: number; cycleId?: string; createdAt?: string }) {
  return db.runAsync(`INSERT INTO xp_award (id, task_id, date, kind, amount, cycle_id, created_at) VALUES (?,?,?,?,?,?,?)`, [
    opts.id,
    'tau',
    opts.date,
    'ideal',
    opts.amount ?? 10,
    opts.cycleId ?? 'cycle-1',
    opts.createdAt ?? `${opts.date}T00:00:00.000Z`,
  ]);
}

async function migrateToV3(db: DbClient) {
  expect(await currentUserVersion(db)).toBe(2);
  const result = await runMigrations(db);
  expect(result.ok).toBe(true);
  expect(await currentUserVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
}

async function awards(db: DbClient) {
  return db.getAllAsync<{ id: string; date: string; amount: number; cycle_id: string }>(
    `SELECT id, date, amount, cycle_id FROM xp_award ORDER BY date`,
  );
}

async function pointerOf(db: DbClient, date: string) {
  const row = await db.getFirstAsync<{ moved_to_date: string | null }>(`SELECT moved_to_date FROM day_log WHERE date = ?`, [date]);
  return row?.moved_to_date ?? null;
}

describe('CR-4 migration — task.snoozable + day_log one-hop CHECK, SCHEMA §9 fixtures', () => {
  it('task.snoozable is added, defaulting existing tasks to true (1)', async () => {
    const db = await openV2Fixture('cr4-snoozable-default.db');
    await migrateToV3(db);
    const row = await db.getFirstAsync<{ snoozable: number }>(`SELECT snoozable FROM task WHERE id = 'tau'`);
    expect(row?.snoozable).toBe(1);
  });

  // Fixture M (old C4 merge). S -> T LONG; T has its own live log with an award.
  // Branch A: T keeps its award. S revives with its data and NO award.
  it('fixture M — branch A: T keeps its award, S revives with no award', async () => {
    const db = await openV2Fixture('cr4-fixture-m.db');
    await seedLog(db, { id: 'log-S', date: '2025-06-01', movedToDate: '2025-06-10' }); // LONG
    await seedLog(db, { id: 'log-T', date: '2025-06-10', movedToDate: null }); // live
    await seedAward(db, { id: 'award-T', date: '2025-06-10', amount: 10, cycleId: 'cycle-M' });

    await migrateToV3(db);

    const rows = await awards(db);
    expect(rows).toEqual([{ id: 'award-T', date: '2025-06-10', amount: 10, cycle_id: 'cycle-M' }]);
    expect(await pointerOf(db, '2025-06-01')).toBeNull(); // S's pointer cleared, revives
  });

  // Fixture V (old C7, off-cadence completion). S -> T LONG; T off-cadence; award at T
  // belongs to the visitor. Branch B1: exactly one award, moved HOME to S, same id/amount/cycle_id.
  it('fixture V — branch B1: the award moves home to S, identity preserved', async () => {
    const db = await openV2Fixture('cr4-fixture-v.db');
    await seedLog(db, { id: 'log-S', date: '2025-06-01', movedToDate: '2025-06-10' }); // LONG
    // T has no own row — off-cadence, never naturally due.
    await seedAward(db, { id: 'award-T', date: '2025-06-10', amount: 10, cycleId: 'cycle-V', createdAt: '2025-06-10T00:00:00.000Z' });

    await migrateToV3(db);

    const rows = await awards(db);
    expect(rows).toEqual([{ id: 'award-T', date: '2025-06-01', amount: 10, cycle_id: 'cycle-V' }]);
    const row = await db.getFirstAsync<{ created_at: string }>(`SELECT created_at FROM xp_award WHERE id = 'award-T'`);
    expect(row?.created_at).toBe('2025-06-10T00:00:00.000Z'); // relocated, not re-minted
    expect(await pointerOf(db, '2025-06-01')).toBeNull();
  });

  // C8-a (double inbound, both LONG). S1 -> T, S2 -> T, both LONG, award at T.
  // Branch B1: award follows carrier(T) = MAX(date) source. The other source revives with no award.
  it('fixture C8-a — branch B1: award follows the MAX(date) carrier; the other source gets nothing', async () => {
    const db = await openV2Fixture('cr4-fixture-c8a.db');
    await seedLog(db, { id: 'log-S1', date: '2025-06-01', movedToDate: '2025-06-20' }); // LONG
    await seedLog(db, { id: 'log-S2', date: '2025-06-05', movedToDate: '2025-06-20' }); // LONG, later date -> carrier
    await seedAward(db, { id: 'award-T', date: '2025-06-20', amount: 10, cycleId: 'cycle-C8a' });

    await migrateToV3(db);

    const rows = await awards(db);
    expect(rows).toEqual([{ id: 'award-T', date: '2025-06-05', amount: 10, cycle_id: 'cycle-C8a' }]);
    expect(await pointerOf(db, '2025-06-01')).toBeNull();
    expect(await pointerOf(db, '2025-06-05')).toBeNull();
  });

  // C8-b (double inbound, one legal one-hop). S2 -> T KEPT (S2 = T-1); S1 -> T LONG with
  // S1 < T-1 (pinned — a backward-pointing LONG row); award at T; T has NO own row.
  // Branch B2: carrier(T) = MAX(S1,S2) = S2, KEPT, T not revived -> the award LEAVES at T.
  it('fixture C8-b — branch B2: carrier is the KEPT S2, award leaves at T, S1 revives with nothing', async () => {
    const db = await openV2Fixture('cr4-fixture-c8b.db');
    // T = 2025-06-20; S2 = T-1 = 2025-06-19 (KEPT, legal one-hop)
    await seedLog(db, { id: 'log-S2', date: '2025-06-19', movedToDate: '2025-06-20' }); // KEPT
    // S1 < T-1 — pinned per SCHEMA §9's "Why C8-b pins S1 < T-1"
    await seedLog(db, { id: 'log-S1', date: '2025-06-01', movedToDate: '2025-06-20' }); // LONG, backward-ish/far
    await seedAward(db, { id: 'award-T', date: '2025-06-20', amount: 10, cycleId: 'cycle-C8b' });

    await migrateToV3(db);

    const rows = await awards(db);
    expect(rows).toEqual([{ id: 'award-T', date: '2025-06-20', amount: 10, cycle_id: 'cycle-C8b' }]); // unchanged
    expect(await pointerOf(db, '2025-06-01')).toBeNull(); // S1 (LONG) cleared, revives with no award
    expect(await pointerOf(db, '2025-06-19')).toBe('2025-06-20'); // S2 (KEPT) survives untouched
  });

  // mixed C6. A -> B KEPT one-hop with the visitor's award at B; B -> C LONG with B's own
  // award at C. Expect exactly ONE award, at B, carrying the SAME id/cycle_id as the old
  // (tau, C) row — the homecoming (B1 + destination-clear on B's shadowed visitor award).
  it('mixed C6 — B1 relocates B\'s own award home to B, destination-clear deletes the shadowed visitor award', async () => {
    const db = await openV2Fixture('cr4-fixture-mixed-c6.db');
    await seedLog(db, { id: 'log-A', date: '2025-06-01', movedToDate: '2025-06-02' }); // A -> B, KEPT (B = A+1)
    await seedLog(db, { id: 'log-B', date: '2025-06-02', movedToDate: '2025-06-15' }); // B -> C, LONG
    await seedAward(db, { id: 'award-B-visitor', date: '2025-06-02', amount: 10, cycleId: 'cycle-visitor', createdAt: '2025-06-02T00:00:00.000Z' });
    await seedAward(db, { id: 'award-C', date: '2025-06-15', amount: 6, cycleId: 'cycle-home', createdAt: '2025-06-15T00:00:00.000Z' });

    await migrateToV3(db);

    const rows = await awards(db);
    // Exactly one award, at B, carrying award-C's own id/amount/cycle_id (the homecoming).
    expect(rows).toEqual([{ id: 'award-C', date: '2025-06-02', amount: 6, cycle_id: 'cycle-home' }]);
    expect(await pointerOf(db, '2025-06-01')).toBe('2025-06-02'); // A (KEPT) survives
    expect(await pointerOf(db, '2025-06-02')).toBeNull(); // B (LONG) cleared, revives
  });

  // Review pass 1, blocking item 3: mixed-C6's kill-at-B outcome is DOUBLY covered — B3
  // and destination-clear both enqueue it (B is also B1's relocation destination for the
  // (τ, C) award) — so it does not actually discriminate B3 as the deciding branch;
  // deleting the whole B3 block left the suite green. This fixture is pure B3: no B1
  // relocation targets T at all (X holds no award, so B1 never fires for X, so
  // destination-clear has nothing to piggyback on), isolating B3 as the ONLY mechanism
  // that can delete the award at T.
  //
  // S = T-1 -> T KEPT, visitor's award at T. T's own row is LONG (T -> X, far), with an
  // INELIGIBLE chip ('todo') so a surviving award would be unambiguous inflation, not a
  // value that happens to be re-affirmable anyway. No award at X.
  it('pure B3 (isolated from destination-clear) — T\'s revived own row shadows the kept visitor; the award at T is deleted, not left to inflate lifetime XP', async () => {
    const db = await openV2Fixture('cr4-fixture-pure-b3.db');
    // T = 2025-06-20; S = T-1 = 2025-06-19 (KEPT, legal one-hop)
    await seedLog(db, { id: 'log-S', date: '2025-06-19', movedToDate: '2025-06-20' }); // KEPT
    // T's own row: LONG, pointing far away to X, with an ineligible ('todo') chip.
    await seedLog(db, { id: 'log-T', date: '2025-06-20', movedToDate: '2025-09-01', chipState: 'todo' }); // LONG
    // The kept visitor's award, sitting at T — this is what B3 must delete.
    await seedAward(db, { id: 'award-T-visitor', date: '2025-06-20', amount: 10, cycleId: 'cycle-pure-b3' });
    // Deliberately NO award at X: nothing for B1/destination-clear to relocate or clear,
    // so if B3 alone is removed, nothing else in this fixture touches award-T-visitor.

    await migrateToV3(db);

    const rows = await awards(db);
    expect(rows).toEqual([]); // the visitor's award at T is gone — not left to inflate XP
    expect(await pointerOf(db, '2025-06-19')).toBe('2025-06-20'); // S (KEPT) survives untouched
    expect(await pointerOf(db, '2025-06-20')).toBeNull(); // T (LONG) cleared, revives with its 'todo' data
  });

  it('the one-hop CHECK is live post-migration: a legal one-hop insert succeeds, a longer jump is rejected', async () => {
    const db = await openV2Fixture('cr4-check-live.db');
    await migrateToV3(db);

    const legal = await db.runAsync(
      `INSERT INTO day_log (id, task_id, date, moved_to_date, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
      ['legal', 'tau', '2025-07-01', '2025-07-02', '2025-07-01T00:00:00.000Z', '2025-07-01T00:00:00.000Z'],
    );
    expect(legal.changes).toBe(1);

    await expect(
      db.runAsync(`INSERT INTO day_log (id, task_id, date, moved_to_date, created_at, updated_at) VALUES (?,?,?,?,?,?)`, [
        'illegal',
        'tau',
        '2025-08-01',
        '2025-08-10',
        '2025-08-01T00:00:00.000Z',
        '2025-08-01T00:00:00.000Z',
      ]),
    ).rejects.toThrow(/CHECK/);
  });

  it('day_log survives the rebuild with its indexes and FK intact — no data loss on ordinary rows', async () => {
    const db = await openV2Fixture('cr4-no-data-loss.db');
    await seedLog(db, { id: 'log-plain', date: '2025-06-01', movedToDate: null });
    await migrateToV3(db);
    const row = await db.getFirstAsync<{ id: string; chip_state: string }>(`SELECT id, chip_state FROM day_log WHERE id = 'log-plain'`);
    expect(row).toEqual({ id: 'log-plain', chip_state: 'done' });
    // FK still enforced post-rebuild: inserting for a nonexistent task fails.
    await expect(
      db.runAsync(`INSERT INTO day_log (id, task_id, date, created_at, updated_at) VALUES (?,?,?,?,?)`, [
        'orphan',
        'no-such-task',
        '2025-09-01',
        '2025-09-01T00:00:00.000Z',
        '2025-09-01T00:00:00.000Z',
      ]),
    ).rejects.toThrow();
  });
});
