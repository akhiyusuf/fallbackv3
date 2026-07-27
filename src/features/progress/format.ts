/**
 * M5 — display-only formatting helpers. Every function here formats an ALREADY-COMPUTED
 * value (a stored LocalDate, an already-rounded stat) for rendering; none of it is
 * percentage/consistency/XP arithmetic (MODULES.md: "render M2's numbers, compute nothing").
 */
import { format } from 'date-fns';

import { addDays, addMonths, addYears, parseLocalDate } from '@/lib/date';
import type { CycleCadence, CycleWindow, LocalDate } from '@/types';

import { TENURE_OFFSETS } from './copy';

export function formatDate(d: LocalDate, pattern = 'MMM d, yyyy'): string {
  return format(parseLocalDate(d), pattern);
}

export function formatMonthDay(d: LocalDate): string {
  return format(parseLocalDate(d), 'MMM d');
}

/** "July 2026" (monthly) / "Week of Apr 6–12, 2026" (weekly) — matches S29/S30's own convention. */
export function formatCycleLabel(window: Pick<CycleWindow, 'cadence' | 'startDate' | 'endDate'>): string {
  if (window.cadence === 'monthly') {
    return format(parseLocalDate(window.startDate), 'MMMM yyyy');
  }
  const start = parseLocalDate(window.startDate);
  const end = parseLocalDate(window.endDate);
  return `Week of ${format(start, 'MMM d')}–${format(end, 'd, yyyy')}`;
}

export function cadenceLabel(cadence: CycleCadence): string {
  return cadence === 'weekly' ? 'Weekly' : 'Monthly';
}

/**
 * A locked tenure badge's absolute unlock date — plain calendar arithmetic (anchor + tier
 * offset), the same shape `src/domain/achievements.ts`'s internal (unexported) `TENURE_TIERS`
 * table computes, duplicated here for DISPLAY ONLY. `reconcileAchievements` remains the sole
 * authority for whether/when a badge actually unlocks and persists; this never feeds a
 * mutation, only a locked-badge caption.
 */
export function tenureUnlockDate(badgeKey: string, anchor: LocalDate): LocalDate | null {
  const offset = TENURE_OFFSETS[badgeKey];
  if (!offset) return null;
  if (offset.kind === 'days') return addDays(anchor, offset.amount);
  if (offset.kind === 'months') return addMonths(anchor, offset.amount);
  return addYears(anchor, offset.amount);
}
