import type { LocalDate } from '@/types';
import { resolveOccurrence } from '../dayState';
import { isDue } from '../occurrence';
import { perTaskConsistency } from '../consistency';
import { emergencyPlanRoutine, mayaFixture, studyingRoutine, threeDayMixedFixture } from './index';

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

  test('threeDayMixedFixture supplies the 3 literal dates the 67% anchor test constructs occurrences around', () => {
    const { day1, day2, day3 } = threeDayMixedFixture();
    expect([day1, day2, day3]).toHaveLength(3);
  });
});
