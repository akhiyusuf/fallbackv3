/**
 * M2. F13 lifetime XP + levels and F31 cycling XP — the SAME eligibility set,
 * keyed on having a DUE OCCURRENCE (recurring or one-off), never on a cadence.
 * As-needed routine logs (F27) and To-do checkboxes award zero of either — they never
 * produce an Occurrence at all (occurrence.isDue is always false for both), so this module
 * never even sees them.
 */
import { XP_FALLBACK, XP_IDEAL } from '@/types';
import type { LevelInfo, Occurrence } from '@/types';

/** XP required to LEAVE level L (not a cumulative total). SCHEMA.md §7 — PINNED formula. */
export function xpForLevel(level: number): number {
  return 100 + 150 * (level - 1);
}

/**
 * Level titles. SCHEMA.md §7 — three are DESIGN-PINNED (index 1, 7, 8; S27/S28/S41 render
 * them verbatim) and must never change; the other seven are architect-authored defaults, free
 * to re-word without touching logic. There is exactly ONE source for a rendered level title —
 * this constant, via `levelFor(xp).title`.
 */
export const LEVEL_TITLES: readonly string[] = [
  '', // unused — levels are 1-indexed
  'Getting started', // 1 — design-pinned
  'Warming up', // 2
  'Finding your rhythm', // 3
  'Steady', // 4
  'Reliable', // 5
  'Resilient', // 6
  'Consistent', // 7 — design-pinned
  'Dependable', // 8 — design-pinned
  'Unshakeable', // 9
  'Enduring', // 10
];

function titleForLevel(level: number): string {
  return level >= LEVEL_TITLES.length ? 'Enduring' : (LEVEL_TITLES[level] as string);
}

/** F13 = F31 eligibility: a due occurrence resolved to ideal or fallback. Nothing else. */
export function isXpEligible(o: Occurrence): boolean {
  return o.outcome === 'ideal' || o.outcome === 'fallback';
}

/** 10 for ideal, 6 for fallback (S24), 0 otherwise. */
export function xpForOccurrence(o: Occurrence): number {
  if (o.outcome === 'ideal') return XP_IDEAL;
  if (o.outcome === 'fallback') return XP_FALLBACK;
  return 0;
}

/** Walks the level ladder from lifetime XP. Never negative, never decays. */
export function levelFor(lifetimeXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, lifetimeXp);
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, title: titleForLevel(level), xpIntoLevel: remaining, xpForLevel: xpForLevel(level) };
}
