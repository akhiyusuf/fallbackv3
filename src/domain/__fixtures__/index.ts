/**
 * M2. The PRD §6 seed fixture set, reused by every downstream module and by qa-tester.
 * Pure data only — no I/O, no clock reads. Every date below is a literal `LocalDate`
 * string chosen by the fixture, exactly as the PRD's worked examples specify.
 */
import type { DayLog, Id, Instant, LocalDate, OffDayMark, Step, Task, TaskWithSteps } from '@/types';
import { addDays } from '../dateMath';

let counter = 0;
function id(label: string): Id {
  counter++;
  return `fixture:${label}:${counter}` as Id;
}

const CREATED: Instant = '2024-01-01T08:00:00.000Z' as Instant;

function step(taskId: Id, role: 'ideal' | 'fallback', text: string, position: number, dueWeekdays: readonly number[] | null = null): Step {
  return { id: id(`${taskId}-${role}-${position}`), taskId, role, text, position, dueWeekdays: dueWeekdays as Step['dueWeekdays'] };
}

function baseTask(overrides: Partial<Task> & { id: Id; type: Task['type'] }): Task {
  return {
    name: 'Untitled',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: null,
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: null,
    necessity: null,
    todoDoneAt: null,
    snoozable: true, // CR-4 default
    createdAt: CREATED,
    updatedAt: CREATED,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * PRD §6 — the "Studying" Mon-Fri Routine whose "finish weekly assignments" ideal step is
 * toggled ON for Friday only: Tuesday logs ideal off just the daily-reading step; Friday
 * additionally requires the assignments step; toggling every step off on a covered weekday
 * is rejected at save (exercised directly against `validateTaskDraft`, not here).
 */
export function studyingRoutine(): TaskWithSteps {
  const taskId = id('studying');
  const dailyReading = step(taskId, 'ideal', 'Do the assigned reading', 0, null);
  const weeklyAssignments = step(taskId, 'ideal', 'Finish weekly assignments', 1, [5]); // Friday only
  const fallback = step(taskId, 'fallback', 'Skim the chapter summary', 0, null);
  const task = baseTask({
    id: taskId,
    type: 'routine',
    name: 'Studying',
    cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] },
    isTracked: true,
  });
  return { ...task, idealSteps: [dailyReading, weeklyAssignments], fallbackSteps: [fallback] };
}

/** PRD §6 — "Emergency plan" as-needed routine, two "used it" dates, no cadence, never due. */
export function emergencyPlanRoutine(): { task: TaskWithSteps; useDates: readonly string[] } {
  const taskId = id('emergency-plan');
  const task = baseTask({
    id: taskId,
    type: 'routine',
    name: 'Emergency plan',
    isAsNeeded: true,
    isTracked: false,
    cadence: null,
  });
  return { task: { ...task, idealSteps: [], fallbackSteps: [] }, useDates: ['2024-03-01', '2024-03-15'] };
}

/**
 * PRD §6 Maya demo set: Movement + Read routines, >=4 missed days and some off days so the
 * 87% (26/30) per-task anchor reproduces exactly, plus enough Read history for the 100%
 * (26/26) anchor. Returns raw (task, logs, offMarks) so a caller can resolve occurrences with
 * whatever `today` it needs.
 */
export function mayaFixture(): {
  movement: TaskWithSteps;
  read: TaskWithSteps;
  movementLogs: readonly DayLog[];
  readLogs: readonly DayLog[];
  offMarks: readonly OffDayMark[];
} {
  const movementId = id('movement');
  const readId = id('read');

  const movement: TaskWithSteps = {
    ...baseTask({
      id: movementId,
      type: 'routine',
      name: 'Movement',
      cadence: { kind: 'daily' },
      createdAt: '2023-12-01T08:00:00.000Z' as Instant,
    }),
    idealSteps: [step(movementId, 'ideal', '30-min workout', 0)],
    fallbackSteps: [step(movementId, 'fallback', '5-min walk', 0)],
  };
  const read: TaskWithSteps = {
    ...baseTask({
      id: readId,
      type: 'routine',
      name: 'Read',
      cadence: { kind: 'daily' },
      createdAt: '2024-01-01T08:00:00.000Z' as Instant,
    }),
    idealSteps: [step(readId, 'ideal', '20 pages', 0)],
    fallbackSteps: [step(readId, 'fallback', '1 page', 0)],
  };

  // 30 raw days: 22 ideal + 4 fallback + 4 off + 0 missed -> per-task 26/26 = 100% for Read;
  // an extra earlier stretch of 4 missed days ahead of that gives Movement 26/30 = 87%.
  const dates30 = Array.from({ length: 30 }, (_, i) => addDaysStr('2024-02-01', i));
  const outcomes: readonly ('done' | 'fallback' | 'skip' | null)[] = [
    ...Array(22).fill('done'),
    ...Array(4).fill('fallback'),
    null, null, null, null, // off (4) — represented via offMarks below
  ] as const;

  const readLogs: DayLog[] = [];
  const offMarks: OffDayMark[] = [];
  dates30.forEach((date, i) => {
    const outcome = outcomes[i] ?? null;
    if (outcome === null) {
      offMarks.push({ id: id('off'), date: date as OffDayMark['date'], taskId: readId, priorChipState: null, createdAt: CREATED });
    } else {
      readLogs.push(logRow(readId, date, outcome));
    }
  });

  const movementDates = Array.from({ length: 34 }, (_, i) => addDaysStr('2023-12-28', i));
  const movementOutcomes: ('done' | 'fallback' | 'skip' | null)[] = [
    ...Array(4).fill('skip'), // 4 missed, ahead of the 26/30 window
    ...Array(22).fill('done'),
    ...Array(4).fill('fallback'),
    null, null, null, null,
  ];
  const movementLogs: DayLog[] = [];
  movementDates.forEach((date, i) => {
    const outcome = movementOutcomes[i] ?? null;
    if (outcome === null) {
      offMarks.push({ id: id('off'), date: date as OffDayMark['date'], taskId: movementId, priorChipState: null, createdAt: CREATED });
    } else {
      movementLogs.push(logRow(movementId, date, outcome));
    }
  });

  return { movement, read, movementLogs, readLogs, offMarks };
}

function logRow(taskId: Id, date: string, chip: 'done' | 'fallback' | 'skip'): DayLog {
  return {
    id: id('log'),
    taskId,
    date: date as DayLog['date'],
    chipState: chip,
    isManualOverride: true,
    completedStepIds: [],
    dosesCompleted: 0,
    movedToDate: null,
    createdAt: CREATED,
    updatedAt: CREATED,
  };
}

function addDaysStr(startIso: string, n: number): string {
  return addDays(startIso as LocalDate, n);
}

/**
 * PRD §3.5 / §6 — the 3-day mixed aggregate anchor, as REAL tasks/logs/off-marks (review
 * pass 1, blocking item 10: the prior version returned three bare date strings with no way
 * to reproduce the 67% anchor through the actual `resolveOccurrence` pipeline).
 *
 * Day 1 — taskA + taskB both due, both shown up            -> f = 2/2 = 1.0
 * Day 2 — taskA + taskB + taskC due, 2 missed, 1 shown up   -> f = 1/3 ≈ 0.333
 * Day 3 — taskA + taskB due, BOTH off (fully-off day)       -> excluded entirely
 * Aggregate: Sigma f = 1.333 over 2 counted days -> 67%, NOT the all-or-nothing 50%.
 */
export function threeDayMixedFixture(): {
  taskA: TaskWithSteps;
  taskB: TaskWithSteps;
  taskC: TaskWithSteps;
  logs: readonly DayLog[];
  offMarks: readonly OffDayMark[];
  day1: LocalDate;
  day2: LocalDate;
  day3: LocalDate;
} {
  const day1 = '2024-05-01' as LocalDate;
  const day2 = '2024-05-02' as LocalDate;
  const day3 = '2024-05-03' as LocalDate;

  const aId = id('mixed-a');
  const bId = id('mixed-b');
  const cId = id('mixed-c');

  const taskA: TaskWithSteps = {
    ...baseTask({ id: aId, type: 'routine', name: 'Task A', cadence: { kind: 'daily' } }),
    idealSteps: [step(aId, 'ideal', 'Do A', 0)],
    fallbackSteps: [step(aId, 'fallback', 'Min A', 0)],
  };
  const taskB: TaskWithSteps = {
    ...baseTask({ id: bId, type: 'routine', name: 'Task B', cadence: { kind: 'daily' } }),
    idealSteps: [step(bId, 'ideal', 'Do B', 0)],
    fallbackSteps: [step(bId, 'fallback', 'Min B', 0)],
  };
  // A one-off Event: due exactly once, on day 2, regardless of any creation-day bound.
  const taskC: TaskWithSteps = {
    ...baseTask({ id: cId, type: 'event', name: 'Task C (one-off)', cadence: null, eventDate: day2 }),
    idealSteps: [],
    fallbackSteps: [],
  };

  const logs: DayLog[] = [
    logRow(aId, day1, 'done'),
    logRow(bId, day1, 'done'),
    logRow(aId, day2, 'skip'),
    logRow(bId, day2, 'skip'),
    logRow(cId, day2, 'done'),
  ];
  const offMarks: OffDayMark[] = [
    { id: id('off'), date: day3, taskId: aId, priorChipState: null, createdAt: CREATED },
    { id: id('off'), date: day3, taskId: bId, priorChipState: null, createdAt: CREATED },
  ];

  return { taskA, taskB, taskC, logs, offMarks, day1, day2, day3 };
}

/**
 * PRD §6 / ARCHITECTURE §12 — a ≥2-completed-cycles fixture (F30, "R25 fixtures"): two
 * consecutive, non-overlapping, already-archived monthly `CycleRecord`s, so a caller (e.g.
 * S29/S30 or a `cycles.ts`/queries test) can exercise "an archived record's windowed %
 * reproduces F5's arithmetic" without re-deriving one from scratch.
 */
export function twoCompletedCyclesFixture(): { cycleOne: import('@/types').CycleRecord; cycleTwo: import('@/types').CycleRecord } {
  const finalizedAt = '2024-03-01T00:00:00.000Z' as Instant;
  const cycleOne = {
    id: id('cycle-record'),
    cadence: 'monthly' as const,
    startDate: '2024-01-01' as LocalDate,
    endDate: '2024-01-31' as LocalDate,
    consistencyPercent: 87,
    breakdown: { ideal: 22, fallback: 4, off: 4, missed: 4 },
    cyclingXpFinal: 244, // 22*10 + 4*6
    badgeKeysUnlocked: ['showing-up-7'],
    isShortCycle: false,
    finalizedAt,
  };
  const cycleTwo = {
    id: id('cycle-record'),
    cadence: 'monthly' as const,
    startDate: '2024-02-01' as LocalDate,
    endDate: '2024-02-29' as LocalDate,
    consistencyPercent: 100,
    breakdown: { ideal: 26, fallback: 0, off: 3, missed: 0 },
    cyclingXpFinal: 260, // 26*10
    badgeKeysUnlocked: ['showing-up-30'],
    isShortCycle: false,
    finalizedAt: '2024-03-02T00:00:00.000Z' as Instant,
  };
  return { cycleOne, cycleTwo };
}

/**
 * PRD §6 R25(c) — a cycling-XP boundary + mid-cycle cadence-change fixture: a daily-routine
 * task logged across a monthly cycle boundary AND across a mid-month monthly->weekly cadence
 * switch, for `src/queries/mutations.test.ts` to drive the real reconciliation logic against
 * (review pass 1, blocking item 10 — "no cycling-XP boundary / mid-cycle cadence-change
 * fixture", the very behaviours blocking items 1-2 showed were broken).
 */
export function cycleBoundaryFixture(): {
  task: TaskWithSteps;
  /** 5 ideal days inside January (the cycle that will be archived on the boundary walk). */
  januaryLogs: readonly DayLog[];
  /** 3 ideal days inside February (the fresh cycle after the boundary). */
  februaryLogs: readonly DayLog[];
  /** A cadence-change scenario: 4 ideal days inside a monthly cycle, switched mid-month. */
  midMonthLogsBeforeSwitch: readonly DayLog[];
  tenureAnchor: LocalDate;
} {
  const taskId = id('cycle-boundary-task');
  const task: TaskWithSteps = {
    ...baseTask({ id: taskId, type: 'routine', name: 'Daily habit', cadence: { kind: 'daily' }, createdAt: '2023-12-01T00:00:00.000Z' as Instant }),
    idealSteps: [step(taskId, 'ideal', 'Do it', 0)],
    fallbackSteps: [step(taskId, 'fallback', 'Min version', 0)],
  };
  const januaryLogs = Array.from({ length: 5 }, (_, i) => logRow(taskId, addDaysStr('2024-01-05', i), 'done'));
  const februaryLogs = Array.from({ length: 3 }, (_, i) => logRow(taskId, addDaysStr('2024-02-03', i), 'done'));
  const midMonthLogsBeforeSwitch = Array.from({ length: 4 }, (_, i) => logRow(taskId, addDaysStr('2024-04-01', i), 'done'));

  return { task, januaryLogs, februaryLogs, midMonthLogsBeforeSwitch, tenureAnchor: '2023-12-01' as LocalDate };
}
