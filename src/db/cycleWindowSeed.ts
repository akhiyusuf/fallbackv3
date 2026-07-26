/**
 * M1. GENESIS-ONLY seed for the `cycle_state` singleton (docs/SCHEMA.md §8).
 *
 * `src/domain/cycles.ts` (M2) owns `currentCycleWindow`/`nextCycleWindow` — the ONE place
 * F30/F31 boundary math is pinned. This function exists ONLY to give a brand-new store a
 * legal, non-empty starting window at store-creation time, using the same plain
 * calendar-boundary rule any 'weekly'/'monthly' cadence resolves to — it is called exactly
 * once, from `ensureSingletons`, before any domain code has run. Every subsequent boundary
 * (including the very next one) is M2's `cycles.ts` to own and persist via
 * `repos.cycleState.set()`, per CR-1 (docs/MODULES.md top matter).
 *
 * CR-1 landed: `repos.cycleState` (`CycleStateRepository`) is now a first-class
 * `Repositories` member (`src/types/ports.ts`), not an additive stopgap.
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
