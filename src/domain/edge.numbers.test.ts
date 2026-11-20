/**
 * Edge-case campaign, area 17 (numbers). Pure domain checks: consistency windows and rounding,
 * XP and level thresholds, badge conditions at and just below their thresholds, cycle boundaries.
 * Written as plain functions of their arguments; no clock, no repositories.
 */
import type { AchievementUnlock, CycleCadence, LocalDate, Occurrence, Step } from '@/types';
import { XP_FALLBACK, XP_IDEAL } from '@/types';
import { addDays } from './dateMath';
import { aggregateConsistency, perTaskConsistency, dayFractions } from './consistency';
import { ACHIEVEMENTS, reconcileAchievements } from './achievements';
import { LEVEL_TITLES, isXpEligible, levelFor, xpForLevel, xpForOccurrence } from './xp';
import { currentCycleWindow, cyclesElapsedSince, freshCycleWindow, nextCycleWindow } from './cycles';

const d = (s: string) => s as LocalDate;
const TASK = 'task-1' as Occurrence['taskId'];
const TASK_B = 'task-2' as Occurrence['taskId'];
const NOW = '2030-01-01T00:00:00.000Z' as AchievementUnlock['createdAt'];

type Outcome = Occurrence['outcome'];

function occ(taskId: Occurrence['taskId'], date: string, outcome: Outcome): Occurrence {
  return { taskId, date: d(date), outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 };
}

/** Consecutive daily occurrences for one task, starting at `start`, following `pattern`. */
function run(taskId: Occurrence['taskId'], start: string, pattern: readonly Outcome[]): Occurrence[] {
  let date = d(start);
  return pattern.map((outcome) => {
    const o = occ(taskId, date, outcome);
    date = addDays(date, 1);
    return o;
  });
}

const allTime = 'all-time' as const;
const last7 = 'last-7' as const;
const last30 = 'last-30' as const;

describe('consistency: start of use', () => {
  test('zero days of history is "no data yet" (null), never 0%, on every window and scope', () => {
    for (const window of [last7, last30, allTime] as const) {
      const per = perTaskConsistency({ taskId: TASK, occurrences: [], window, today: d('2024-03-01') });
      const agg = aggregateConsistency({ occurrences: [], window, today: d('2024-03-01') });
      expect(per.percent).toBeNull();
      expect(agg.percent).toBeNull();
      expect(per.denominator).toBe(0);
      expect(agg.denominator).toBe(0);
    }
  });

  test('one day of history, ideal, reads 100% with denominator 1 on every window', () => {
    const occs = [occ(TASK, '2024-03-01', 'ideal')];
    for (const window of [last7, last30, allTime] as const) {
      expect(perTaskConsistency({ taskId: TASK, occurrences: occs, window, today: d('2024-03-01') }).percent).toBe(100);
      expect(aggregateConsistency({ occurrences: occs, window, today: d('2024-03-01') }).percent).toBe(100);
    }
  });

  test('one day of history, missed, reads 0% (not null) once it is resolved', () => {
    const occs = [occ(TASK, '2024-03-01', 'missed')];
    expect(perTaskConsistency({ taskId: TASK, occurrences: occs, window: last7, today: d('2024-03-02') }).percent).toBe(0);
    expect(aggregateConsistency({ occurrences: occs, window: last7, today: d('2024-03-02') }).percent).toBe(0);
  });

  test('a window longer than history truncates; it never fabricates days before the first one', () => {
    const occs = run(TASK, '2024-03-01', ['ideal', 'missed', 'ideal']);
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: last30, today: d('2024-03-03') });
    expect(r.denominator).toBe(3);
    expect(r.numerator).toBe(2);
    expect(r.percent).toBe(67);
  });
});

describe('consistency: off days, pending today, every day off', () => {
  test('every due day off: null percent, the off days are tallied, nothing counted', () => {
    const occs = run(TASK, '2024-03-01', ['off', 'off', 'off']);
    const per = perTaskConsistency({ taskId: TASK, occurrences: occs, window: last7, today: d('2024-03-04') });
    const agg = aggregateConsistency({ occurrences: occs, window: last7, today: d('2024-03-04') });
    expect(per.percent).toBeNull();
    expect(per.breakdown.off).toBe(3);
    expect(agg.percent).toBeNull();
    expect(agg.breakdown.off).toBe(3);
  });

  test('off days do not consume a last-7 slot, so the window reaches past them', () => {
    // 7 counted days among 10 raw days: 3 off days sit inside the window and are skipped.
    const occs = run(TASK, '2024-03-01', ['ideal', 'off', 'ideal', 'off', 'missed', 'ideal', 'off', 'ideal', 'ideal', 'ideal']);
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: last7, today: d('2024-03-11') });
    expect(r.denominator).toBe(7);
    // Walking back from 03-10: 10,09,08 ideal; 07 off (skipped); 06 ideal; 05 missed; 04 off (skipped);
    // 03 ideal; 02 off (skipped); 01 ideal = seven counted days, so the window reaches back to 03-01.
    expect(r.countedDates[0]).toBe('2024-03-01');
    expect(r.countedDates.at(-1)).toBe('2024-03-10');
    expect(r.numerator).toBe(6);
    expect(r.percent).toBe(86);
  });

  test('pending today is excluded entirely, not counted as a miss', () => {
    const occs = [...run(TASK, '2024-03-01', ['ideal', 'ideal']), occ(TASK, '2024-03-03', 'pending')];
    const per = perTaskConsistency({ taskId: TASK, occurrences: occs, window: allTime, today: d('2024-03-03') });
    expect(per.denominator).toBe(2);
    expect(per.percent).toBe(100);
    expect(per.breakdown.missed).toBe(0);
  });

  test('a day where the only due task is pending is absent from the aggregate denominator', () => {
    const occs = [...run(TASK, '2024-03-01', ['ideal']), occ(TASK, '2024-03-02', 'pending')];
    const agg = aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-02') });
    expect(agg.denominator).toBe(1);
    expect(agg.percent).toBe(100);
  });

  test('a day with one off task and one pending task is neither counted nor a fully-off day', () => {
    const occs = [occ(TASK, '2024-03-01', 'off'), occ(TASK_B, '2024-03-01', 'pending')];
    const agg = aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-01') });
    expect(agg.denominator).toBe(0);
    expect(agg.percent).toBeNull();
    expect(agg.breakdown.off).toBe(0);
  });

  test('a day with one off task and one shown-up task counts as fully shown up (f = 1), not 1/2', () => {
    const occs = [occ(TASK, '2024-03-01', 'off'), occ(TASK_B, '2024-03-01', 'ideal')];
    const agg = aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-01') });
    expect(agg.numerator).toBe(1);
    expect(agg.denominator).toBe(1);
    expect(agg.percent).toBe(100);
  });
});

describe('consistency: fallback vs ideal weighting and rounding', () => {
  test('ideal and fallback both count as shown up, equally, in per-task scope', () => {
    const occs = [...run(TASK, '2024-03-01', ['ideal']), ...run(TASK, '2024-03-02', ['fallback'])];
    const r = perTaskConsistency({ taskId: TASK, occurrences: occs, window: allTime, today: d('2024-03-02') });
    expect(r.percent).toBe(100);
    expect(r.breakdown).toEqual({ ideal: 1, fallback: 1, off: 0, missed: 0 });
  });

  test('aggregate: one ideal and one missed task on the same day is half a day', () => {
    const occs = [occ(TASK, '2024-03-01', 'ideal'), occ(TASK_B, '2024-03-01', 'missed')];
    const agg = aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-01') });
    expect(agg.numerator).toBeCloseTo(0.5, 9);
    expect(agg.percent).toBe(50);
  });

  test('aggregate: a fallback and a missed task on one day is half a day, and an ideal-only day is a whole day', () => {
    const occs = [occ(TASK, '2024-03-01', 'fallback'), occ(TASK_B, '2024-03-01', 'missed'), occ(TASK, '2024-03-02', 'ideal')];
    const agg = aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-02') });
    expect(agg.numerator).toBeCloseTo(1.5, 9);
    expect(agg.denominator).toBe(2);
    expect(agg.percent).toBe(75);
  });

  test('percent is never above 100 across many mixed patterns, and never NaN', () => {
    const patterns: Outcome[][] = [
      ['ideal', 'fallback', 'ideal'],
      ['ideal', 'ideal', 'ideal', 'ideal', 'ideal', 'ideal', 'ideal'],
      ['off', 'ideal', 'off', 'ideal'],
      ['fallback', 'fallback', 'missed'],
    ];
    for (const p of patterns) {
      for (const n of [1, 2, 3, 5]) {
        const occs: Occurrence[] = [];
        for (let i = 0; i < n; i++) {
          occs.push(occ(TASK, addDays(d('2024-03-01'), i) as string, p[i % p.length] as Outcome));
          occs.push(occ(TASK_B, addDays(d('2024-03-01'), i) as string, p[(i + 1) % p.length] as Outcome));
        }
        const agg = aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-10') });
        if (agg.percent !== null) {
          expect(Number.isNaN(agg.percent)).toBe(false);
          expect(agg.percent).toBeGreaterThanOrEqual(0);
          expect(agg.percent).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  test('rounding is round-half-up at the very end: 1/8 is 13, 2/3 is 67, 5/6 is 83', () => {
    const eighth = [...run(TASK, '2024-03-01', ['ideal']), ...run(TASK, '2024-03-02', Array(7).fill('missed'))];
    expect(perTaskConsistency({ taskId: TASK, occurrences: eighth, window: allTime, today: d('2024-03-08') }).percent).toBe(13);
    const twoThirds = run(TASK, '2024-03-01', ['ideal', 'ideal', 'missed']);
    expect(perTaskConsistency({ taskId: TASK, occurrences: twoThirds, window: allTime, today: d('2024-03-03') }).percent).toBe(67);
    const fiveSixths = run(TASK, '2024-03-01', ['ideal', 'ideal', 'ideal', 'ideal', 'ideal', 'missed']);
    expect(perTaskConsistency({ taskId: TASK, occurrences: fiveSixths, window: allTime, today: d('2024-03-06') }).percent).toBe(83);
  });

  test('a fraction-sum that lands on an exact .5 tie still rounds up (no float drift to 49)', () => {
    // 3 days: f = 1/3 each shown up on one of three tasks -> numerator 1, denominator 3 is 33.33;
    // use 1/8 of 4 days of 2 tasks each: Σf = 0.5 over 4 days -> 12.5 -> 13.
    const occs: Occurrence[] = [];
    for (let i = 0; i < 4; i++) {
      const date = addDays(d('2024-03-01'), i);
      occs.push(occ(TASK, date, i === 0 ? 'ideal' : 'missed'));
      occs.push(occ(TASK_B, date, 'missed'));
    }
    const agg = aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-04') });
    expect(agg.numerator).toBeCloseTo(0.5, 9);
    expect(agg.denominator).toBe(4);
    expect(agg.percent).toBe(13);
  });

  test('dayFractions lists only resolved days and never a pending-only day', () => {
    const occs = [occ(TASK, '2024-03-01', 'ideal'), occ(TASK, '2024-03-02', 'pending'), occ(TASK, '2024-03-03', 'off')];
    const fractions = dayFractions(occs);
    expect(fractions.map((f) => f.date)).toEqual(['2024-03-01']);
  });
});

describe('consistency: future-dated occurrences never count', () => {
  test('an occurrence dated after today is ignored by both scopes', () => {
    const occs = [occ(TASK, '2024-03-01', 'ideal'), occ(TASK, '2024-03-05', 'missed')];
    expect(perTaskConsistency({ taskId: TASK, occurrences: occs, window: allTime, today: d('2024-03-02') }).denominator).toBe(1);
    expect(aggregateConsistency({ occurrences: occs, window: allTime, today: d('2024-03-02') }).percent).toBe(100);
  });
});

describe('XP: thresholds, levels and titles', () => {
  test('per-occurrence amounts are 10 for ideal, 6 for fallback, and nothing else earns XP', () => {
    expect(XP_IDEAL).toBe(10);
    expect(XP_FALLBACK).toBe(6);
    const pick = (outcome: Outcome) => xpForOccurrence(occ(TASK, '2024-03-01', outcome));
    expect(pick('ideal')).toBe(10);
    expect(pick('fallback')).toBe(6);
    for (const o of ['missed', 'off', 'pending', 'not-due'] as const) {
      expect(pick(o)).toBe(0);
      expect(isXpEligible(occ(TASK, '2024-03-01', o))).toBe(false);
    }
  });

  test('level boundaries are exact: 99 XP is level 1, 100 is level 2 with nothing into it', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForLevel: 100 });
    expect(levelFor(99)).toMatchObject({ level: 1, xpIntoLevel: 99 });
    expect(levelFor(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForLevel: 250 });
    expect(levelFor(349)).toMatchObject({ level: 2, xpIntoLevel: 249 });
    expect(levelFor(350)).toMatchObject({ level: 3, xpIntoLevel: 0, xpForLevel: 400 });
  });

  test('xpForLevel is the pinned ladder: 100, 250, 400, ...', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([100, 250, 400, 550]);
  });

  test('negative lifetime XP is clamped to level 1 with 0 into it, never negative', () => {
    expect(levelFor(-50)).toMatchObject({ level: 1, xpIntoLevel: 0 });
  });

  test('the pinned design titles sit at levels 1, 7 and 8; level 11 and beyond reads Enduring', () => {
    expect(levelFor(0).title).toBe('Getting started');
    let xp = 0;
    for (let l = 1; l < 6; l++) xp += xpForLevel(l);
    expect(levelFor(xp).level).toBe(6);
    expect(LEVEL_TITLES[7]).toBe('Consistent');
    expect(LEVEL_TITLES[8]).toBe('Dependable');
    // Level 10 is the last named title; anything past the ladder falls back to Enduring.
    let tenXp = 0;
    for (let l = 1; l < 10; l++) tenXp += xpForLevel(l);
    expect(levelFor(tenXp)).toMatchObject({ level: 10, title: 'Enduring' });
    expect(levelFor(tenXp + xpForLevel(10))).toMatchObject({ level: 11, title: 'Enduring' });
  });

  test('a very large lifetime total still resolves to a whole level with a remainder below its threshold', () => {
    const info = levelFor(1_000_000);
    expect(info.level).toBeGreaterThan(10);
    expect(info.xpIntoLevel).toBeGreaterThanOrEqual(0);
    expect(info.xpIntoLevel).toBeLessThan(info.xpForLevel);
  });
});

describe('badges: showing-up tiers at the exact threshold', () => {
  function shownUpRun(n: number, outcome: Outcome = 'ideal'): Occurrence[] {
    return run(TASK, '2024-01-01', Array(n).fill(outcome));
  }
  function unlockedKeys(occs: Occurrence[], today = d('2024-12-31')) {
    return reconcileAchievements({ occurrences: occs, tenureAnchor: d('2030-06-01'), today, alreadyUnlocked: [], now: NOW });
  }

  test('7 shown-up days unlocks showing-up-7 dated the 7th day; 6 does not', () => {
    const seven = unlockedKeys(shownUpRun(7));
    expect(seven.find((u) => u.key === 'showing-up-7')?.unlockedOn).toBe('2024-01-07');
    expect(unlockedKeys(shownUpRun(6)).some((u) => u.key === 'showing-up-7')).toBe(false);
  });

  test('a day counts once for showing-up even when two tasks show up that day', () => {
    const occs: Occurrence[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(d('2024-01-01'), i);
      occs.push(occ(TASK, date, 'ideal'), occ(TASK_B, date, 'fallback'));
    }
    const keys = unlockedKeys(occs).map((u) => u.key);
    expect(keys).toContain('showing-up-7');
    const seven = unlockedKeys(occs).find((u) => u.key === 'showing-up-7');
    expect(seven?.unlockedOn).toBe('2024-01-07');
    expect(keys).not.toContain('showing-up-30');
  });

  test('a day where every due task was missed does not count toward showing-up', () => {
    const occs = run(TASK, '2024-01-01', [...Array(6).fill('ideal'), 'missed']);
    expect(unlockedKeys(occs).some((u) => u.key === 'showing-up-7')).toBe(false);
  });

  test('30 days: dated on the 30th shown-up day, not on the 31st; 29 does not unlock', () => {
    const thirty = unlockedKeys(shownUpRun(31));
    expect(thirty.find((u) => u.key === 'showing-up-30')?.unlockedOn).toBe('2024-01-30');
    expect(unlockedKeys(shownUpRun(29)).some((u) => u.key === 'showing-up-30')).toBe(false);
  });

  test('50 and 200 thresholds at exact and one-below counts', () => {
    expect(unlockedKeys(shownUpRun(50)).some((u) => u.key === 'showing-up-50')).toBe(true);
    expect(unlockedKeys(shownUpRun(49)).some((u) => u.key === 'showing-up-50')).toBe(false);
    const big = shownUpRun(200);
    const two = unlockedKeys(big, d('2030-01-01')).find((u) => u.key === 'showing-up-200');
    expect(two?.unlockedOn).toBe(addDays(d('2024-01-01'), 199));
    expect(unlockedKeys(shownUpRun(199), d('2030-01-01')).some((u) => u.key === 'showing-up-200')).toBe(false);
  });
});

describe('badges: fallback wins, comeback, milestones', () => {
  function keysFor(occs: Occurrence[], today = d('2024-12-31')) {
    return reconcileAchievements({ occurrences: occs, tenureAnchor: d('2030-06-01'), today, alreadyUnlocked: [], now: NOW });
  }

  test('Safety net unlocks on the first fallback date; no fallback, no badge', () => {
    const none = keysFor(run(TASK, '2024-01-01', ['ideal', 'missed']));
    expect(none.some((u) => u.key === 'fallback-safety-net')).toBe(false);
    const one = keysFor(run(TASK, '2024-01-01', ['ideal', 'fallback']));
    expect(one.find((u) => u.key === 'fallback-safety-net')?.unlockedOn).toBe('2024-01-02');
  });

  test('Never zero at exactly 10 fallbacks (dated the 10th), not at 9; Saved 25x at exactly 25', () => {
    const nine = keysFor(run(TASK, '2024-01-01', Array(9).fill('fallback')));
    expect(nine.some((u) => u.key === 'fallback-never-zero')).toBe(false);
    const ten = keysFor(run(TASK, '2024-01-01', Array(10).fill('fallback')));
    expect(ten.find((u) => u.key === 'fallback-never-zero')?.unlockedOn).toBe('2024-01-10');
    const twentyFour = keysFor(run(TASK, '2024-01-01', Array(24).fill('fallback')));
    expect(twentyFour.some((u) => u.key === 'fallback-saved-25')).toBe(false);
    const twentyFive = keysFor(run(TASK, '2024-01-01', Array(25).fill('fallback')));
    expect(twentyFive.find((u) => u.key === 'fallback-saved-25')?.unlockedOn).toBe('2024-01-25');
  });

  test('Comeback: the same task shown up the day right after a miss, dated that next day', () => {
    const res = keysFor(run(TASK, '2024-01-01', ['ideal', 'missed', 'ideal']));
    expect(res.find((u) => u.key === 'fallback-comeback')?.unlockedOn).toBe('2024-01-03');
  });

  test('Comeback does not fire when the show-up is two days after the miss, or on another task', () => {
    // Missed on 01-01, nothing on 01-02, shown up on 01-03: two days later, not the next day.
    const gap = [occ(TASK, '2024-01-01', 'missed'), occ(TASK, '2024-01-03', 'ideal')];
    expect(keysFor(gap).some((u) => u.key === 'fallback-comeback')).toBe(false);
    const cross = [occ(TASK, '2024-01-01', 'missed'), occ(TASK_B, '2024-01-02', 'ideal')];
    expect(keysFor(cross).some((u) => u.key === 'fallback-comeback')).toBe(false);
  });

  test('100 done: dated the 100th shown-up occurrence, not the 99th', () => {
    const ninetyNine = keysFor(run(TASK, '2024-01-01', Array(99).fill('ideal')));
    expect(ninetyNine.some((u) => u.key === 'milestone-100-done')).toBe(false);
    const hundred = keysFor(run(TASK, '2024-01-01', Array(100).fill('ideal')));
    expect(hundred.find((u) => u.key === 'milestone-100-done')?.unlockedOn).toBe(addDays(d('2024-01-01'), 99));
  });

  test('Course x3: needs three completed courses, dated the third end date', () => {
    const two = reconcileAchievements({
      occurrences: [], tenureAnchor: d('2030-06-01'), today: d('2024-12-31'), alreadyUnlocked: [], now: NOW,
      completedCourses: [{ id: 'a' as never, endDate: d('2024-02-01') }, { id: 'b' as never, endDate: d('2024-03-01') }],
    });
    expect(two.some((u) => u.key === 'milestone-course-x3')).toBe(false);
    const three = reconcileAchievements({
      occurrences: [], tenureAnchor: d('2030-06-01'), today: d('2024-12-31'), alreadyUnlocked: [], now: NOW,
      completedCourses: [{ id: 'c' as never, endDate: d('2024-06-01') }, { id: 'a' as never, endDate: d('2024-02-01') }, { id: 'b' as never, endDate: d('2024-03-01') }],
    });
    expect(three.find((u) => u.key === 'milestone-course-x3')?.unlockedOn).toBe('2024-06-01');
  });

  test('Full week: seven consecutive days all fully shown up, dated the last day; six days is not enough', () => {
    // 2024-01-01 is a Monday.
    const week = keysFor(run(TASK, '2024-01-01', Array(7).fill('ideal')));
    expect(week.find((u) => u.key === 'milestone-full-week')?.unlockedOn).toBe('2024-01-07');
    const sixPlusMiss = keysFor(run(TASK, '2024-01-01', [...Array(6).fill('ideal'), 'missed']));
    expect(sixPlusMiss.some((u) => u.key === 'milestone-full-week')).toBe(false);
  });

  test('Full week: a fully off day is not a "due day shown up", so a week with one off day does not qualify', () => {
    const occs = run(TASK, '2024-01-01', [...Array(6).fill('ideal'), 'off']);
    expect(keysFor(occs).some((u) => u.key === 'milestone-full-week')).toBe(false);
  });

  test('Full week: one missed task on a day with another shown-up task breaks that day', () => {
    const occs: Occurrence[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(d('2024-01-01'), i);
      occs.push(occ(TASK, date, 'ideal'));
      occs.push(occ(TASK_B, date, i === 3 ? 'missed' : 'ideal'));
    }
    expect(keysFor(occs).some((u) => u.key === 'milestone-full-week')).toBe(false);
  });
});

describe('badges: tenure ladder, dated by calendar arithmetic from the anchor', () => {
  function tenureKeys(anchor: string, today: string, unlocked: AchievementUnlock[] = []) {
    return reconcileAchievements({ occurrences: [], tenureAnchor: d(anchor), today: d(today), alreadyUnlocked: unlocked, now: NOW });
  }

  test('First day unlocks on the anchor itself, and not the day before', () => {
    expect(tenureKeys('2024-05-10', '2024-05-10').find((u) => u.key === 'tenure-first-day')?.unlockedOn).toBe('2024-05-10');
    expect(tenureKeys('2024-05-10', '2024-05-09').some((u) => u.key === 'tenure-first-day')).toBe(false);
  });

  test('1 Week lands exactly 7 days after the anchor, not 6', () => {
    expect(tenureKeys('2024-05-10', '2024-05-16').some((u) => u.key === 'tenure-1-week')).toBe(false);
    expect(tenureKeys('2024-05-10', '2024-05-17').find((u) => u.key === 'tenure-1-week')?.unlockedOn).toBe('2024-05-17');
  });

  test('1 Month from Jan 31 clamps to Feb 29 in a leap year, not Mar 2', () => {
    expect(tenureKeys('2024-01-31', '2024-02-28').some((u) => u.key === 'tenure-1-month')).toBe(false);
    expect(tenureKeys('2024-01-31', '2024-02-29').find((u) => u.key === 'tenure-1-month')?.unlockedOn).toBe('2024-02-29');
  });

  test('1 Year from a Feb 29 anchor lands on Feb 28 in a non-leap year', () => {
    expect(tenureKeys('2024-02-29', '2025-02-28').find((u) => u.key === 'tenure-1-year')?.unlockedOn).toBe('2025-02-28');
    expect(tenureKeys('2024-02-29', '2025-02-27').some((u) => u.key === 'tenure-1-year')).toBe(false);
  });

  test('a clock set backward never unlocks a future tier, and never re-dates an unlocked one', () => {
    const earlier: AchievementUnlock = { key: 'tenure-1-week', unlockedOn: d('2024-05-17'), createdAt: NOW };
    const back = tenureKeys('2024-05-10', '2024-05-01', [earlier]);
    expect(back.some((u) => u.key === 'tenure-1-week')).toBe(false);
    expect(back.some((u) => u.key === 'tenure-first-day')).toBe(false);
  });

  test('already-unlocked badges are never returned again (upsert-only, never re-dated)', () => {
    const stored: AchievementUnlock = { key: 'tenure-first-day', unlockedOn: d('2024-05-01'), createdAt: NOW };
    const res = tenureKeys('2024-05-10', '2024-05-10', [stored]);
    expect(res.some((u) => u.key === 'tenure-first-day')).toBe(false);
  });

  test('every catalogue key has a unique key and a non-empty label', () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of ACHIEVEMENTS) expect(a.label.trim().length).toBeGreaterThan(0);
  });
});

describe('cycles: boundaries and multi-cycle catch-up', () => {
  test('a monthly window containing the last day of a month ends that day; the next day starts a new cycle', () => {
    const w = currentCycleWindow('monthly', d('2024-03-31'));
    expect(w.endDate).toBe('2024-03-31');
    expect(nextCycleWindow(w)).toMatchObject({ startDate: '2024-04-01', endDate: '2024-04-30' });
  });

  test('archiving at the boundary: a cycle ending yesterday is elapsed, one ending today is not', () => {
    const w = currentCycleWindow('weekly', d('2024-01-03')); // Mon 01-01 .. Sun 01-07
    expect(cyclesElapsedSince(w, d('2024-01-07'))).toEqual([]);
    expect(cyclesElapsedSince(w, d('2024-01-08'))).toEqual([w]);
  });

  test('app not opened for several whole cycles: each elapsed cycle appears once, in order, contiguous', () => {
    const start = currentCycleWindow('monthly', d('2024-01-15'));
    const elapsed = cyclesElapsedSince(start, d('2024-04-02'));
    expect(elapsed.map((w) => w.startDate)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
    expect(elapsed.map((w) => w.endDate)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
    const ids = new Set(elapsed.map((w) => w.id));
    expect(ids.size).toBe(elapsed.length);
  });

  test('weekly catch-up across a long absence stays contiguous and never double-counts a day', () => {
    const start = currentCycleWindow('weekly', d('2024-01-03'));
    const elapsed = cyclesElapsedSince(start, d('2024-03-01'));
    for (let i = 1; i < elapsed.length; i++) {
      expect(elapsed[i]?.startDate).toBe(addDays(elapsed[i - 1]!.endDate, 1));
    }
  });

  test('a mid-cycle cadence change leaves a leading partial that runs to its natural end, not the calendar start', () => {
    const fresh = freshCycleWindow('monthly', d('2024-06-15'));
    expect(fresh.startDate).toBe('2024-06-15');
    expect(fresh.endDate).toBe('2024-06-30');
    const oneDayLeft = freshCycleWindow('weekly', d('2024-06-30')); // a Sunday
    expect(oneDayLeft).toMatchObject({ startDate: '2024-06-30', endDate: '2024-06-30' });
  });

  test('after a partial cycle, the next cycle starts exactly the day after and is a full natural window', () => {
    const fresh = freshCycleWindow('weekly', d('2024-06-12')); // Wednesday, ends Sunday 06-16
    expect(fresh.endDate).toBe('2024-06-16');
    expect(nextCycleWindow(fresh)).toMatchObject({ startDate: '2024-06-17', endDate: '2024-06-23' });
  });

  test('cadence values are the two supported ones; anything else yields a monthly window', () => {
    const odd = currentCycleWindow('yearly' as CycleCadence, d('2024-06-12'));
    expect(odd.startDate).toBe('2024-06-01');
    expect(odd.endDate).toBe('2024-06-30');
  });

  test('a cycle window id is deterministic per cadence and start date', () => {
    expect(currentCycleWindow('monthly', d('2024-06-01')).id).toBe(currentCycleWindow('monthly', d('2024-06-30')).id);
    expect(currentCycleWindow('monthly', d('2024-06-01')).id).not.toBe(currentCycleWindow('weekly', d('2024-06-01')).id);
  });
});

describe('cycles: calendar edges', () => {
  test('February in a century year that is not a leap year ends on the 28th (2100), and 2000 ends on the 29th', () => {
    expect(currentCycleWindow('monthly', d('2100-02-10')).endDate).toBe('2100-02-28');
    expect(currentCycleWindow('monthly', d('2000-02-10')).endDate).toBe('2000-02-29');
  });

  test('a weekly cycle that straddles New Year starts in December and ends in January', () => {
    const w = currentCycleWindow('weekly', d('2025-01-01'));
    expect(w).toMatchObject({ startDate: '2024-12-30', endDate: '2025-01-05' });
    expect(nextCycleWindow(w)).toMatchObject({ startDate: '2025-01-06', endDate: '2025-01-12' });
  });

  test('monthly December rolls to January of the next year with the right length', () => {
    const n = nextCycleWindow(currentCycleWindow('monthly', d('2024-12-20')));
    expect(n).toMatchObject({ startDate: '2025-01-01', endDate: '2025-01-31' });
  });
});

// Keep the Step type import used for documentation of the fixture shape.
export type _Unused = Step;
