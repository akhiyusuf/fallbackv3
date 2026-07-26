/**
 * M1. `cycle_state` singleton accessor (`repos.cycleState`) — CR-1, now a first-class
 * `CycleStateRepository` member of `Repositories` (`src/types/ports.ts`), landed by M0
 * post-review. `CycleState` is imported from `@/types`, not declared here; the SQL and
 * method bodies are unchanged from the original additive stopgap.
 */
import { err, ok } from '@/types';
import type { CycleCadence, CycleState, Id, LocalDate, Result } from '@/types';

import type { DbClient } from '../client';

interface CycleStateRow {
  readonly current_cycle_id: string;
  readonly cadence: string;
  readonly start_date: string;
  readonly end_date: string;
}

function rowToState(row: CycleStateRow): CycleState {
  return {
    currentCycleId: row.current_cycle_id as Id,
    cadence: row.cadence as CycleCadence,
    startDate: row.start_date as LocalDate,
    endDate: row.end_date as LocalDate,
  };
}

export function createCycleStateRepository(db: DbClient) {
  return {
    async get(): Promise<CycleState | null> {
      const row = await db.getFirstAsync<CycleStateRow>(
        `SELECT current_cycle_id, cadence, start_date, end_date FROM cycle_state WHERE id = 1`,
      );
      return row ? rowToState(row) : null;
    },

    async set(state: CycleState): Promise<Result<void>> {
      try {
        await db.runAsync(
          `INSERT INTO cycle_state (id, current_cycle_id, cadence, start_date, end_date) VALUES (1,?,?,?,?)
           ON CONFLICT (id) DO UPDATE SET current_cycle_id = excluded.current_cycle_id, cadence = excluded.cadence,
             start_date = excluded.start_date, end_date = excluded.end_date`,
          [state.currentCycleId, state.cadence, state.startDate, state.endDate],
        );
        return ok(undefined);
      } catch (cause) {
        return err({ code: 'WRITE_FAILED', message: cause instanceof Error ? cause.message : 'cycle_state set failed', cause });
      }
    },
  };
}
