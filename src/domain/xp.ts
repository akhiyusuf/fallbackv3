/**
 * M2. F13 lifetime XP + levels and F31 cycling XP — the SAME eligibility set,
 * keyed on having a DUE OCCURRENCE (recurring or one-off), never on a cadence.
 * As-needed routine logs (F27) and To-do checkboxes award zero of either. STUB — M2 implements.
 */
import type { LevelInfo, Occurrence } from '@/types';

export declare function xpForOccurrence(o: Occurrence): number;
export declare function isXpEligible(o: Occurrence): boolean;
export declare function levelFor(lifetimeXp: number): LevelInfo;
