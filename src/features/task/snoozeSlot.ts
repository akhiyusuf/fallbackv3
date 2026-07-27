/**
 * M4 — F7. Resolves S20's two-slot action row's SNOOZE slot into exactly one of its three
 * renderings (PRD §3.7 acceptance): "Snooze" enabled, "Snooze" disabled (with a reason), or
 * "Undo snooze". Pure, so it is unit-testable without a render.
 *
 * PRD §3.7's three renderings are a CLOSED rule keyed on "the sheet's displayed occurrence" —
 * rendering 3 ("Undo snooze") is only correct when the DISPLAYED occurrence (today's card) IS
 * the dormant visitor moved in from yesterday, i.e. when today is NOT itself naturally due
 * (`!isDue(task, today)`). If today IS naturally due — logged or not — the card is displaying
 * TODAY's own occurrence (renderings 1/2 apply), even if yesterday's own row also happens to
 * have been vacated by a snooze pointing at today. For a daily-cadence task this "today is
 * naturally due" shape is the day-after state of EVERY snooze, by construction — the common
 * case, not a corner case (REVIEW-M4.md pass-1 item 1).
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
 * the one-hop invariant), from three PUBLIC signals only: today's and yesterday's resolved
 * `Occurrence.outcome`, plus the pure `isDue` check (both for yesterday AND for today — the
 * gate this pass adds):
 *
 *   - If yesterday was naturally due (`isDue(task, yesterday)`) and yesterday's occurrence
 *     resolves `not-due`, that can only mean yesterday's OWN row was vacated by a pointer to
 *     today (R-2) — the one-hop CHECK constraint guarantees that pointer targets exactly
 *     today. Calling `useUndoSnooze` against yesterday is then well-defined (W-1u's only
 *     rejection is "no pointer", which cannot be the case here) and restores real,
 *     otherwise-unreachable data — but this is only what the card is DISPLAYING when today
 *     itself is not naturally due (clause c: the visitor occupies today's slot instead of
 *     today's own, absent, occurrence). So "Undo snooze" renders only when
 *     `sourceVacatedYesterday && !isDue(task, today)`.
 *
 * RESIDUAL — documented, not fixed this pass (out of scope; would need a contract change).
 * In C6/C9's shape — a daily task whose OWN today's occurrence ALSO carries a pointer forward
 * (i.e. today was itself snoozed) AND yesterday's row was vacated into today — `isDue(task,
 * today)` is still true (today is naturally due by cadence), so this function renders
 * "Snooze" per renderings 1/2, even though today's own row is not actually re-snoozable (it
 * already carries a pointer). This fails SAFE: `useSnoozeOccurrence` (W-1s) rejects that
 * attempt with `VALIDATION_FAILED` ("this occurrence is already snoozed"), zero writes, and
 * the existing generic failure toast (`onSnoozeSlotPress`) surfaces. The real fix needs a
 * public signal this function cannot derive from `Occurrence.outcome` + `isDue` alone — e.g.
 * a `sourceDate: LocalDate | null` on `Occurrence`, or a dedicated `useSnoozeState` read hook
 * (an architect change request, not made in this pass per REVIEW-M4.md's instruction to keep
 * the fix local).
 */
import type { LocalDate, Occurrence } from '@/types';

export type SnoozeSlotRendering =
  | { readonly kind: 'snooze'; readonly enabled: boolean; readonly disabledReason?: string }
  | { readonly kind: 'undo'; readonly sourceDate: LocalDate };

export function resolveSnoozeSlot(input: {
  readonly todayOccurrence: Occurrence | undefined;
  readonly yesterdayOccurrence: Occurrence | undefined;
  readonly isDueYesterday: boolean;
  readonly isDueToday: boolean;
  readonly taskSnoozable: boolean;
  readonly yesterday: LocalDate;
}): SnoozeSlotRendering {
  const { todayOccurrence, yesterdayOccurrence, isDueYesterday, isDueToday, taskSnoozable, yesterday } = input;

  if (!todayOccurrence || todayOccurrence.outcome === 'not-due') {
    return { kind: 'snooze', enabled: false, disabledReason: 'Nothing is due today to snooze.' };
  }

  const sourceVacatedYesterday = isDueYesterday && yesterdayOccurrence !== undefined && yesterdayOccurrence.outcome === 'not-due';
  // Rendering 3 only when the displayed (today's) card IS the dormant visitor — i.e. today is
  // not itself naturally due. When today IS naturally due, the card shows today's own
  // occurrence and renderings 1/2 apply instead (see RESIDUAL above for the one shape this
  // still can't fully disambiguate, which fails safe).
  if (sourceVacatedYesterday && !isDueToday) {
    return { kind: 'undo', sourceDate: yesterday };
  }

  if (!taskSnoozable) {
    return { kind: 'snooze', enabled: false, disabledReason: 'Snoozing is turned off for this task.' };
  }

  return { kind: 'snooze', enabled: true };
}
