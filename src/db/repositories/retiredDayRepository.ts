/**
 * The anonymous record a habit leaves behind when it is deleted for good (migration 8): one row
 * per past day, outcome only. No name, no task id, nothing to restore from: just enough for the
 * person's consistency record to stay as it was.
 */
import { err, ok } from '@/types';
import type { Instant, LocalDate, Result, RetiredDay } from '@/types';
import { newId } from '@/lib/id';

import type { DbClient } from '../client';

interface RetiredDayRow {
  readonly id: string;
  readonly date: string;
  readonly outcome: string;
  readonly retired_at: string;
}

export function createRetiredDayRepository(db: DbClient) {
  return {
    async list(): Promise<readonly RetiredDay[]> {
      const rows = await db.getAllAsync<RetiredDayRow>(`SELECT id, date, outcome, retired_at FROM retired_day ORDER BY date`);
      return rows.map((r) => ({ date: r.date as LocalDate, outcome: r.outcome as RetiredDay['outcome'], retiredAt: r.retired_at as Instant }));
    },

    async add(days: readonly RetiredDay[]): Promise<Result<void>> {
      if (days.length === 0) return ok(undefined);
      try {
        await db.withTransactionAsync(async (tx) => {
          for (const d of days) {
            await tx.runAsync(`INSERT INTO retired_day (id, date, outcome, retired_at) VALUES (?,?,?,?)`, [newId(), d.date, d.outcome, d.retiredAt]);
          }
        });
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'could not keep the record', cause });
      }
    },
  };
}
