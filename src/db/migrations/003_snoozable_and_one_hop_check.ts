/**
 * M1. Migration 3 — CR-4 (docs/MODULES.md top matter; docs/SCHEMA.md §4.2, PRD §3.7).
 *
 * Two independent additions landed in one migration because the second REQUIRES the
 * first's column to exist for the rest of the app to typecheck, and both are part of the
 * same F7-rescope contract:
 *   1. `task.snoozable` (INTEGER 0/1 NOT NULL DEFAULT 1) — per-task snooze gate, default on.
 *   2. `day_log`'s one-hop CHECK — `moved_to_date` may only ever point to `date + 1`.
 *      SQLite cannot add a CHECK to an existing table in place, so this is a table rebuild
 *      (create-new / copy / drop / rename), preceded by the legacy-data normalization the
 *      new CHECK requires (see below).
 *
 * ORDER IS LOAD-BEARING — SCHEMA §4.2's own callout, reproduced here because it is the
 * single easiest way to reintroduce the bug an earlier draft shipped: every award
 * predicate below (`LONG`/`KEPT`/`live`/`inbound`/`carrier`) reads `day_log.moved_to_date`,
 * so ALL of it must run against PRE-migration pointer values. Steps, in the exact order
 * SCHEMA §4.2 pins:
 *   1. task.snoozable (independent of the rest; ordered first only because CR-4 lists it
 *      first, not because it interacts with what follows).
 *   2. Build the decision worklist (RELOC from branch B1, KILL from branch B3 +
 *      destination-clears) into temp tables, entirely from SELECTs — day_log/xp_award are
 *      not yet mutated.
 *   3. Snapshot the full relocating award rows (id/kind/amount/cycle_id/created_at) before
 *      any DELETE — a relocation, never a re-mint.
 *   4. DELETE every KILL row and every RELOC source, THEN INSERT the snapshotted rows back
 *      at their new date. Delete-then-insert, never UPDATE: SQLite cannot defer
 *      `UNIQUE(task_id, date)`, and legacy chain-shaped data (old C6: `A→B`, `B→C` as two
 *      independent rows) makes a per-row UPDATE's correctness order-dependent.
 *   5. ONLY NOW clear every LONG pointer (`moved_to_date = NULL`) — after every award
 *      predicate has already been evaluated against the untouched values.
 *   6. Rebuild `day_log` with the new CHECK.
 *
 * The four-branch award table (A/B1/B2/B3) is SCHEMA §4.2's, not re-derived here — see that
 * section for the full predicate definitions (`LONG`, `KEPT`, `live`, `inbound`, `carrier`)
 * and the worked fixtures (M, V, C8-a, C8-b, mixed-C6, plus a sixth pure-B3 fixture added
 * in review pass 1 to discriminate B3 from destination-clear) this SQL is tested against
 * (`src/db/__tests__/crFourSnoozeMigration.test.ts`).
 */
import type { Migration } from './types';

export const MIGRATION_003_SNOOZABLE_AND_ONE_HOP_CHECK: Migration = {
  version: 3,
  name: 'task.snoozable + day_log one-hop moved_to_date CHECK (CR-4)',
  up: `
    -- 1. task.snoozable — PRD §3.7 / SCHEMA §2. Default on; a duplicate inherits the
    --    source task's value automatically (plain column copy, taskRepository.ts).
    ALTER TABLE task ADD COLUMN snoozable INTEGER NOT NULL DEFAULT 1 CHECK (snoozable IN (0,1));

    -- 2. Decision worklist — SCHEMA §4.2's predicates, evaluated against PRE-migration
    --    day_log/xp_award values only (no mutation above this point).
    DROP TABLE IF EXISTS temp._m1_long;
    DROP TABLE IF EXISTS temp._m1_inbound;
    DROP TABLE IF EXISTS temp._m1_carrier;
    DROP TABLE IF EXISTS temp._m1_reloc;
    DROP TABLE IF EXISTS temp._m1_kill;
    DROP TABLE IF EXISTS temp._m1_reloc_awards;

    -- LONG(r): moved_to_date is set and is not exactly date + 1. Every row here gets its
    -- pointer cleared in step 5, regardless of which branch (if any) its target group hit.
    CREATE TEMP TABLE _m1_long AS
    SELECT id, task_id, date, moved_to_date AS target
    FROM day_log
    WHERE moved_to_date IS NOT NULL
      AND moved_to_date != date(date, '+1 day');

    -- inbound(T): ALL rows pointing at T — LONG and KEPT alike (SCHEMA is explicit that
    -- excluding KEPT rows from the carrier computation is the C8-b-shaped bug).
    CREATE TEMP TABLE _m1_inbound AS
    SELECT task_id, moved_to_date AS target, date AS source_date,
           CASE WHEN moved_to_date != date(date, '+1 day') THEN 1 ELSE 0 END AS is_long
    FROM day_log
    WHERE moved_to_date IS NOT NULL;

    -- carrier(T) = the inbound row with MAX(date) — the old latest-source tie-break, over
    -- ALL inbound rows, not just the ones being cleared.
    CREATE TEMP TABLE _m1_carrier AS
    SELECT i.task_id, i.target, i.source_date AS carrier_date, i.is_long AS carrier_is_long
    FROM _m1_inbound i
    JOIN (
      SELECT task_id, target, MAX(source_date) AS carrier_date
      FROM _m1_inbound
      GROUP BY task_id, target
    ) mx ON mx.task_id = i.task_id AND mx.target = i.target AND mx.carrier_date = i.source_date;

    CREATE TEMP TABLE _m1_reloc (task_id TEXT, from_date TEXT, to_date TEXT);
    CREATE TEMP TABLE _m1_kill (task_id TEXT, date TEXT);

    -- Branch B1: not live(T), carrier(T) is LONG -> RELOCATE the award at T home to the
    -- carrier's own date. (Branches A and B2 need no SQL action at all — LEAVE means "do
    -- nothing"; only B1 and B3 mutate the ledger, matching SCHEMA's own RELOC/KILL split.)
    INSERT INTO _m1_reloc (task_id, from_date, to_date)
    SELECT c.task_id, c.target, c.carrier_date
    FROM _m1_carrier c
    WHERE c.carrier_is_long = 1
      AND EXISTS (SELECT 1 FROM xp_award x WHERE x.task_id = c.task_id AND x.date = c.target)
      AND NOT EXISTS (
        SELECT 1 FROM day_log dl WHERE dl.task_id = c.task_id AND dl.date = c.target AND dl.moved_to_date IS NULL
      );

    -- Branch B3: not live(T), carrier(T) is KEPT, and T's own row is itself LONG (revived
    -- this migration) -> the revived own-row shadows the kept visitor; DELETE the award at T.
    INSERT INTO _m1_kill (task_id, date)
    SELECT c.task_id, c.target
    FROM _m1_carrier c
    WHERE c.carrier_is_long = 0
      AND EXISTS (SELECT 1 FROM xp_award x WHERE x.task_id = c.task_id AND x.date = c.target)
      AND NOT EXISTS (
        SELECT 1 FROM day_log dl WHERE dl.task_id = c.task_id AND dl.date = c.target AND dl.moved_to_date IS NULL
      )
      AND EXISTS (SELECT 1 FROM _m1_long l WHERE l.task_id = c.task_id AND l.date = c.target);

    -- Destination-clear (part of B1): a non-relocating award already sitting at a
    -- relocation destination is a shadowed-or-orphaned residue (coherent legacy holds no
    -- award at a vacated source) and must not collide with the homecoming INSERT.
    INSERT INTO _m1_kill (task_id, date)
    SELECT DISTINCT r.task_id, r.to_date
    FROM _m1_reloc r
    WHERE EXISTS (SELECT 1 FROM xp_award x WHERE x.task_id = r.task_id AND x.date = r.to_date)
      AND NOT EXISTS (SELECT 1 FROM _m1_reloc r2 WHERE r2.task_id = r.task_id AND r2.from_date = r.to_date);

    -- 3. Snapshot the relocating rows' FULL shape before any DELETE — id/kind/amount/
    --    cycle_id/created_at all preserved; the cycle stamp is never rewritten.
    CREATE TEMP TABLE _m1_reloc_awards AS
    SELECT x.id AS id, r.task_id AS task_id, r.to_date AS date, x.kind AS kind,
           x.amount AS amount, x.cycle_id AS cycle_id, x.created_at AS created_at
    FROM _m1_reloc r
    JOIN xp_award x ON x.task_id = r.task_id AND x.date = r.from_date;

    -- 4. DELETE (kill rows, then relocation sources) THEN INSERT the snapshot back.
    DELETE FROM xp_award
    WHERE EXISTS (SELECT 1 FROM _m1_kill k WHERE k.task_id = xp_award.task_id AND k.date = xp_award.date);
    DELETE FROM xp_award
    WHERE EXISTS (SELECT 1 FROM _m1_reloc r WHERE r.task_id = xp_award.task_id AND r.from_date = xp_award.date);

    INSERT INTO xp_award (id, task_id, date, kind, amount, cycle_id, created_at)
    SELECT id, task_id, date, kind, amount, cycle_id, created_at FROM _m1_reloc_awards;

    -- 5. ONLY NOW clear every LONG pointer — every award predicate above has already run.
    UPDATE day_log SET moved_to_date = NULL
    WHERE id IN (SELECT id FROM _m1_long);

    DROP TABLE _m1_long;
    DROP TABLE _m1_inbound;
    DROP TABLE _m1_carrier;
    DROP TABLE _m1_reloc;
    DROP TABLE _m1_kill;
    DROP TABLE _m1_reloc_awards;

    -- 6. Table-rebuild: add the one-hop CHECK. SQLite has no ALTER TABLE ADD CONSTRAINT.
    CREATE TABLE day_log_new (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      chip_state TEXT CHECK (chip_state IN ('todo','done','fallback','skip')),
      is_manual_override INTEGER NOT NULL DEFAULT 0 CHECK (is_manual_override IN (0,1)),
      completed_step_ids TEXT NOT NULL DEFAULT '[]',
      doses_completed INTEGER NOT NULL DEFAULT 0,
      moved_to_date TEXT CHECK (moved_to_date IS NULL OR moved_to_date = date(date, '+1 day')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (task_id, date)
    );
    INSERT INTO day_log_new (id, task_id, date, chip_state, is_manual_override, completed_step_ids, doses_completed, moved_to_date, created_at, updated_at)
    SELECT id, task_id, date, chip_state, is_manual_override, completed_step_ids, doses_completed, moved_to_date, created_at, updated_at
    FROM day_log;
    DROP TABLE day_log;
    ALTER TABLE day_log_new RENAME TO day_log;
    CREATE INDEX idx_log_date ON day_log(date);
    CREATE INDEX idx_log_task_date ON day_log(task_id, date);
  `,
};
