/**
 * M2. F30 per-cycle records + F31 cycle boundaries. Archive ALWAYS precedes zeroing.
 * A mid-cycle cadence change finalises the in-progress cycle immediately.
 *
 * `CycleWindow.id` is deliberately DETERMINISTIC (`cycle:<cadence>:<startDate>`), not a
 * random UUID — every function here must stay a pure function of its arguments (this is
 * the domain layer qa-tester runs as plain unit tests), and a random id would make
 * `currentCycleWindow`/`nextCycleWindow` non-deterministic for the same input. The
 * query/mutation layer (`src/queries`, which owns `cycle_state` persistence) is free to
 * keep using these ids directly, or remap them at the persistence boundary — `cycle_state`
 * and `xp_award.cycle_id` are plain `Id`-typed TEXT columns, not required to be UUIDs.
 */
import type { CycleCadence, CycleWindow, Id, LocalDate } from '@/types';
import { addDays, endOfMonth, isBefore, startOfMonth, startOfWeek } from './dateMath';

function windowId(cadence: CycleCadence, startDate: LocalDate): Id {
  return `cycle:${cadence}:${startDate}` as Id;
}

export function currentCycleWindow(cadence: CycleCadence, date: LocalDate): CycleWindow {
  if (cadence === 'weekly') {
    const startDate = startOfWeek(date);
    const endDate = addDays(startDate, 6);
    return { id: windowId(cadence, startDate), cadence, startDate, endDate };
  }
  const startDate = startOfMonth(date);
  const endDate = endOfMonth(date);
  return { id: windowId(cadence, startDate), cadence, startDate, endDate };
}

export function nextCycleWindow(w: CycleWindow): CycleWindow {
  const nextStart = addDays(w.endDate, 1);
  return currentCycleWindow(w.cadence, nextStart);
}

/**
 * A LEADING PARTIAL window: starts exactly at `startDate` (never snapped back to the
 * calendar period start, unlike `currentCycleWindow`) and runs to that cadence's natural
 * period end containing `startDate` — the shape SCHEMA §8 pins for a cycle that "begins" mid
 * period (a mid-cycle cadence change) and "runs to that cadence's next natural boundary".
 * Review pass 2, blocking item N3: `finalizeCycleForCadenceChange` was starting the fresh
 * window at the calendar period start via `currentCycleWindow`, overlapping the just-archived
 * short record by up to a full period (the same days landing in two permanent records).
 * Same shape M1's genesis seed uses (`src/db/cycleWindowSeed.ts`).
 */
export function freshCycleWindow(cadence: CycleCadence, startDate: LocalDate): CycleWindow {
  const naturalEnd = currentCycleWindow(cadence, startDate).endDate;
  return { id: windowId(cadence, startDate), cadence, startDate, endDate: naturalEnd };
}

/**
 * Every cycle window that has FULLY elapsed (its `endDate` is before `today`), walking
 * forward from `w` itself. SCHEMA.md §8's boundary loop is `while (currentCycle.end_date <
 * today): archive; reset; advance` — this is that walk's pure boundary-list half; the
 * caller does the archive/reset/persist for each entry, in order, one transaction per
 * boundary.
 */
export function cyclesElapsedSince(w: CycleWindow, today: LocalDate): CycleWindow[] {
  const out: CycleWindow[] = [];
  let cur = w;
  while (isBefore(cur.endDate, today)) {
    out.push(cur);
    cur = nextCycleWindow(cur);
  }
  return out;
}
