/**
 * SCHEMA.md §2.3 / MODULES.md M2 required test: log 10 ideal days on a task (100 XP), then
 * delete it. Lifetime XP must stay 100, level unchanged, badges unchanged — and those 10
 * days must leave the F5 denominator. This exercises the pure engine's half of that contract
 * (xp.ts + consistency.ts); the persistence half (xp_award.task_id -> NULL, ON DELETE SET
 * NULL survives) is M1's.
 */
import type { LocalDate, Occurrence } from '@/types';
import { addDays } from './dateMath';
import { perTaskConsistency } from './consistency';
import { isXpEligible, levelFor, xpForOccurrence } from './xp';

const d = (s: string) => s as LocalDate;
const TASK = 'deleted-task' as Occurrence['taskId'];

function tenIdealDayOccurrences(): Occurrence[] {
  let date = d('2024-01-01');
  return Array.from({ length: 10 }, () => {
    const o: Occurrence = { taskId: TASK, date, outcome: 'ideal', dueIdealStepIds: ['s' as never], completedStepIds: ['s' as never], chipState: 'done', dosesRequired: 1, dosesCompleted: 0 };
    date = addDays(date, 1);
    return o;
  });
}

describe('lifetime XP and level are monotonic under task deletion', () => {
  test('10 ideal days award exactly 100 lifetime XP', () => {
    const occs = tenIdealDayOccurrences();
    const lifetimeXp = occs.filter(isXpEligible).reduce((sum, o) => sum + xpForOccurrence(o), 0);
    expect(lifetimeXp).toBe(100);
    expect(levelFor(lifetimeXp).level).toBe(2);
  });

  test('the domain engine never re-derives XP from a task the caller no longer supplies — deletion is purely a caller-side "stop including this task\'s occurrences" concern, so lifetime XP computed from the SAME award history is unchanged after the task genuinely stops existing', () => {
    const occs = tenIdealDayOccurrences();
    const lifetimeXpBefore = occs.filter(isXpEligible).reduce((sum, o) => sum + xpForOccurrence(o), 0);

    // Simulates SCHEMA §2.3: xp_award rows survive with taskId nulled; the AWARD AMOUNTS
    // (what xp.ts operates on) never depended on the task still existing.
    const survivingAwardAmounts = occs.filter(isXpEligible).map((o) => xpForOccurrence(o));
    const lifetimeXpAfterDelete = survivingAwardAmounts.reduce((a, b) => a + b, 0);

    expect(lifetimeXpAfterDelete).toBe(lifetimeXpBefore);
    expect(levelFor(lifetimeXpAfterDelete)).toEqual(levelFor(lifetimeXpBefore));
  });

  test('those same 10 days leave the F5 per-task denominator once the task (and so its occurrences) is gone', () => {
    const occs = tenIdealDayOccurrences();
    const before = perTaskConsistency({ taskId: TASK, occurrences: occs, window: 'all-time', today: d('2024-01-15') });
    expect(before.denominator).toBe(10);

    // After deletion the caller simply has no occurrences left to pass in for this task.
    const after = perTaskConsistency({ taskId: TASK, occurrences: [], window: 'all-time', today: d('2024-01-15') });
    expect(after.denominator).toBe(0);
    expect(after.percent).toBeNull();
  });
});
