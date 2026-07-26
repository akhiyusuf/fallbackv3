/**
 * M1. `ProgressRepository` — docs/API.md §1. `xp_award`, `achievement_unlock`,
 * `cycle_record`.
 *
 * `xp_award.task_id` is nullable with `ON DELETE SET NULL` (SCHEMA §2.3): `lifetimeXp()` is
 * a plain `SUM(amount)` over every row regardless of `task_id`, so it can never drop when a
 * task is deleted — the FK action, not application logic, is what keeps a null `task_id`
 * row in the ledger.
 */
import { err, ok } from '@/types';
import type { AchievementUnlock, ConsistencyBreakdown, CycleRecord, CycleCadence, Id, Instant, LocalDate, Result, XpAward } from '@/types';

import type { DbClient } from '../client';
import { parseJsonArray, toJsonArray } from '../json';

interface XpAwardRow {
  readonly id: string;
  readonly task_id: string | null;
  readonly date: string;
  readonly kind: string;
  readonly amount: number;
  readonly cycle_id: string;
  readonly created_at: string;
}

function rowToXpAward(row: XpAwardRow): XpAward {
  return {
    id: row.id as Id,
    taskId: row.task_id as Id | null,
    date: row.date as LocalDate,
    kind: row.kind as 'ideal' | 'fallback',
    amount: row.amount,
    cycleId: row.cycle_id as Id,
    createdAt: row.created_at as Instant,
  };
}

interface UnlockRow {
  readonly key: string;
  readonly unlocked_on: string;
  readonly created_at: string;
}

function rowToUnlock(row: UnlockRow): AchievementUnlock {
  return { key: row.key, unlockedOn: row.unlocked_on as LocalDate, createdAt: row.created_at as Instant };
}

interface CycleRecordRow {
  readonly id: string;
  readonly cadence: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly consistency_percent: number | null;
  readonly breakdown_ideal: number;
  readonly breakdown_fallback: number;
  readonly breakdown_off: number;
  readonly breakdown_missed: number;
  readonly cycling_xp_final: number;
  readonly badge_keys_unlocked: string;
  readonly is_short_cycle: number;
  readonly finalized_at: string;
}

function rowToCycleRecord(row: CycleRecordRow): CycleRecord {
  const breakdown: ConsistencyBreakdown = {
    ideal: row.breakdown_ideal,
    fallback: row.breakdown_fallback,
    off: row.breakdown_off,
    missed: row.breakdown_missed,
  };
  return {
    id: row.id as Id,
    cadence: row.cadence as CycleCadence,
    startDate: row.start_date as LocalDate,
    endDate: row.end_date as LocalDate,
    consistencyPercent: row.consistency_percent,
    breakdown,
    cyclingXpFinal: row.cycling_xp_final,
    badgeKeysUnlocked: parseJsonArray<string>(row.badge_keys_unlocked),
    isShortCycle: row.is_short_cycle === 1,
    finalizedAt: row.finalized_at as Instant,
  };
}

const XP_COLUMNS = `id, task_id, date, kind, amount, cycle_id, created_at`;
const CYCLE_RECORD_COLUMNS = `id, cadence, start_date, end_date, consistency_percent, breakdown_ideal, breakdown_fallback, breakdown_off, breakdown_missed, cycling_xp_final, badge_keys_unlocked, is_short_cycle, finalized_at`;

export function createProgressRepository(db: DbClient) {
  return {
    async listXpAwards(from?: LocalDate, to?: LocalDate): Promise<readonly XpAward[]> {
      if (from && to) {
        const rows = await db.getAllAsync<XpAwardRow>(`SELECT ${XP_COLUMNS} FROM xp_award WHERE date >= ? AND date <= ? ORDER BY date`, [
          from,
          to,
        ]);
        return rows.map(rowToXpAward);
      }
      const rows = await db.getAllAsync<XpAwardRow>(`SELECT ${XP_COLUMNS} FROM xp_award ORDER BY date`);
      return rows.map(rowToXpAward);
    },

    // UNIQUE(task_id, date) — re-logging the same occurrence cannot farm XP. Downgrading a
    // log updates kind/amount in place (docs/SCHEMA.md §7).
    async appendXpAward(award: XpAward): Promise<Result<void>> {
      try {
        await db.runAsync(
          `INSERT INTO xp_award (${XP_COLUMNS}) VALUES (?,?,?,?,?,?,?)
           ON CONFLICT (task_id, date) DO UPDATE SET kind = excluded.kind, amount = excluded.amount, cycle_id = excluded.cycle_id`,
          [award.id, award.taskId, award.date, award.kind, award.amount, award.cycleId, award.createdAt],
        );
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'appendXpAward failed', cause });
      }
    },

    async lifetimeXp(): Promise<number> {
      const row = await db.getFirstAsync<{ total: number | null }>(`SELECT SUM(amount) as total FROM xp_award`);
      return row?.total ?? 0;
    },

    async cyclingXp(cycleId: Id): Promise<number> {
      const row = await db.getFirstAsync<{ total: number | null }>(`SELECT SUM(amount) as total FROM xp_award WHERE cycle_id = ?`, [
        cycleId,
      ]);
      return row?.total ?? 0;
    },

    async listUnlocks(): Promise<readonly AchievementUnlock[]> {
      const rows = await db.getAllAsync<UnlockRow>(`SELECT key, unlocked_on, created_at FROM achievement_unlock`);
      return rows.map(rowToUnlock);
    },

    // Upsert-only, never deletes (SCHEMA.md §7).
    async upsertUnlock(unlock: AchievementUnlock): Promise<Result<void>> {
      try {
        await db.runAsync(
          `INSERT INTO achievement_unlock (key, unlocked_on, created_at) VALUES (?,?,?)
           ON CONFLICT (key) DO UPDATE SET unlocked_on = excluded.unlocked_on`,
          [unlock.key, unlock.unlockedOn, unlock.createdAt],
        );
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'upsertUnlock failed', cause });
      }
    },

    async listCycleRecords(): Promise<readonly CycleRecord[]> {
      const rows = await db.getAllAsync<CycleRecordRow>(`SELECT ${CYCLE_RECORD_COLUMNS} FROM cycle_record ORDER BY end_date DESC`);
      return rows.map(rowToCycleRecord);
    },

    async getCycleRecord(id: Id): Promise<CycleRecord | null> {
      const row = await db.getFirstAsync<CycleRecordRow>(`SELECT ${CYCLE_RECORD_COLUMNS} FROM cycle_record WHERE id = ?`, [id]);
      return row ? rowToCycleRecord(row) : null;
    },

    // Append-only, never overwrites (SCHEMA.md §8).
    async appendCycleRecord(record: CycleRecord): Promise<Result<void>> {
      try {
        await db.runAsync(`INSERT INTO cycle_record (${CYCLE_RECORD_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
          record.id,
          record.cadence,
          record.startDate,
          record.endDate,
          record.consistencyPercent,
          record.breakdown.ideal,
          record.breakdown.fallback,
          record.breakdown.off,
          record.breakdown.missed,
          record.cyclingXpFinal,
          toJsonArray(record.badgeKeysUnlocked),
          record.isShortCycle ? 1 : 0,
          record.finalizedAt,
        ]);
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'appendCycleRecord failed', cause });
      }
    },
  };
}
