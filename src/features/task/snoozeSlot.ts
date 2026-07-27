/**
 * M4 — F7. Resolves S20's two-slot action row's SNOOZE slot into exactly one of its three
 * renderings (PRD §3.7 acceptance): "Snooze" enabled, "Snooze" disabled (with a reason), or
 * "Undo snooze". Pure, so it is unit-testable without a render.
 *
 * KNOWN LIMITATION — flagged, not silently shipped (see this module's build report for the
 * full writeup and the proposed contract fix). `Occurrence` (the public read type, `@/types`)
 * does not expose whether the occurrence resolved at a date is the task's OWN occurrence or a
 * moved-in VISITOR (SCHEMA.md §4.2's `designateCarrier` clause a/b vs c) — that distinction
 * lives only in `src/queries/internal.ts`'s private `Carrier`, which M4 may not import (it is
 * not part of the documented `@/queries` surface, and reimplementing carrier selection here
 * would be a second, unsanctioned implementation of exactly the clause-selection logic SCHEMA
 * §4.2's "standing principle" forbids). This function instead derives the SAME answer, for the
 * one shape S20 actually needs (today's occurrence card, source always D-1 by construction —
 * the one-hop invariant), from two PUBLIC signals only: today's and yesterday's resolved
 * `Occurrence.outcome`, plus the pure `isDue` check:
 *
 *   - If yesterday was naturally due (`isDue(task, yesterday)`) and yesterday's occurrence
 *     resolves `not-due`, that can only mean yesterday's OWN row was vacated by a pointer to
 *     today (R-2) — the one-hop CHECK constraint guarantees that pointer targets exactly
 *     today. Calling `useUndoSnooze` against yesterday is then always well-defined (W-1u's
 *     only rejection is "no pointer", which cannot be the case here) and always restores real,
 *     otherwise-unreachable data — so this function renders "Undo snooze" whenever that holds.
 *
 * This is EXACT for the common cases the PRD names (a plain snoozed-in visitor, or a plain
 * live/blank own occurrence) and it is SAFE (never a broken mutation call, never silent data
 * loss) in the one narrow shape it cannot fully disambiguate — C6/C9's "daily task snoozes its
 * OWN today's occurrence forward AND simultaneously receives a visitor from yesterday" — where
 * it prefers showing "Undo snooze" (which always correctly restores yesterday's dormant data)
 * over "Snooze" (which would require knowing today's occurrence is actually still visitable,
 * information this function cannot see). See the build report for the recommended fix: expose
 * a `sourceDate: LocalDate | null` on `Occurrence`, or a dedicated `useSnoozeState` read hook.
 */
import type { LocalDate, Occurrence } from '@/types';

export type SnoozeSlotRendering =
  | { readonly kind: 'snooze'; readonly enabled: boolean; readonly disabledReason?: string }
  | { readonly kind: 'undo'; readonly sourceDate: LocalDate };

export function resolveSnoozeSlot(input: {
  readonly todayOccurrence: Occurrence | undefined;
  readonly yesterdayOccurrence: Occurrence | undefined;
  readonly isDueYesterday: boolean;
  readonly taskSnoozable: boolean;
  readonly yesterday: LocalDate;
}): SnoozeSlotRendering {
  const { todayOccurrence, yesterdayOccurrence, isDueYesterday, taskSnoozable, yesterday } = input;

  if (!todayOccurrence || todayOccurrence.outcome === 'not-due') {
    return { kind: 'snooze', enabled: false, disabledReason: 'Nothing is due today to snooze.' };
  }

  const sourceVacatedYesterday = isDueYesterday && yesterdayOccurrence !== undefined && yesterdayOccurrence.outcome === 'not-due';
  if (sourceVacatedYesterday) {
    return { kind: 'undo', sourceDate: yesterday };
  }

  if (!taskSnoozable) {
    return { kind: 'snooze', enabled: false, disabledReason: 'Snoozing is turned off for this task.' };
  }

  return { kind: 'snooze', enabled: true };
}
