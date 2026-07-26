/** M1. `LogRepository` — docs/API.md §1. The only SQL touching `day_log`. */
import { err, ok } from '@/types';
import type { ChipState, DayLog, Id, Instant, LocalDate, Result } from '@/types';

import type { DbClient } from '../client';
import { parseJsonArray, toJsonArray } from '../json';

interface DayLogRow {
  readonly id: string;
  readonly task_id: string;
  readonly date: string;
  readonly chip_state: string | null;
  readonly is_manual_override: number;
  readonly completed_step_ids: string;
  readonly doses_completed: number;
  readonly moved_to_date: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function rowToDayLog(row: DayLogRow): DayLog {
  return {
    id: row.id as Id,
    taskId: row.task_id as Id,
    date: row.date as LocalDate,
    chipState: row.chip_state as ChipState | null,
    isManualOverride: row.is_manual_override === 1,
    completedStepIds: parseJsonArray<Id>(row.completed_step_ids),
    dosesCompleted: row.doses_completed,
    movedToDate: row.moved_to_date as LocalDate | null,
    createdAt: row.created_at as Instant,
    updatedAt: row.updated_at as Instant,
  };
}

const COLUMNS = `id, task_id, date, chip_state, is_manual_override, completed_step_ids, doses_completed, moved_to_date, created_at, updated_at`;

export function createLogRepository(db: DbClient) {
  return {
    async listForDate(date: LocalDate): Promise<readonly DayLog[]> {
      const rows = await db.getAllAsync<DayLogRow>(`SELECT ${COLUMNS} FROM day_log WHERE date = ?`, [date]);
      return rows.map(rowToDayLog);
    },

    async listForTask(taskId: Id, from: LocalDate, to: LocalDate): Promise<readonly DayLog[]> {
      const rows = await db.getAllAsync<DayLogRow>(
        `SELECT ${COLUMNS} FROM day_log WHERE task_id = ? AND date >= ? AND date <= ? ORDER BY date`,
        [taskId, from, to],
      );
      return rows.map(rowToDayLog);
    },

    async listRange(from: LocalDate, to: LocalDate): Promise<readonly DayLog[]> {
      const rows = await db.getAllAsync<DayLogRow>(`SELECT ${COLUMNS} FROM day_log WHERE date >= ? AND date <= ? ORDER BY date`, [
        from,
        to,
      ]);
      return rows.map(rowToDayLog);
    },

    // Last-write-per-field via UPSERT: a rapid double tap cannot interleave into a corrupt row.
    async upsert(log: DayLog): Promise<Result<void>> {
      try {
        await db.runAsync(
          `INSERT INTO day_log (${COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT (task_id, date) DO UPDATE SET
             chip_state = excluded.chip_state,
             is_manual_override = excluded.is_manual_override,
             completed_step_ids = excluded.completed_step_ids,
             doses_completed = excluded.doses_completed,
             moved_to_date = excluded.moved_to_date,
             updated_at = excluded.updated_at`,
          [
            log.id,
            log.taskId,
            log.date,
            log.chipState,
            log.isManualOverride ? 1 : 0,
            toJsonArray(log.completedStepIds),
            log.dosesCompleted,
            log.movedToDate,
            log.createdAt,
            log.updatedAt,
          ],
        );
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'upsert failed', cause });
      }
    },

    async deleteForTask(taskId: Id): Promise<Result<void>> {
      try {
        await db.runAsync(`DELETE FROM day_log WHERE task_id = ?`, [taskId]);
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'delete failed', cause });
      }
    },
  };
}
