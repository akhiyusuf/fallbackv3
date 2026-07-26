/**
 * M1. `cycle_state` singleton accessor. NOT part of the frozen `Repositories` port
 * (`src/types/ports.ts` declares no accessor for this table even though docs/SCHEMA.md §8
 * defines it as a persisted singleton F31 reads every launch/foreground) — see
 * `src/db/cycleWindowSeed.ts`'s header for the full contract-gap note. Exposed as
 * `repos.cycleState`, additive to (never a modification of) `Repositories`.
 */
import { err, ok } from '@/types';
import type { CycleCadence, Id, LocalDate, Result } from '@/types';

import type { DbClient } from '../client';

export interface CycleState {
  readonly currentCycleId: Id;
  readonly cadence: CycleCadence;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
}

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
