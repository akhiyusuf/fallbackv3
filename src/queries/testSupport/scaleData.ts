/**
 * Test-only. Seeded random data for the round-2 scale and identity tests: habits of every kind
 * (live, ended, soft-deleted), their day logs (done, fallback, skipped, pushed to tomorrow),
 * whole-day and per-habit off marks, and the anonymous days of habits deleted for good. Plain
 * data, so the fake-repository test and the real-SQLite test seed the same thing.
 */
import { addDays } from '@/lib/date';
import type { Cadence, DayLog, Id, Instant, LocalDate, OffDayMark, RetiredDay, Step, TaskWithSteps, Weekday } from '@/types';

/** Small, fast, seedable PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DatasetSpec {
  readonly today: LocalDate;
  /** How many days back the record starts. */
  readonly spanDays: number;
  readonly live: number;
  readonly ended: number;
  readonly deleted: number;
  /** Anonymous days left by habits deleted for good. */
  readonly retiredDays: number;
  /** Chance a due day carries a log row at all. */
  readonly logDensity?: number;
  /** Chance a logged day was pushed to tomorrow. */
  readonly pushRate?: number;
  /** Chance a day is a whole-day off mark. */
  readonly offDayRate?: number;
  /** Chance a day is an off mark on one habit. */
  readonly taskOffRate?: number;
  /** Deleted habits were deleted this many days ago or fewer (Recently deleted keeps 30). Default: any time. */
  readonly deletedWithinDays?: number;
  /** Also make one-off events, courses and as-needed habits (the random identity tests). */
  readonly exotic?: boolean;
}

export interface Dataset {
  readonly tasks: TaskWithSteps[];
  readonly logs: DayLog[];
  readonly offs: OffDayMark[];
  readonly retired: RetiredDay[];
  readonly today: LocalDate;
}

function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)] as T;
}

function randomCadence(rng: () => number, anchor: LocalDate): Cadence {
  const r = rng();
  const weekday = (1 + Math.floor(rng() * 7)) as Weekday;
  if (r < 0.55) return { kind: 'daily' };
  if (r < 0.7) {
    const days = new Set<Weekday>();
    const n = 1 + Math.floor(rng() * 5);
    while (days.size < n) days.add((1 + Math.floor(rng() * 7)) as Weekday);
    return { kind: 'specific-weekdays', weekdays: [...days].sort() };
  }
  if (r < 0.8) return { kind: 'weekly', weekday, anchorDate: anchor };
  if (r < 0.88) return { kind: 'bi-weekly', weekday, anchorDate: anchor };
  if (r < 0.94) return { kind: 'monthly', dayOfMonth: 1 + Math.floor(rng() * 31), anchorDate: anchor };
  if (r < 0.97) return { kind: 'bi-monthly', dayOfMonth: 1 + Math.floor(rng() * 31), anchorDate: anchor };
  return { kind: 'yearly', month: 1 + Math.floor(rng() * 12), dayOfMonth: 1 + Math.floor(rng() * 28), anchorDate: anchor };
}

/** Noon UTC: the same calendar day in every time zone from UTC-11 to UTC+11. */
export function noonOf(date: LocalDate): Instant {
  return `${date}T12:00:00.000Z` as Instant;
}

function baseTask(id: string, createdOn: LocalDate): TaskWithSteps {
  const idealStep: Step = { id: `${id}-i` as Id, taskId: id as Id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fallbackStep: Step = { id: `${id}-f` as Id, taskId: id as Id, role: 'fallback', text: 'Small version', position: 0, dueWeekdays: null };
  return {
    id: id as Id,
    type: 'routine',
    name: `Habit ${id}`,
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: null,
    necessity: null,
    todoDoneAt: null,
    priorityRank: null,
    isNote: false,
    snoozable: true,
    createdAt: noonOf(createdOn),
    updatedAt: noonOf(createdOn),
    deletedAt: null,
    endedOn: null,
    idealSteps: [idealStep],
    fallbackSteps: [fallbackStep],
  } as TaskWithSteps;
}

export function buildDataset(seed: number, spec: DatasetSpec): Dataset {
  const rng = makeRng(seed);
  const { today, spanDays } = spec;
  const density = spec.logDensity ?? 0.85;
  const pushRate = spec.pushRate ?? 0.03;
  const offDayRate = spec.offDayRate ?? 0.01;
  const taskOffRate = spec.taskOffRate ?? 0.01;
  const start = addDays(today, -spanDays);

  const tasks: TaskWithSteps[] = [];
  const logs: DayLog[] = [];
  const offs: OffDayMark[] = [];
  const kinds: Array<'live' | 'ended' | 'deleted'> = [
    ...Array.from({ length: spec.live }, () => 'live' as const),
    ...Array.from({ length: spec.ended }, () => 'ended' as const),
    ...Array.from({ length: spec.deleted }, () => 'deleted' as const),
  ];

  kinds.forEach((kind, n) => {
    const id = `t${n}-${kind}`;
    const createdOn = addDays(start, Math.floor(rng() * Math.max(1, spanDays * 0.5)));
    const base = baseTask(id, createdOn);
    let task: TaskWithSteps = { ...base, cadence: randomCadence(rng, createdOn) };

    if (spec.exotic && rng() < 0.15) {
      const eventDate = addDays(createdOn, Math.floor(rng() * 40) - 10);
      task = { ...task, type: 'event', eventDate, cadence: null } as TaskWithSteps;
    } else if (spec.exotic && rng() < 0.1) {
      task = { ...task, type: 'course', startDate: addDays(createdOn, -3), endDate: addDays(createdOn, 60), cadence: { kind: 'daily' } } as TaskWithSteps;
    } else if (spec.exotic && rng() < 0.05) {
      task = { ...task, isAsNeeded: true, cadence: null } as TaskWithSteps;
    }
    if (spec.exotic && rng() < 0.2) task = { ...task, dosesPerDay: 2 };

    let lastDay = today;
    if (kind === 'ended') {
      const endedOn = addDays(createdOn, 5 + Math.floor(rng() * Math.max(6, spanDays * 0.6)));
      if (endedOn < today) {
        task = { ...task, endedOn };
        lastDay = endedOn;
      }
    }
    if (kind === 'deleted') {
      const deletedOn = spec.deletedWithinDays
        ? addDays(today, -(1 + Math.floor(rng() * spec.deletedWithinDays)))
        : addDays(createdOn, 3 + Math.floor(rng() * Math.max(4, spanDays * 0.6)));
      const day = deletedOn < today ? deletedOn : addDays(today, -1);
      task = { ...task, deletedAt: `${day}T${String(8 + Math.floor(rng() * 10)).padStart(2, '0')}:00:00.000Z` as Instant };
      lastDay = day;
    }
    tasks.push(task);

    const stepIds = [task.idealSteps[0]?.id as Id];
    for (let date = createdOn; date <= lastDay; date = addDays(date, 1)) {
      if (rng() < taskOffRate) {
        offs.push({ id: `off-${id}-${date}` as Id, date, taskId: task.id, priorChipState: null, createdAt: noonOf(date) });
      }
      if (rng() > density) continue;
      const r = rng();
      const chipState = r < 0.55 ? 'done' : r < 0.8 ? 'fallback' : r < 0.9 ? 'skip' : 'todo';
      const pushed = rng() < pushRate && date < today;
      logs.push({
        id: `log-${id}-${date}` as Id,
        taskId: task.id,
        date,
        chipState: pushed ? 'skip' : (chipState as DayLog['chipState']),
        isManualOverride: rng() < 0.9,
        completedStepIds: chipState === 'done' && rng() < 0.5 ? stepIds : [],
        dosesCompleted: rng() < 0.2 ? 1 : 0,
        movedToDate: pushed ? addDays(date, 1) : null,
        createdAt: noonOf(date),
        updatedAt: noonOf(date),
      });
    }
  });

  // Whole-day off marks, at most one per date (the store allows one).
  for (let date = start; date <= today; date = addDays(date, 1)) {
    if (rng() < offDayRate) offs.push({ id: `off-all-${date}` as Id, date, taskId: null, priorChipState: null, createdAt: noonOf(date) });
  }

  const retired: RetiredDay[] = [];
  for (let i = 0; i < spec.retiredDays; i++) {
    retired.push({
      date: addDays(start, Math.floor(rng() * spanDays)),
      outcome: pick(rng, ['ideal', 'fallback', 'missed', 'off'] as const),
      retiredAt: noonOf(addDays(today, -1)),
    });
  }
  return { tasks, logs, offs, retired, today };
}
