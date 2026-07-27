/**
 * M4 — S17/S18 (REVIEW-M4.md item 7). `eventDate`/`startDate`/`endDate` are free-typed
 * `Input`s cast straight to `LocalDate` (`v as LocalDate`) with no format check anywhere —
 * `validateTaskDraft` (M2, frozen) only checks presence, never shape, so an unparseable date
 * previously failed silently. This is the local, M4-owned check that surfaces a visible error
 * for that case, the same way the existing name/end-date-empty checks do.
 */
import { parseLocalDate, toLocalDate } from '@/lib/date';
import type { LocalDate } from '@/types';

const FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date in `YYYY-MM-DD` form (rejects e.g. "2026-02-30"). */
export function isValidLocalDateString(value: string): boolean {
  if (!FORMAT.test(value)) return false;
  return toLocalDate(parseLocalDate(value as LocalDate)) === value;
}
