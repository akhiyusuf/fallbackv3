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
 * PRD §3.5 / §6 — the 3-day mixed aggregate anchor: Day1 = 2/2 (f=1.0), Day2 = 1/3 (f=0.333),
 * Day3 fully off (excluded) -> aggregate reads 67% (Sigma f = 1.333 over 2 counted days).
 */
export function threeDayMixedFixture(): { day1: string; day2: string; day3: string } {
  return { day1: '2024-05-01', day2: '2024-05-02', day3: '2024-05-03' };
}
