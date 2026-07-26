import type { LocalDate, Occurrence } from '@/types';
import { isXpEligible, levelFor, LEVEL_TITLES, xpForLevel, xpForOccurrence } from './xp';

const d = (s: string) => s as LocalDate;
function occ(outcome: Occurrence['outcome']): Occurrence {
  return { taskId: 't' as never, date: d('2024-01-01'), outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 };
}

describe('xpForOccurrence / isXpEligible — F13 = F31, one eligibility set', () => {
  test('ideal -> 10 XP, eligible', () => {
    expect(xpForOccurrence(occ('ideal'))).toBe(10);
    expect(isXpEligible(occ('ideal'))).toBe(true);
  });
  test('fallback -> 6 XP, eligible', () => {
    expect(xpForOccurrence(occ('fallback'))).toBe(6);
    expect(isXpEligible(occ('fallback'))).toBe(true);
  });
  test.each(['missed', 'off', 'pending', 'not-due'] as const)('%s -> 0 XP, not eligible', (outcome) => {
    expect(xpForOccurrence(occ(outcome))).toBe(0);
    expect(isXpEligible(occ(outcome))).toBe(false);
  });
});

describe('levelFor — SCHEMA.md §7 PINNED ladder', () => {
  test('xpForLevel formula: 100 + 150*(L-1); level 1 -> 100, level 7 -> 1000 (S27 anchors)', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(7)).toBe(1000);
  });

  test('0 XP is level 1, "Getting started" — design-pinned', () => {
    const level = levelFor(0);
    expect(level.level).toBe(1);
    expect(level.title).toBe('Getting started');
    expect(level.xpIntoLevel).toBe(0);
  });

  test('exactly the level-1 threshold advances to level 2', () => {
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(99).level).toBe(1);
  });

  test('level 7 is titled "Consistent" — design-pinned', () => {
    // cumulative XP to REACH level 7: sum of xpForLevel(1..6)
    const cumulativeToLevel7 = [1, 2, 3, 4, 5, 6].reduce((sum, l) => sum + xpForLevel(l), 0);
    expect(levelFor(cumulativeToLevel7).level).toBe(7);
    expect(levelFor(cumulativeToLevel7).title).toBe('Consistent');
  });

  test('level 8 is titled "Dependable" — design-pinned, S28 "New title: Dependable."', () => {
    const cumulativeToLevel8 = [1, 2, 3, 4, 5, 6, 7].reduce((sum, l) => sum + xpForLevel(l), 0);
    expect(levelFor(cumulativeToLevel8).level).toBe(8);
    expect(levelFor(cumulativeToLevel8).title).toBe('Dependable');
  });

  test('level 10 and every level beyond it reuse "Enduring"', () => {
    expect(LEVEL_TITLES[10]).toBe('Enduring');
    const cumulativeToLevel12 = Array.from({ length: 11 }, (_, i) => i + 1).reduce((sum, l) => sum + xpForLevel(l), 0);
    expect(levelFor(cumulativeToLevel12).level).toBe(12);
    expect(levelFor(cumulativeToLevel12).title).toBe('Enduring');
  });

  test('never negative: a defensively-negative input still resolves to level 1', () => {
    expect(levelFor(-50).level).toBe(1);
  });
});
