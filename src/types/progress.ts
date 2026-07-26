/** M0. F13 XP/levels, F29 tenure, F30 cycle records, F31 cycling XP. */

import type { ConsistencyBreakdown } from './consistency';
import type { Id, Instant, LocalDate } from './primitives';

/* ------------------------------------------------------------------ XP / levels */

/** S24-pinned award values. Only ideal/fallback completions of DUE OCCURRENCES award XP. */
export const XP_IDEAL = 10;
export const XP_FALLBACK = 6;

export interface LevelInfo {
  readonly level: number;
  readonly title: string;
  /** XP accumulated inside the current level. */
  readonly xpIntoLevel: number;
  /** XP required to leave the current level: 100 + 150 * (level - 1). */
  readonly xpForLevel: number;
}

export interface XpState {
  /** F13 lifetime, monotonic. Never resets, decays, or goes to zero. */
  readonly lifetimeXp: number;
  readonly level: LevelInfo;
  /** F31 cycle-scoped counter. */
  readonly cyclingXp: number;
  readonly cycleCadence: CycleCadence;
  readonly currentCycle: CycleWindow;
}

/** Append-only ledger row. Every award is attributable to one occurrence. */
export interface XpAward {
  readonly id: Id;
  readonly taskId: Id;
  readonly date: LocalDate;
  readonly kind: 'ideal' | 'fallback';
  readonly amount: number;
  /** The cycle this award belonged to when granted. */
  readonly cycleId: Id;
  readonly createdAt: Instant;
}

/* ------------------------------------------------------------------ achievements */

export type AchievementCategory = 'showing-up' | 'fallback-wins' | 'milestones' | 'tenure';

export interface AchievementDef {
  readonly key: string;
  readonly category: AchievementCategory;
  readonly label: string;
  readonly description: string;
  /** Locked-state condition copy. Tenure tiers show a CALENDAR condition, never a consistency one. */
  readonly lockedHint: string;
}

export interface AchievementUnlock {
  readonly key: string;
  /**
   * The TRUE calendar date the condition was met — for tenure that is `anchor + tier`,
   * not the date the app happened to observe it. Makes dormancy + clock jumps deterministic
   * and gives F30 a correct "badges unlocked in this cycle" set.
   */
  readonly unlockedOn: LocalDate;
  readonly createdAt: Instant;
}

/** F29. 11 tiers, calendar-elapsed only, consistency-independent. */
export type TenureTierKey =
  | 'tenure-first-day'
  | 'tenure-1-week'
  | 'tenure-1-month'
  | 'tenure-2-months'
  | 'tenure-6-months'
  | 'tenure-1-year'
  | 'tenure-2-years'
  | 'tenure-5-years'
  | 'tenure-10-years'
  | 'tenure-20-years'
  | 'tenure-50-years';

/* ------------------------------------------------------------------ cycles */

export type CycleCadence = 'weekly' | 'monthly';

export interface CycleWindow {
  readonly id: Id;
  readonly cadence: CycleCadence;
  readonly startDate: LocalDate;
  /** Inclusive last day of the cycle. */
  readonly endDate: LocalDate;
}

/** F30. Permanent, append-only, never overwritten. */
export interface CycleRecord {
  readonly id: Id;
  readonly cadence: CycleCadence;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  /** Reuses F5 scope-2's fractional formula windowed to this cycle. null == "no data" cycle. */
  readonly consistencyPercent: number | null;
  readonly breakdown: ConsistencyBreakdown;
  readonly cyclingXpFinal: number;
  readonly badgeKeysUnlocked: readonly string[];
  /** true when a mid-cycle cadence change finalised this cycle early. */
  readonly isShortCycle: boolean;
  readonly finalizedAt: Instant;
}
