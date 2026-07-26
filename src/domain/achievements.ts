/**
 * M2. F13 badge catalogue + F29 tenure ladder. Reconciliation is idempotent and
 * upsert-only: a backward clock never revokes an earned badge. STUB — M2 implements.
 */
import type { AchievementDef, AchievementUnlock, LocalDate, Occurrence } from '@/types';

export declare const ACHIEVEMENTS: readonly AchievementDef[];

export declare function reconcileAchievements(input: {
  occurrences: readonly Occurrence[];
  tenureAnchor: LocalDate;
  today: LocalDate;
  alreadyUnlocked: readonly AchievementUnlock[];
}): AchievementUnlock[];
