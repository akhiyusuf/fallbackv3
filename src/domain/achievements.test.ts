import type { AchievementUnlock, Instant, LocalDate, Occurrence } from '@/types';
import { addDays } from './dateMath';
import { ACHIEVEMENTS, reconcileAchievements } from './achievements';

const d = (s: string) => s as LocalDate;
const NOW = '2024-06-01T00:00:00.000Z' as Instant;
const TASK = 't1' as Occurrence['taskId'];

function occ(taskId: Occurrence['taskId'], date: LocalDate, outcome: Occurrence['outcome']): Occurrence {
  return { taskId, date, outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 };
}

function daily(taskId: Occurrence['taskId'], start: LocalDate, outcomes: readonly Occurrence['outcome'][]): Occurrence[] {
  let date = start;
  return outcomes.map((outcome) => {
    const o = occ(taskId, date, outcome);
    date = addDays(date, 1);
    return o;
  });
}

describe('ACHIEVEMENTS catalogue', () => {
  test('every label is present and exact per SCHEMA.md §7', () => {
    const labels = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a.label]));
    expect(labels['showing-up-7']).toBe('7 days');
    expect(labels['showing-up-30']).toBe('30 days');
    expect(labels['showing-up-50']).toBe('50 shown up');
    expect(labels['showing-up-200']).toBe('200 shown up');
    expect(labels['fallback-safety-net']).toBe('Safety net');
    expect(labels['fallback-never-zero']).toBe('Never zero');
    expect(labels['fallback-saved-25']).toBe('Saved 25×');
    expect(labels['fallback-comeback']).toBe('Comeback');
    expect(labels['milestone-100-done']).toBe('100 done');
    expect(labels['milestone-course-x3']).toBe('Course ×3');
    expect(labels['milestone-full-week']).toBe('Full week');
    expect(labels['tenure-first-day']).toBe('First day');
    expect(labels['tenure-1-year']).toBe('1 Year');
  });

  test('never mentions "streak" anywhere in a key, label or description', () => {
    const dump = JSON.stringify(ACHIEVEMENTS).toLowerCase();
    expect(dump).not.toContain('streak');
  });
});

describe('reconcileAchievements — showing-up tiers (day-level, not event-level)', () => {
  test('7 shown-up days unlocks showing-up-7, not before', () => {
    const occs6 = daily(TASK, d('2024-01-01'), Array(6).fill('ideal'));
    const r6 = reconcileAchievements({ occurrences: occs6, tenureAnchor: d('2024-01-01'), today: d('2024-01-10'), alreadyUnlocked: [], now: NOW });
    expect(r6.some((u) => u.key === 'showing-up-7')).toBe(false);

    const occs7 = daily(TASK, d('2024-01-01'), Array(7).fill('ideal'));
    const r7 = reconcileAchievements({ occurrences: occs7, tenureAnchor: d('2024-01-01'), today: d('2024-01-10'), alreadyUnlocked: [], now: NOW });
    expect(r7.some((u) => u.key === 'showing-up-7')).toBe(true);
  });

  test('a two-task shown-up day still counts once toward the day-level tally', () => {
    const occs = [occ(TASK, d('2024-01-01'), 'ideal'), occ('t2' as Occurrence['taskId'], d('2024-01-01'), 'ideal'), ...daily(TASK, d('2024-01-02'), Array(6).fill('ideal'))];
    const r = reconcileAchievements({ occurrences: occs, tenureAnchor: d('2024-01-01'), today: d('2024-01-10'), alreadyUnlocked: [], now: NOW });
    expect(r.some((u) => u.key === 'showing-up-7')).toBe(true);
  });
});

describe('reconcileAchievements — fallback-wins (task-level occurrence counts)', () => {
  test('the first fallback ever logged unlocks Safety net', () => {
    const occs = [occ(TASK, d('2024-01-01'), 'fallback')];
    const r = reconcileAchievements({ occurrences: occs, tenureAnchor: d('2024-01-01'), today: d('2024-01-01'), alreadyUnlocked: [], now: NOW });
    expect(r.some((u) => u.key === 'fallback-safety-net')).toBe(true);
    expect(r.some((u) => u.key === 'fallback-never-zero')).toBe(false);
  });

  test('10 fallbacks unlocks Never zero, 25 unlocks Saved 25x', () => {
    const occs = daily(TASK, d('2024-01-01'), Array(25).fill('fallback'));
    const r = reconcileAchievements({ occurrences: occs, tenureAnchor: d('2024-01-01'), today: d('2024-02-01'), alreadyUnlocked: [], now: NOW });
    expect(r.some((u) => u.key === 'fallback-never-zero')).toBe(true);
    expect(r.some((u) => u.key === 'fallback-saved-25')).toBe(true);
  });
});

describe('reconcileAchievements — milestones', () => {
  test('100 completed occurrences (ideal or fallback) unlocks "100 done"', () => {
    const occs = daily(TASK, d('2024-01-01'), Array(100).fill('ideal'));
    const r = reconcileAchievements({ occurrences: occs, tenureAnchor: d('2024-01-01'), today: d('2024-05-01'), alreadyUnlocked: [], now: NOW });
    expect(r.some((u) => u.key === 'milestone-100-done')).toBe(true);
  });

  test('a perfect 7/7 ISO week unlocks "Full week"', () => {
    // 2024-01-01 is a Monday.
    const occs = daily(TASK, d('2024-01-01'), Array(7).fill('ideal'));
    const r = reconcileAchievements({ occurrences: occs, tenureAnchor: d('2024-01-01'), today: d('2024-01-08'), alreadyUnlocked: [], now: NOW });
    expect(r.some((u) => u.key === 'milestone-full-week')).toBe(true);
  });

  test('a week with even one missed day does not unlock "Full week"', () => {
    const occs = daily(TASK, d('2024-01-01'), ['ideal', 'ideal', 'ideal', 'missed', 'ideal', 'ideal', 'ideal']);
    const r = reconcileAchievements({ occurrences: occs, tenureAnchor: d('2024-01-01'), today: d('2024-01-08'), alreadyUnlocked: [], now: NOW });
    expect(r.some((u) => u.key === 'milestone-full-week')).toBe(false);
  });
});

describe('reconcileAchievements — tenure ladder (F29): calendar-elapsed only, consistency-independent', () => {
  test('a fixed anchor with the clock advanced to day 366 and ZERO showing-up activity still unlocks the 1-year badge', () => {
    const anchor = d('2023-01-01');
    const today = addDays(anchor, 366);
    const r = reconcileAchievements({ occurrences: [], tenureAnchor: anchor, today, alreadyUnlocked: [], now: NOW });
    expect(r.some((u) => u.key === 'tenure-1-year')).toBe(true);
    expect(r.some((u) => u.key === 'tenure-first-day')).toBe(true);
    expect(r.some((u) => u.key === 'tenure-2-years')).toBe(false);
  });

  test('a brand-new user holds exactly tenure-first-day', () => {
    const anchor = d('2024-06-01');
    const r = reconcileAchievements({ occurrences: [], tenureAnchor: anchor, today: anchor, alreadyUnlocked: [], now: NOW });
    const tenureKeys = r.filter((u) => u.key.startsWith('tenure-')).map((u) => u.key);
    expect(tenureKeys).toEqual(['tenure-first-day']);
  });
});

describe('reconcileAchievements — upsert-only, never revokes', () => {
  test('an already-unlocked key is never returned again, even though its condition still holds', () => {
    const already: AchievementUnlock[] = [{ key: 'tenure-first-day', unlockedOn: d('2024-01-01'), createdAt: NOW }];
    const r = reconcileAchievements({ occurrences: [], tenureAnchor: d('2024-01-01'), today: d('2024-01-01'), alreadyUnlocked: already, now: NOW });
    expect(r.some((u) => u.key === 'tenure-first-day')).toBe(false);
  });

  test('a backward clock never revokes an already-recorded tenure badge (idempotent recompute)', () => {
    const anchor = d('2020-01-01');
    const already: AchievementUnlock[] = [{ key: 'tenure-1-year', unlockedOn: addDays(anchor, 366), createdAt: NOW }];
    // Clock "moves backward" relative to when the badge was recorded, but is still >= the
    // true unlock date — recompute must not attempt to un-record it (it simply won't re-add it).
    const r = reconcileAchievements({ occurrences: [], tenureAnchor: anchor, today: addDays(anchor, 400), alreadyUnlocked: already, now: NOW });
    expect(r.some((u) => u.key === 'tenure-1-year')).toBe(false); // already present, not re-emitted
  });
});
