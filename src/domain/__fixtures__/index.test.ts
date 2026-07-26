import type { LocalDate } from '@/types';
import { resolveOccurrence } from '../dayState';
import { isDue } from '../occurrence';
import { aggregateConsistency, perTaskConsistency } from '../consistency';
import {
  cycleBoundaryFixture,
  emergencyPlanRoutine,
  mayaFixture,
  studyingRoutine,
  threeDayMixedFixture,
  twoCompletedCyclesFixture,
} from './index';

const d = (s: string) => s as LocalDate;

describe('__fixtures__ — PRD §6 seed set, reused by every downstream module', () => {
  test('studyingRoutine is due Mon-Fri only, and the assignments step is Friday-only', () => {
    const task = studyingRoutine();
    expect(isDue(task, d('2024-06-03'))).toBe(true); // Monday
    expect(isDue(task, d('2024-06-08'))).toBe(false); // Saturday
  });

  test('the Emergency plan as-needed routine is NEVER due, regardless of its "used it" history', () => {
    const { task } = emergencyPlanRoutine();
    expect(isDue(task, d('2024-03-01'))).toBe(false);
    expect(isDue(task, d('2024-03-15'))).toBe(false);
  });

  test('mayaFixture reproduces the PRD §3.5 87% (Movement, 26/30) and 100% (Read, 26/26) anchors', () => {
    const { movement, read, movementLogs, readLogs, offMarks } = mayaFixture();

    const readDates = readLogs.map((l) => l.date).concat(offMarks.filter((m) => m.taskId === read.id).map((m) => m.date));
    const today = readDates.sort().at(-1) as LocalDate;
    const readOccurrences = readDates
      .map((date) => resolveOccurrence({ task: read, date, today, log: readLogs.find((l) => l.date === date) ?? null, offMarks }))
      .filter((o) => o.outcome !== 'not-due');
    const readResult = perTaskConsistency({ taskId: read.id, occurrences: readOccurrences, window: 'all-time', today });
    expect(readResult.numerator).toBe(26);
    expect(readResult.denominator).toBe(26);
    expect(readResult.percent).toBe(100);

    const movementDates = movementLogs.map((l) => l.date).concat(offMarks.filter((m) => m.taskId === movement.id).map((m) => m.date));
    const movementToday = movementDates.sort().at(-1) as LocalDate;
    const movementOccurrences = movementDates
      .map((date) => resolveOccurrence({ task: movement, date, today: movementToday, log: movementLogs.find((l) => l.date === date) ?? null, offMarks }))
      .filter((o) => o.outcome !== 'not-due');
    const movementResult = perTaskConsistency({ taskId: movement.id, occurrences: movementOccurrences, window: 'all-time', today: movementToday });
    expect(movementResult.numerator).toBe(26);
    expect(movementResult.denominator).toBe(30);
    expect(movementResult.percent).toBe(87);
  });

  test('threeDayMixedFixture reproduces the 67% aggregate anchor through the REAL resolveOccurrence pipeline (review pass 1, item 10)', () => {
    const { taskA, taskB, taskC, logs, offMarks, day1, day2, day3 } = threeDayMixedFixture();
    const today = day3;
    const logFor = (task: typeof taskA, date: LocalDate) => logs.find((l) => l.taskId === task.id && l.date === date) ?? null;

    const occurrences = [
      resolveOccurrence({ task: taskA, date: day1, today, log: logFor(taskA, day1), offMarks }),
      resolveOccurrence({ task: taskB, date: day1, today, log: logFor(taskB, day1), offMarks }),
      resolveOccurrence({ task: taskA, date: day2, today, log: logFor(taskA, day2), offMarks }),
      resolveOccurrence({ task: taskB, date: day2, today, log: logFor(taskB, day2), offMarks }),
      resolveOccurrence({ task: taskC, date: day2, today, log: logFor(taskC, day2), offMarks }),
      resolveOccurrence({ task: taskA, date: day3, today, log: logFor(taskA, day3), offMarks }),
      resolveOccurrence({ task: taskB, date: day3, today, log: logFor(taskB, day3), offMarks }),
    ];

    const result = aggregateConsistency({ occurrences, window: 'all-time', today });
    expect(result.denominator).toBe(2); // day 3 excluded (fully off)
    expect(result.numerator).toBeCloseTo(1 + 1 / 3, 9);
    expect(result.percent).toBe(67);
  });

  test('twoCompletedCyclesFixture supplies two non-overlapping, already-archived monthly records', () => {
    const { cycleOne, cycleTwo } = twoCompletedCyclesFixture();
    expect(cycleOne.endDate < cycleTwo.startDate).toBe(true);
    expect(cycleOne.cadence).toBe('monthly');
    expect(cycleTwo.consistencyPercent).toBe(100);
  });

  test('cycleBoundaryFixture supplies logs spanning a real monthly boundary and a mid-month cadence-change scenario', () => {
    const { januaryLogs, februaryLogs, midMonthLogsBeforeSwitch } = cycleBoundaryFixture();
    expect(januaryLogs.every((l) => l.date.startsWith('2024-01'))).toBe(true);
    expect(februaryLogs.every((l) => l.date.startsWith('2024-02'))).toBe(true);
    expect(midMonthLogsBeforeSwitch.length).toBeGreaterThan(0);
  });
});
