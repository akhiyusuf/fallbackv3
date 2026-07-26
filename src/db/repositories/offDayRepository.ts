/**
 * M1. `OffDayRepository` — docs/API.md §1 / docs/SCHEMA.md §5. `mark`/`unmark` are pure
 * persistence: the caller (M2's `useMarkOffDay`) is responsible for computing
 * `priorChipState` before calling `mark`, and for restoring the day_log chip after
 * `unmark` returns. Two upsert paths because `off_day_mark` carries two different unique
 * constraints — `UNIQUE(date, task_id)` for task-scoped rows and the migration-2 partial
 * unique index `(date) WHERE task_id IS NULL` for the single whole-day row per date.
 */
import { err, ok } from '@/types';
import type { ChipState, Id, Instant, LocalDate, OffDayMark, Result } from '@/types';

import type { DbClient } from '../client';

interface OffDayRow {
  readonly id: string;
  readonly date: string;
  readonly task_id: string | null;
  readonly prior_chip_state: string | null;
  readonly created_at: string;
}

function rowToOffDayMark(row: OffDayRow): OffDayMark {
  return {
    id: row.id as Id,
    date: row.date as LocalDate,
    taskId: row.task_id as Id | null,
    priorChipState: row.prior_chip_state as ChipState | null,
    createdAt: row.created_at as Instant,
  };
}

const COLUMNS = `id, date, task_id, prior_chip_state, created_at`;

export function createOffDayRepository(db: DbClient) {
  return {
    async listRange(from: LocalDate, to: LocalDate): Promise<readonly OffDayMark[]> {
      const rows = await db.getAllAsync<OffDayRow>(`SELECT ${COLUMNS} FROM off_day_mark WHERE date >= ? AND date <= ?`, [from, to]);
      return rows.map(rowToOffDayMark);
    },

    async mark(mark: OffDayMark): Promise<Result<void>> {
      try {
        if (mark.taskId === null) {
          await db.runAsync(
            `INSERT INTO off_day_mark (${COLUMNS}) VALUES (?,?,?,?,?)
             ON CONFLICT (date) WHERE task_id IS NULL DO UPDATE SET prior_chip_state = excluded.prior_chip_state`,
            [mark.id, mark.date, null, mark.priorChipState, mark.createdAt],
          );
        } else {
          await db.runAsync(
            `INSERT INTO off_day_mark (${COLUMNS}) VALUES (?,?,?,?,?)
             ON CONFLICT (date, task_id) DO UPDATE SET prior_chip_state = excluded.prior_chip_state`,
            [mark.id, mark.date, mark.taskId, mark.priorChipState, mark.createdAt],
          );
        }
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'mark failed', cause });
      }
    },

    async unmark(date: LocalDate, taskId: Id | null): Promise<Result<void>> {
      try {
        if (taskId === null) {
          await db.runAsync(`DELETE FROM off_day_mark WHERE date = ? AND task_id IS NULL`, [date]);
        } else {
          await db.runAsync(`DELETE FROM off_day_mark WHERE date = ? AND task_id = ?`, [date, taskId]);
        }
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'unmark failed', cause });
      }
    },
  };
}
