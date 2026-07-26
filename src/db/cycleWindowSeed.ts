/**
 * M1. GENESIS-ONLY seed for the `cycle_state` singleton (docs/SCHEMA.md §8).
 *
 * `src/domain/cycles.ts` (M2) owns `currentCycleWindow`/`nextCycleWindow` — the ONE place
 * F30/F31 boundary math is pinned. `Repositories`/`StoreLifecycle` (`src/types/ports.ts`,
 * frozen, M0) do not expose a `cycle_state` accessor, so M1 cannot hand this seed off to
 * M2's real implementation at store-creation time without either reaching into M2's
 * internals (not allowed — M2 is a parallel Wave-1 build) or leaving the singleton absent
 * until first foreground reconciliation (risking a null read anywhere that assumes it
 * exists). This function exists ONLY to give a brand-new store a legal, non-empty starting
 * window using the same plain calendar-boundary rule any 'weekly'/'monthly' cadence
 * resolves to — it is called exactly once, from `ensureSingletons`, and every subsequent
 * boundary (including the very next one) is M2's `cycles.ts` to own and persist.
 *
 * CONTRACT GAP, flagged for the architect: `ports.ts`'s `ProgressRepository` has no
 * `cycle_state` get/set, yet SCHEMA.md defines it as a persisted singleton the F31 loop
 * reads on every launch/foreground. `repos.cycleState` (see `src/db/index.ts`) is M1's
 * stopgap so the row can exist and be read/written today; it is additive to `Repositories`,
 * never a modification of the frozen port shape.
 */
import { endOfMonth, endOfWeek } from '@/lib/date';
import type { CycleCadence, LocalDate } from '@/types';

export interface SeedCycleWindow {
  readonly cadence: CycleCadence;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
}

export function seedCycleWindow(cadence: CycleCadence, today: LocalDate): SeedCycleWindow {
  const endDate = cadence === 'weekly' ? endOfWeek(today) : endOfMonth(today);
  return { cadence, startDate: today, endDate };
}
