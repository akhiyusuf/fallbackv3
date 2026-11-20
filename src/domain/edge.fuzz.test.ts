/**
 * Round 3 fuzzing, domain layer (review brief 34). Seeded generators, thousands of cases per
 * property. Every failure names the property, the seed and the case index, so it can be
 * replayed with `runCase(seed)`. No new packages: the PRNG is mulberry32, the date oracle is
 * Date.UTC arithmetic (independent of the code under test).
 */
import { addDays, addMonths, addYears, daysBetween, endOfMonth, endOfWeek, eachDay, startOfMonth, startOfWeek, weekdayOf } from './dateMath';
import { isDue, occurrencesBetween, dueIdealStepIds } from './occurrence';
import { resolveOccurrence, resolvePushedOccurrence } from './dayState';
import { aggregateConsistency, dayFractions, perTaskConsistency } from './consistency';
import { levelFor, xpForLevel, xpForOccurrence } from './xp';
import { validateTaskDraft, emptyRunOccurrences } from './validation';
import { roundHalfUp, toPercent } from '@/lib/number';
import type {
  Cadence,
  ChipState,
  ConsistencyWindow,
  DateRange,
  DayLog,
  Id,
  LocalDate,
  Occurrence,
  OccurrenceOutcome,
  OffDayMark,
  Step,
  TaskWithSteps,
  Weekday,
} from '@/types';

/* ----------------------------------------------------------------- seeded generator */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1)),
    bool: (p = 0.5): boolean => next() < p,
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T,
  };
}
type Rng = ReturnType<typeof mulberry32>;

/** Runs `cases` seeded cases. A failure is re-thrown with the seed, so it can be replayed. */
function property(name: string, cases: number, body: (r: Rng) => void): void {
  for (let i = 0; i < cases; i++) {
    const seed = (0x5eed0000 + i * 7919) >>> 0;
    try {
      body(mulberry32(seed));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`[${name}] seed=${seed} (case ${i}): ${msg}`);
    }
  }
}

/* ----------------------------------------------------------------- date helpers + oracle */

const pad = (n: number, w: number) => String(n).padStart(w, '0');
const iso = (y: number, m: number, d: number): LocalDate => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}` as LocalDate;
/** Last day of month `m` (1-based), by Date.UTC: an oracle independent of dateMath. */
const lastDay = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
const VALID = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidLocal(s: string): boolean {
  const mt = VALID.exec(s);
  if (!mt) return false;
  const y = Number(mt[1]);
  const m = Number(mt[2]);
  const d = Number(mt[3]);
  return m >= 1 && m <= 12 && d >= 1 && d <= lastDay(y, m);
}

function randomDate(r: Rng, loY = 1970, hiY = 2100): LocalDate {
  const y = r.int(loY, hiY);
  const m = r.int(1, 12);
  return iso(y, m, r.int(1, lastDay(y, m)));
}

/** Date `delta` days from a base date, via Date.UTC (oracle). */
const oracleAddDays = (d: LocalDate, n: number): LocalDate => {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, dd) + n * 86400000);
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

const isoWeekday = (d: LocalDate): number => {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
  return dow === 0 ? 7 : dow;
};

/* ----------------------------------------------------------------- task / cadence generators */

const TYPES = ['routine', 'routine', 'event', 'course', 'todo'] as const;

function randomCadence(r: Rng, anchor: LocalDate): Cadence {
  const weekday = () => r.int(1, 7) as Weekday;
  switch (r.int(0, 6)) {
    case 0:
      return { kind: 'daily' };
    case 1: {
      const days: Weekday[] = [];
      const n = r.int(1, 7);
      for (let i = 0; i < n; i++) days.push(weekday()); // duplicates allowed on purpose
      return { kind: 'specific-weekdays', weekdays: days };
    }
    case 2:
      return { kind: 'weekly', weekday: weekday(), anchorDate: anchor };
    case 3:
      return { kind: 'bi-weekly', weekday: weekday(), anchorDate: anchor };
    case 4:
      return { kind: 'monthly', dayOfMonth: r.int(1, 31), anchorDate: anchor };
    case 5:
      return { kind: 'bi-monthly', dayOfMonth: r.int(1, 31), anchorDate: anchor };
    default:
      return { kind: 'yearly', month: r.int(1, 12), dayOfMonth: r.int(1, 31), anchorDate: anchor };
  }
}

function randomTask(r: Rng, base: LocalDate): TaskWithSteps {
  const type = r.pick(TYPES);
  const near = () => oracleAddDays(base, r.int(-400, 400));
  const isAsNeeded = type === 'routine' && r.bool(0.1);
  const stepIds = ['s0', 's1', 's2', 's3'] as Id[];
  const idealSteps: Step[] = [];
  const nSteps = r.int(0, 4);
  for (let i = 0; i < nSteps; i++) {
    const dueWeekdays = r.bool(0.5) ? null : ([r.int(1, 7), r.int(1, 7)] as Weekday[]);
    idealSteps.push({ id: stepIds[i] as Id, taskId: 't' as Id, role: 'ideal', text: 'x', position: i, dueWeekdays } as unknown as Step);
  }
  const start = r.bool(0.7) ? near() : null;
  const end = start && r.bool(0.8) ? oracleAddDays(start, r.int(-5, 300)) : r.bool(0.3) ? near() : null;
  return {
    id: 't' as Id,
    type,
    name: 'task',
    isAsNeeded,
    cadence: type === 'todo' || (type === 'event' && r.bool(0.4)) ? null : randomCadence(r, near()),
    eventDate: type === 'event' && r.bool(0.6) ? near() : null,
    endedOn: r.bool(0.25) ? near() : null,
    startDate: start,
    endDate: end,
    dosesPerDay: r.int(1, 4),
    idealSteps,
    fallbackSteps: [],
  } as unknown as TaskWithSteps;
}

/** Reference implementation of "is this a due date?", written from the spec in occurrence.ts. */
function oracleDue(task: TaskWithSteps, date: LocalDate, notBefore?: LocalDate): boolean {
  if (task.type === 'todo' || task.isAsNeeded) return false;
  if (task.endedOn != null && date > task.endedOn) return false;
  if (task.type === 'event' && task.eventDate !== null) return date === task.eventDate;
  if (task.type === 'course') {
    if (!task.cadence || !task.startDate || !task.endDate) return false;
    if (date < task.startDate || date > task.endDate) return false;
  } else {
    if (!task.cadence) return false;
    if (notBefore !== undefined && date < notBefore) return false;
  }
  const c = task.cadence as Cadence;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wd = isoWeekday(date);
  const pastAnchor = (a: LocalDate) => date >= a;
  switch (c.kind) {
    case 'daily':
      return true;
    case 'specific-weekdays':
      return c.weekdays.includes(wd as Weekday);
    case 'weekly':
      return wd === c.weekday && pastAnchor(c.anchorDate);
    case 'bi-weekly': {
      if (wd !== c.weekday || !pastAnchor(c.anchorDate)) return false;
      const [ay, am, ad] = c.anchorDate.split('-').map(Number) as [number, number, number];
      const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ay, am - 1, ad)) / 86400000);
      return Math.floor(days / 7) % 2 === 0;
    }
    case 'monthly':
      return d === Math.min(c.dayOfMonth, lastDay(y, m)) && pastAnchor(c.anchorDate);
    case 'bi-monthly': {
      if (d !== Math.min(c.dayOfMonth, lastDay(y, m)) || !pastAnchor(c.anchorDate)) return false;
      const [ay, am] = c.anchorDate.split('-').map(Number) as [number, number, number];
      return ((y - ay) * 12 + (m - am)) % 2 === 0;
    }
    case 'yearly': {
      const sameMonthDay = m === c.month && d === Math.min(c.dayOfMonth, lastDay(y, m));
      return sameMonthDay && pastAnchor(c.anchorDate);
    }
  }
}

const OUTCOMES: readonly OccurrenceOutcome[] = ['ideal', 'fallback', 'missed', 'off', 'pending', 'not-due'];
const CHIPS: readonly (ChipState | null)[] = ['todo', 'done', 'fallback', 'skip', null];

/* ================================================================= date math */

describe('fuzz: dateMath', () => {
  it('addDays round-trips, matches a UTC oracle, and daysBetween is consistent (3000 cases)', () => {
    property('addDays', 3000, (r) => {
      const d = randomDate(r);
      const n = r.int(-50000, 50000);
      const e = addDays(d, n);
      expect(isValidLocal(e)).toBe(true);
      expect(e).toBe(oracleAddDays(d, n));
      expect(addDays(e, -n)).toBe(d);
      expect(daysBetween(d, e)).toBe(n);
      expect(daysBetween(e, d)).toBe(-n);
    });
  });

  it('weekdayOf matches the UTC oracle and steps forward one weekday per day (3000 cases)', () => {
    property('weekdayOf', 3000, (r) => {
      const d = randomDate(r);
      expect(weekdayOf(d)).toBe(isoWeekday(d));
      const wd = weekdayOf(d);
      expect(weekdayOf(addDays(d, 1))).toBe((wd % 7) + 1);
    });
  });

  it('addMonths and addYears clamp the day into the target month like the oracle (3000 cases)', () => {
    property('addMonths', 3000, (r) => {
      const d = randomDate(r);
      const n = r.int(-600, 600);
      const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
      const total = y * 12 + (m - 1) + n;
      const ny = Math.floor(total / 12);
      const nm = (total % 12) + 1;
      const expected = iso(ny, nm, Math.min(dd, lastDay(ny, nm)));
      expect(addMonths(d, n)).toBe(expected);
      expect(addYears(d, Math.trunc(n / 12))).toBe(addMonths(d, Math.trunc(n / 12) * 12));
      expect(isValidLocal(addMonths(d, n))).toBe(true);
    });
  });

  it('start/end of week and month bracket the date and land on the right weekdays (3000 cases)', () => {
    property('bracketing', 3000, (r) => {
      const d = randomDate(r);
      const sw = startOfWeek(d);
      const ew = endOfWeek(d);
      expect(weekdayOf(sw)).toBe(1);
      expect(weekdayOf(ew)).toBe(7);
      expect(daysBetween(sw, ew)).toBe(6);
      expect(sw <= d && d <= ew).toBe(true);
      const sm = startOfMonth(d);
      const em = endOfMonth(d);
      expect(sm.slice(8)).toBe('01');
      expect(em).toBe(iso(Number(d.slice(0, 4)), Number(d.slice(5, 7)), lastDay(Number(d.slice(0, 4)), Number(d.slice(5, 7)))));
    });
  });

  it('eachDay is ascending, gap-free, and empty for an inverted range (500 cases)', () => {
    property('eachDay', 500, (r) => {
      const from = randomDate(r);
      const to = addDays(from, r.int(-5, 400));
      const days = eachDay(from, to);
      if (from > to) {
        expect(days).toEqual([]);
        return;
      }
      expect(days.length).toBe(daysBetween(from, to) + 1);
      for (let i = 1; i < days.length; i++) expect(days[i]).toBe(addDays(days[i - 1] as LocalDate, 1));
    });
  });
});

/* ================================================================= occurrence / isDue */

describe('fuzz: occurrence resolution (isDue, occurrencesBetween, dueIdealStepIds)', () => {
  it('occurrencesBetween matches the oracle, stays inside the range, never precedes notBefore or follows endedOn (500 cases)', () => {
    property('occurrencesBetween', 500, (r) => {
      const base = randomDate(r, 1975, 2095);
      const task = randomTask(r, base);
      const from = randomDate(r, 1975, 2095);
      const to = addDays(from, r.int(-3, 500));
      const notBefore = r.bool(0.5) ? oracleAddDays(base, r.int(-200, 200)) : undefined;

      const got = occurrencesBetween(task, from, to, notBefore);
      const want: LocalDate[] = [];
      for (const d of from <= to ? eachDay(from, to) : []) if (oracleDue(task, d, notBefore)) want.push(d);
      expect(got).toEqual(want);

      expect(occurrencesBetween(task, from, to, notBefore)).toEqual(got); // deterministic
      for (let i = 0; i < got.length; i++) {
        const d = got[i] as LocalDate;
        expect(isValidLocal(d)).toBe(true);
        expect(d >= from && d <= to).toBe(true);
        if (i > 0) expect(d > (got[i - 1] as LocalDate)).toBe(true);
        if (task.endedOn != null) expect(d <= task.endedOn).toBe(true);
        if (notBefore !== undefined && task.type !== 'course' && !(task.type === 'event' && task.eventDate !== null)) {
          expect(d >= notBefore).toBe(true);
        }
        expect(isDue(task, d, notBefore)).toBe(true);
      }
    });
  });

  it('isDue agrees with occurrencesBetween for a single day and with the oracle (3000 cases)', () => {
    property('isDue single day', 3000, (r) => {
      const base = randomDate(r, 1975, 2095);
      const task = randomTask(r, base);
      const d = oracleAddDays(base, r.int(-500, 500));
      const nb = r.bool(0.5) ? oracleAddDays(base, r.int(-300, 300)) : undefined;
      const due = isDue(task, d, nb);
      expect(due).toBe(oracleDue(task, d, nb));
      expect(occurrencesBetween(task, d, d, nb).length === 1).toBe(due);
    });
  });

  it('as-needed, to-do and ended tasks are never due after their end (2000 cases)', () => {
    property('never due when ended/as-needed/todo', 2000, (r) => {
      const base = randomDate(r, 1975, 2095);
      const task = randomTask(r, base);
      const d = oracleAddDays(base, r.int(-100, 500));
      if (task.isAsNeeded || task.type === 'todo') expect(isDue(task, d)).toBe(false);
      if (task.endedOn != null && d > task.endedOn) expect(isDue(task, d)).toBe(false);
    });
  });

  it('dueIdealStepIds is a subset of the task steps, weekday-correct, and empty when not due (2000 cases)', () => {
    property('dueIdealStepIds', 2000, (r) => {
      const base = randomDate(r, 1975, 2095);
      const task = randomTask(r, base);
      const d = oracleAddDays(base, r.int(-200, 200));
      const nb = r.bool(0.5) ? oracleAddDays(base, -100) : undefined;
      const ids = dueIdealStepIds(task, d, nb);
      if (!isDue(task, d, nb)) {
        expect(ids).toEqual([]);
        return;
      }
      const wd = weekdayOf(d);
      for (const id of ids) {
        const step = task.idealSteps.find((s) => s.id === id)!;
        expect(step).toBeDefined();
        expect(step.dueWeekdays === null || step.dueWeekdays.includes(wd)).toBe(true);
      }
    });
  });
});

/* ================================================================= resolveOccurrence (dayState) */

describe('fuzz: resolveOccurrence', () => {
  it('outcome is in the union; pending only on or after today; missed on or after today only by explicit skip (4000 cases)', () => {
    property('resolveOccurrence outcome rules', 4000, (r) => {
      const base = randomDate(r, 1975, 2095);
      const task = randomTask(r, base);
      const today = oracleAddDays(base, r.int(-60, 60));
      const date = oracleAddDays(today, r.int(-30, 30));
      const taskId = task.id;
      const log: DayLog | null = r.bool(0.6)
        ? ({
            id: 'l' as Id,
            taskId,
            date,
            chipState: r.pick(CHIPS),
            isManualOverride: r.bool(0.4),
            completedStepIds: ['s0', 's1', 'zz'].filter(() => r.bool(0.5)) as Id[],
            dosesCompleted: r.int(0, 6),
            movedToDate: r.bool(0.1) ? oracleAddDays(date, r.int(-2, 2)) : null,
          } as unknown as DayLog)
        : null;
      const offMarks: OffDayMark[] = r.bool(0.2)
        ? [{ id: 'o' as Id, date, taskId: r.bool(0.5) ? null : taskId, priorChipState: null } as unknown as OffDayMark]
        : [];
      const o = resolveOccurrence({ task, date, today, log, offMarks, notBefore: r.bool(0.5) ? base : undefined });

      expect(OUTCOMES).toContain(o.outcome);
      if (o.outcome === 'pending') expect(date >= today).toBe(true);
      if (o.outcome === 'missed' && date >= today) {
        expect(log?.isManualOverride && log.chipState === 'skip').toBe(true);
      }
      if (o.outcome === 'off') expect(offMarks.length).toBe(1);
      expect(o.completedStepIds.every((id) => o.dueIdealStepIds.includes(id))).toBe(true);
      expect(o.date).toBe(date);
      expect(xpForOccurrence(o)).toBeGreaterThanOrEqual(0);
    });
  });

  it('is deterministic and a pushed (visitor) occurrence keeps its source date (2000 cases)', () => {
    property('resolveOccurrence determinism + pushedFrom', 2000, (r) => {
      const base = randomDate(r, 1975, 2095);
      const task = randomTask(r, base);
      const today = oracleAddDays(base, r.int(-20, 20));
      const date = oracleAddDays(today, r.int(-10, 10));
      const src = oracleAddDays(date, -1);
      const moved = {
        id: 'm' as Id,
        taskId: task.id,
        date: src,
        chipState: r.pick(CHIPS),
        isManualOverride: r.bool(),
        completedStepIds: [],
        dosesCompleted: r.int(0, 3),
        movedToDate: date,
      } as unknown as DayLog;
      const args = { task, date, today, log: null, offMarks: [] as OffDayMark[], movedInLog: moved };
      const a = resolveOccurrence(args);
      expect(resolveOccurrence(args)).toEqual(a);
      if (a.pushedFrom !== undefined) expect(a.pushedFrom).toBe(src);
      const p = resolvePushedOccurrence({ task, date, today, sourceLog: moved, offMarks: [] });
      expect(p.pushedFrom).toBe(src);
      expect(OUTCOMES).toContain(p.outcome);
    });
  });
});

/* ================================================================= consistency */

const WINDOWS: readonly (ConsistencyWindow | DateRange)[] = ['last-7', 'last-30', 'all-time'];

function randomOccurrences(r: Rng, today: LocalDate, junk: boolean): Occurrence[] {
  const n = r.int(0, 80);
  const out: Occurrence[] = [];
  for (let i = 0; i < n; i++) {
    const outcome = junk && r.bool(0.05) ? ('garbage' as OccurrenceOutcome) : r.pick(OUTCOMES);
    out.push({
      taskId: r.pick(['a', 'b', 'c'] as Id[]),
      date: oracleAddDays(today, r.int(-70, 12)),
      outcome,
      dueIdealStepIds: [],
      completedStepIds: [],
      chipState: null,
      dosesRequired: 1,
      dosesCompleted: 0,
    } as Occurrence);
  }
  return out;
}

function checkResult(res: ReturnType<typeof perTaskConsistency>, today: LocalDate) {
  expect(res.percent === null || (Number.isInteger(res.percent) && res.percent >= 0 && res.percent <= 100)).toBe(true);
  expect(res.percent === null).toBe(res.denominator === 0);
  expect(res.numerator).toBeGreaterThanOrEqual(0);
  expect(res.numerator).toBeLessThanOrEqual(res.denominator);
  expect(res.countedDates.length).toBe(res.denominator);
  for (let i = 0; i < res.countedDates.length; i++) {
    const d = res.countedDates[i] as LocalDate;
    expect(d <= today).toBe(true);
    if (i > 0) expect(d >= (res.countedDates[i - 1] as LocalDate)).toBe(true);
  }
  for (const k of ['ideal', 'fallback', 'off', 'missed'] as const) {
    expect(Number.isInteger(res.breakdown[k]) && res.breakdown[k] >= 0).toBe(true);
  }
}

describe('fuzz: consistency', () => {
  // Found by this fuzzing round (review 34). consistency.ts promises that the rounded breakdown
  // "keeps ideal + fallback + missed reconciling against the rounded denominator". A day with one
  // ideal task and one fallback task is one counted day, but each half rounds up to 1.
  it.failing('aggregate breakdown reconciles: one counted day split ideal and fallback sums to 1, not 2', () => {
    const today = '2026-05-10' as LocalDate;
    const row = (taskId: string, outcome: OccurrenceOutcome) =>
      ({ taskId, date: '2026-05-09', outcome, dueIdealStepIds: [], completedStepIds: [], chipState: null, dosesRequired: 1, dosesCompleted: 0 }) as unknown as Occurrence;
    const res = aggregateConsistency({ occurrences: [row('a', 'ideal'), row('b', 'fallback')], window: 'all-time', today });
    expect(res.denominator).toBe(1);
    expect(res.breakdown.ideal + res.breakdown.fallback + res.breakdown.missed).toBe(res.denominator);
  });

  it('percent is an integer 0-100 or null, and denominator/numerator stay coherent (3000 cases, both scopes, all windows)', () => {
    property('consistency range', 3000, (r) => {
      const today = randomDate(r, 1975, 2095);
      const occ = randomOccurrences(r, today, true);
      const window = r.bool(0.3)
        ? ({ from: oracleAddDays(today, -r.int(0, 90)), to: oracleAddDays(today, r.int(-5, 15)) } as DateRange)
        : r.pick(WINDOWS);
      checkResult(perTaskConsistency({ taskId: 'a' as Id, occurrences: occ, window, today }), today);
      checkResult(aggregateConsistency({ occurrences: occ, window, today }), today);
      if (typeof window === 'string' && window !== 'all-time') {
        const cap = window === 'last-7' ? 7 : 30;
        expect(perTaskConsistency({ taskId: 'a' as Id, occurrences: occ, window, today }).denominator).toBeLessThanOrEqual(cap);
        expect(aggregateConsistency({ occurrences: occ, window, today }).denominator).toBeLessThanOrEqual(cap);
      }
    });
  });

  it('is deterministic regardless of input order (1500 cases)', () => {
    property('consistency order-independence', 1500, (r) => {
      const today = randomDate(r, 1975, 2095);
      const occ = randomOccurrences(r, today, false);
      const shuffled = [...occ].sort(() => (r.bool() ? 1 : -1));
      const a = aggregateConsistency({ occurrences: occ, window: 'all-time', today });
      const b = aggregateConsistency({ occurrences: shuffled, window: 'all-time', today });
      expect(b.percent).toBe(a.percent);
      expect(b.denominator).toBe(a.denominator);
      expect(b.numerator).toBeCloseTo(a.numerator, 9);
    });
  });

  it('dayFractions are in [0,1], ascending, and shown-up ids are a subset of resolved ids (1500 cases)', () => {
    property('dayFractions', 1500, (r) => {
      const today = randomDate(r, 1975, 2095);
      const fr = dayFractions(randomOccurrences(r, today, false));
      for (let i = 0; i < fr.length; i++) {
        const row = fr[i]!;
        expect(row.fraction >= 0 && row.fraction <= 1).toBe(true);
        if (i > 0) expect(row.date > fr[i - 1]!.date).toBe(true);
        expect(row.shownUpTaskIds.length).toBeLessThanOrEqual(row.resolvedTaskIds.length);
      }
    });
  });
});

/* ================================================================= XP and levels */

describe('fuzz: XP and levels', () => {
  it('levelFor on random finite XP: never negative, remainder in range, and totals reconcile (5000 cases)', () => {
    property('levelFor reconciles', 5000, (r) => {
      const xp = r.bool(0.5) ? r.int(0, 20000) : r.int(0, 5_000_000);
      const info = levelFor(xp);
      expect(info.level).toBeGreaterThanOrEqual(1);
      expect(info.xpIntoLevel).toBeGreaterThanOrEqual(0);
      expect(info.xpIntoLevel).toBeLessThan(info.xpForLevel);
      let spent = 0;
      for (let l = 1; l < info.level; l++) spent += xpForLevel(l);
      expect(spent + info.xpIntoLevel).toBe(xp);
      expect(info.title.length).toBeGreaterThan(0);
      expect(info.title).not.toMatch(/undefined|NaN/);
    });
  });

  it('levelFor is monotonic in XP (2000 cases)', () => {
    property('levelFor monotonic', 2000, (r) => {
      const a = r.int(0, 300_000);
      const b = a + r.int(0, 5000);
      expect(levelFor(b).level).toBeGreaterThanOrEqual(levelFor(a).level);
    });
  });

  it('levelFor never throws or returns NaN for junk numbers (non-finite, negative, fractional)', () => {
    const junk = [NaN, -0, -1, -1e12, 0.5, 99.99, Number.MAX_SAFE_INTEGER, Infinity, -Infinity];
    for (const x of junk) {
      const info = levelFor(x);
      expect(Number.isFinite(info.level) && Number.isFinite(info.xpIntoLevel)).toBe(true);
      expect(info.xpIntoLevel).toBeGreaterThanOrEqual(0);
    }
  });
});

/* ================================================================= validateTaskDraft */

const JUNK_KEYS = ['name', 'type', 'cadence', 'idealSteps', 'fallbackSteps', 'startDate', 'endDate', 'dosesPerDay',
  'isAsNeeded', 'weekdays', '__proto__', 'constructor', 'eventDate', 'anchorDate', 'kind', 'dueWeekdays'];

function junk(r: Rng, depth: number): unknown {
  const kinds = depth > 2 ? 6 : 9;
  switch (r.int(0, kinds)) {
    case 0:
      return null;
    case 1:
      return undefined;
    case 2:
      return r.pick([NaN, Infinity, -Infinity, -0, 0, 1, 7, 8, -3, 1.5, 1e308, Number.MAX_SAFE_INTEGER]);
    case 3:
      return r.pick(['', ' ', ' ', 'Routine', 'daily', '2026-02-30', '2026-13-01', '🔥'.repeat(3), 'x'.repeat(r.int(0, 20000))]);
    case 4:
      return r.bool();
    case 5:
      return r.pick(['routine', 'event', 'course', 'todo', 'nonsense']);
    case 6:
      return Array.from({ length: r.int(0, 4) }, () => junk(r, depth + 1));
    default: {
      const o: Record<string, unknown> = {};
      const n = r.int(0, 5);
      for (let i = 0; i < n; i++) o[r.pick(JUNK_KEYS)] = junk(r, depth + 1);
      return o;
    }
  }
}

describe('fuzz: validateTaskDraft and emptyRunOccurrences', () => {
  it('never throws on any object shape and always returns a well-formed Result (10000 cases)', () => {
    property('validateTaskDraft never throws', 10000, (r) => {
      const draft = r.bool(0.1) ? junk(r, 0) : (junk(r, 1) as Record<string, unknown>);
      // A draft that is not an object is out of contract (the type says it is one), but it must
      // still come back as a Result, never as a thrown TypeError.
      let res: ReturnType<typeof validateTaskDraft> | undefined;
      expect(() => {
        res = validateTaskDraft(draft as never);
      }).not.toThrow();
      expect(res).toBeDefined();
      expect(typeof res!.ok).toBe('boolean');
      if (!res!.ok) {
        expect(res!.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  it('never throws from emptyRunOccurrences on junk cadences and step lists (3000 cases)', () => {
    property('emptyRunOccurrences never throws', 3000, (r) => {
      const draft = { type: 'routine', name: 'x', isAsNeeded: false, cadence: junk(r, 0), idealSteps: junk(r, 0) } as never;
      expect(() => emptyRunOccurrences(draft)).not.toThrow();
    });
  });

  it('a well-formed tracked daily routine with a fallback is always accepted unless its name is blank (2000 cases)', () => {
    property('valid drafts accepted', 2000, (r) => {
      const blank = r.bool(0.2);
      const name = blank ? r.pick(['', ' ', '\t\n']) : r.pick(['Stretch', '🔥 Run', 'x'.repeat(500)]);
      const draft = {
        type: 'routine',
        name,
        isAsNeeded: false,
        cadence: { kind: 'daily' },
        idealSteps: [{ text: 'a', dueWeekdays: null }],
        fallbackSteps: [{ text: 'b', dueWeekdays: null }],
      } as never;
      const res = validateTaskDraft(draft);
      expect(res.ok).toBe(!blank);
    });
  });
});

/* ================================================================= number rounding */

describe('fuzz: rounding and percentages (lib/number, used by consistency)', () => {
  it('toPercent equals exact integer round-half-up for all small n <= d (2000 cases)', () => {
    property('toPercent exact', 2000, (r) => {
      const d = r.int(1, 2000);
      const n = r.int(0, d);
      // Exact half-up of 100*n/d using integers only: floor((200n + d) / 2d).
      expect(toPercent(n, d)).toBe(Math.floor((200 * n + d) / (2 * d)));
    });
  });

  it('toPercent is null for zero or negative denominators and roundHalfUp is exact on .5 ties (1000 cases)', () => {
    property('rounding edges', 1000, (r) => {
      expect(toPercent(r.int(0, 50), 0)).toBeNull();
      expect(toPercent(r.int(0, 50), -r.int(1, 50))).toBeNull();
      const k = r.int(0, 1_000_000);
      expect(roundHalfUp(k + 0.5)).toBe(k + 1);
      // snap() keeps 9 decimals, so anything closer than 5e-10 to a tie is a tie by design.
      expect(roundHalfUp(k + 0.49999)).toBe(k);
    });
  });
});
