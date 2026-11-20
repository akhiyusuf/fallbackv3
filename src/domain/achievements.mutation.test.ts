/**
 * Mutation-testing survivors for `achievements.ts` (review/sonnet/32-mutation-testing.md).
 */
import type { Instant, LocalDate, Occurrence } from '@/types';
import { addDays } from './dateMath';
import { reconcileAchievements } from './achievements';

const d = (s: string) => s as LocalDate;
const NOW = '2024-09-01T12:00:00.000Z' as Instant;
const A = 'task-a' as Occurrence['taskId'];
const B = 'task-b' as Occurrence['taskId'];

function occ(taskId: Occurrence['taskId'], date: LocalDate, outcome: Occurrence['outcome']): Occurrence {
  return { taskId, date, outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 };
}

function run(occurrences: Occurrence[], today = '2024-08-31') {
  return reconcileAchievements({ occurrences, tenureAnchor: d('2030-01-01'), today: d(today), alreadyUnlocked: [], now: NOW });
}

describe('achievements mutation survivors', () => {
  test('A11: a FALLBACK the day after a miss is a Comeback too (not only an ideal)', () => {
    const r = run([occ(A, d('2024-06-01'), 'missed'), occ(A, d('2024-06-02'), 'fallback')]);
    const u = r.find((x) => x.key === 'fallback-comeback');
    expect(u?.unlockedOn).toBe('2024-06-02');
  });

  test('A22: a day counts as shown up when ANY due task showed up (one ideal, one missed)', () => {
    const occs: Occurrence[] = [];
    let date = d('2024-06-01');
    for (let i = 0; i < 7; i++) {
      occs.push(occ(A, date, 'ideal'), occ(B, date, 'missed'));
      date = addDays(date, 1);
    }
    const r = run(occs);
    expect(r.find((x) => x.key === 'showing-up-7')?.unlockedOn).toBe('2024-06-07');
  });

  test('A25: with two full weeks, Full week is dated by the EARLIEST one (Sunday of week 1)', () => {
    // Mondays 2024-06-03 and 2024-06-10: two complete ISO weeks of ideal days.
    const occs: Occurrence[] = [];
    let date = d('2024-06-03');
    for (let i = 0; i < 14; i++) {
      occs.push(occ(A, date, 'ideal'));
      date = addDays(date, 1);
    }
    const r = run(occs);
    expect(r.find((x) => x.key === 'milestone-full-week')?.unlockedOn).toBe('2024-06-09');
  });

  test('A28: createdAt is the instant the app noticed (now), unlockedOn is the true condition date', () => {
    const occs: Occurrence[] = [];
    let date = d('2024-06-01');
    for (let i = 0; i < 7; i++) {
      occs.push(occ(A, date, 'ideal'));
      date = addDays(date, 1);
    }
    const u = run(occs).find((x) => x.key === 'showing-up-7');
    expect(u?.unlockedOn).toBe('2024-06-07');
    expect(u?.createdAt).toBe(NOW);
  });
});
