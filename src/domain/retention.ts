/**
 * Recently deleted. A deleted routine, event, course or to-do is not removed at once: it is kept,
 * with its history, for DELETED_KEEP_DAYS days, and can be restored or deleted for good from
 * Settings > Data > Recently deleted. After that it is removed when the app next opens (or when
 * that screen is opened).
 */
import type { Instant } from '@/types';

export const DELETED_KEEP_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Anything deleted before this instant has been kept its full time and is due for removal. */
export function purgeCutoff(now: Instant): Instant {
  return new Date(new Date(now).getTime() - DELETED_KEEP_DAYS * DAY_MS).toISOString() as Instant;
}

/**
 * Whole days left before a deleted item is removed for good, counted the way people read
 * "days left": 30 just after deleting, 1 on its last day, never below 0.
 */
export function daysLeft(deletedAt: Instant, now: Instant): number {
  const removeAt = new Date(deletedAt).getTime() + DELETED_KEEP_DAYS * DAY_MS;
  const left = (removeAt - new Date(now).getTime()) / DAY_MS;
  // Capped: a deletion stamped ahead of the clock (the device clock was set back) must not read as "31 days left".
  return Math.min(DELETED_KEEP_DAYS, Math.max(0, Math.ceil(left)));
}
