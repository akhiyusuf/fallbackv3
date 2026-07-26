/**
 * M1. `AsNeededRepository` — docs/API.md §1 / docs/SCHEMA.md §5. Reference-only rows,
 * read by S23 alone: never joined into consistency or XP (that is enforced by M2 simply
 * never reading this table for those computations, not by anything here).
 */
import { err, ok } from '@/types';
import type { AsNeededUse, Id, Instant, LocalDate, Result } from '@/types';

import type { DbClient } from '../client';

interface AsNeededRow {
  readonly id: string;
  readonly task_id: string;
  readonly date: string;
  readonly marker: string | null;
  readonly created_at: string;
}

function rowToUse(row: AsNeededRow): AsNeededUse {
  return {
    id: row.id as Id,
    taskId: row.task_id as Id,
    date: row.date as LocalDate,
    marker: row.marker as 'ideal' | 'fallback' | null,
    createdAt: row.created_at as Instant,
  };
}

const COLUMNS = `id, task_id, date, marker, created_at`;

export function createAsNeededRepository(db: DbClient) {
  return {
    async listForTask(taskId: Id): Promise<readonly AsNeededUse[]> {
      const rows = await db.getAllAsync<AsNeededRow>(`SELECT ${COLUMNS} FROM as_needed_use WHERE task_id = ? ORDER BY date DESC`, [
        taskId,
      ]);
      return rows.map(rowToUse);
    },

    async append(use: AsNeededUse): Promise<Result<void>> {
      try {
        await db.runAsync(`INSERT INTO as_needed_use (${COLUMNS}) VALUES (?,?,?,?,?)`, [
          use.id,
          use.taskId,
          use.date,
          use.marker,
          use.createdAt,
        ]);
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'append failed', cause });
      }
    },
  };
}
