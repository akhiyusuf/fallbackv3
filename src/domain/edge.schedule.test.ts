/**
 * Edge-case campaign (2026-11-20), area 16: WHEN things are due.
 * Scheduling and date math: cadence kinds, creation-day boundary, events, courses, to-dos,
 * ended tasks, leap years, rollovers, DST weeks, per-step weekdays, long ranges, labels.
 */
import { addDays as libAddDays, addMonths as libAddMonths, addYears as libAddYears, diffDays, eachDay, endOfMonth as libEndOfMonth, endOfWeek as libEndOfWeek, parseLocalDate, startOfWeek as libStartOfWeek, toLocalDate, weekdayOf as libWeekdayOf } from '@/lib/date';
import { cadenceSummary } from '@/features/task/cadenceLabel';
import type { Cadence, Instant, LocalDate, TaskWithSteps, Weekday } from '@/types';
import { validateTaskDraft } from './validation';
import { dueIdealStepIds, isDue, occurrencesBetween } from './occurrence';
import * as dm from './dateMath';
import { addDays as dfAddDays, getISODay, addMonths as dfAddMonths, endOfMonth as dfEndOfMonth } from 'date-fns';

const d = (s: string) => s as LocalDate;

// Node built-ins: @types/node is not part of this project's typings.
declare function require(id: string): any;
declare const __dirname: string;
const { execFileSync } = require('child_process') as { execFileSync: (file: string, args: string[], opts: object) => string };
const path = require('path') as { join: (...p: string[]) => string; resolve: (...p: string[]) => string };

const ROOT = path.resolve(__dirname, '../..');

/**
 * Jest sandboxes `process.env`, so a TZ assigned inside a test never reaches the real Date
 * implementation. The zone-dependent probes therefore run in a child Node process with TZ set,
 * transpiling `src/` with the repo's `typescript` and resolving `@/` to `src/`. Only the real
 * `@/lib/date`, `@/domain/occurrence` and `@/features/task/cadenceLabel` code runs.
 */
function probeInZone(tz: string): Record<string, any> {
  const script = `
    const path = require('path'); const fs = require('fs'); const Module = require('module');
    const ts = require(${JSON.stringify(path.join(ROOT, 'node_modules', 'typescript'))});
    const ROOT = ${JSON.stringify(ROOT)};
    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function (req, ...rest) {
      if (req.startsWith('@/')) req = path.join(ROOT, 'src', req.slice(2));
      return origResolve.call(this, req, ...rest);
    };
    require.extensions['.ts'] = (m, f) => {
      const out = ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
      m._compile(out.outputText, f);
    };
    const { toLocalDate, addDays, diffDays, eachDay, weekdayOf, startOfWeek, parseLocalDate } = require('@/lib/date');
    const { occurrencesBetween } = require('@/domain/occurrence');
    const daily = { type: 'routine', isAsNeeded: false, cadence: { kind: 'daily' }, eventDate: null, startDate: null, endDate: null, endedOn: null };
    const out = {};
    out.nyNight = toLocalDate(new Date('2026-11-21T04:30:00Z'));
    out.aucklandCreated = toLocalDate(new Date('2026-11-19T11:30:00Z'));
    out.aucklandDue = occurrencesBetween(daily, '2026-11-19', '2026-11-20', '2026-11-20');
    out.nyFallEach = eachDay('2026-10-31', '2026-11-02');
    out.nyFallDiff = diffDays('2026-11-02', '2026-10-31');
    out.nyFallDaily = occurrencesBetween(daily, '2026-10-31', '2026-11-02');
    out.santiagoEach = eachDay('2024-09-04', '2024-09-12');
    out.santiagoAdd = [addDays('2024-09-07', 1), addDays('2024-09-08', 1)];
    out.santiagoDiff = [diffDays('2024-09-08', '2024-09-01'), diffDays('2024-09-09', '2024-09-08')];
    out.santiagoToLocal = toLocalDate(new Date(2024, 8, 8, 12, 0));
    out.santiagoParseDate = parseLocalDate('2024-09-08').getDate();
    out.santiagoWeekday = weekdayOf('2024-09-08');
    out.santiagoStartOfWeek = [startOfWeek('2024-09-08'), startOfWeek('2024-09-09')];
    out.santiagoDaily = occurrencesBetween(daily, '2024-09-06', '2024-09-10');
    out.santiagoAprilEach = eachDay('2024-04-05', '2024-04-09');
    out.santiagoAprilDiff = diffDays('2024-04-09', '2024-04-05');
    out.santiagoAprilAdd = addDays('2024-04-06', 1);
    console.log(JSON.stringify(out));
  `;
  const stdout = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8', timeout: 60000 });
  return JSON.parse(stdout.trim().split('\n').pop() as string);
}

function makeTask(overrides: Partial<TaskWithSteps>): TaskWithSteps {
  return {
    id: 't1' as TaskWithSteps['id'],
    type: 'routine',
    name: 'Edge',
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
    createdAt: '2024-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    endedOn: null,
    idealSteps: [],
    fallbackSteps: [],
    ...overrides,
  };
}

const withCadence = (cadence: Cadence | null, extra: Partial<TaskWithSteps> = {}) => makeTask({ cadence, ...extra });

describe('cadence kinds across month and year boundaries', () => {
  test('daily crosses Dec 31 to Jan 1 and Feb 28 to Feb 29 with no gap', () => {
    const t = withCadence({ kind: 'daily' });
    expect(occurrencesBetween(t, d('2024-12-30'), d('2025-01-02'))).toEqual(['2024-12-30', '2024-12-31', '2025-01-01', '2025-01-02']);
    expect(occurrencesBetween(t, d('2024-02-27'), d('2024-03-01'))).toEqual(['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01']);
  });

  test('a Sunday-only rhythm crosses the year end correctly', () => {
    const t = withCadence({ kind: 'specific-weekdays', weekdays: [7] });
    expect(occurrencesBetween(t, d('2024-12-28'), d('2025-01-06'))).toEqual(['2024-12-29', '2025-01-05']);
  });

  test('bi-weekly whose weekday differs from the anchor weekday alternates on that weekday', () => {
    // Anchor Wed 2024-06-05; cadence is Mondays every other week, first Monday 2024-06-10.
    const t = withCadence({ kind: 'bi-weekly', weekday: 1, anchorDate: d('2024-06-05') });
    expect(occurrencesBetween(t, d('2024-06-01'), d('2024-07-08'))).toEqual(['2024-06-10', '2024-06-24', '2024-07-08']);
  });

  test('bi-weekly keeps its parity across the year end', () => {
    // Wed 2024-12-25, then every 14 days: 2025-01-08, 2025-01-22.
    const t = withCadence({ kind: 'bi-weekly', weekday: 3, anchorDate: d('2024-12-25') });
    expect(occurrencesBetween(t, d('2024-12-20'), d('2025-01-25'))).toEqual(['2024-12-25', '2025-01-08', '2025-01-22']);
  });

  test('monthly on the 31st is due exactly once in every month of 2025, short months on their last day', () => {
    const t = withCadence({ kind: 'monthly', dayOfMonth: 31, anchorDate: d('2024-01-31') });
    expect(occurrencesBetween(t, d('2025-01-01'), d('2025-12-31'))).toEqual([
      '2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-31', '2025-06-30',
      '2025-07-31', '2025-08-31', '2025-09-30', '2025-10-31', '2025-11-30', '2025-12-31',
    ]);
  });

  test('monthly on the 30th lands on Feb 29 in a leap year and Feb 28 otherwise', () => {
    const t = withCadence({ kind: 'monthly', dayOfMonth: 30, anchorDate: d('2024-01-30') });
    expect(occurrencesBetween(t, d('2024-02-01'), d('2024-02-29'))).toEqual(['2024-02-29']);
    expect(occurrencesBetween(t, d('2025-02-01'), d('2025-02-28'))).toEqual(['2025-02-28']);
  });

  test('monthly on the 29th: Feb 2028 (leap) is due on the 29th, not the 28th', () => {
    const t = withCadence({ kind: 'monthly', dayOfMonth: 29, anchorDate: d('2027-01-29') });
    expect(isDue(t, d('2028-02-28'))).toBe(false);
    expect(isDue(t, d('2028-02-29'))).toBe(true);
    expect(isDue(t, d('2027-02-28'))).toBe(true); // non-leap: lands on the last day
  });

  test('monthly anchored after a given day-of-month does not fire before its anchor', () => {
    const t = withCadence({ kind: 'monthly', dayOfMonth: 15, anchorDate: d('2024-03-15') });
    expect(isDue(t, d('2024-02-15'))).toBe(false);
    expect(isDue(t, d('2024-03-15'))).toBe(true);
  });

  test('bi-monthly keeps parity across the year end (Nov, Jan, Mar)', () => {
    const t = withCadence({ kind: 'bi-monthly', dayOfMonth: 10, anchorDate: d('2024-11-10') });
    expect(occurrencesBetween(t, d('2024-11-01'), d('2025-03-31'))).toEqual(['2024-11-10', '2025-01-10', '2025-03-10']);
  });

  test('bi-monthly parity holds across many years (12 months is an even step)', () => {
    const t = withCadence({ kind: 'bi-monthly', dayOfMonth: 10, anchorDate: d('2024-11-10') });
    expect(isDue(t, d('2025-11-10'))).toBe(true);
    expect(isDue(t, d('2026-11-10'))).toBe(true);
    expect(isDue(t, d('2026-01-10'))).toBe(true);
    expect(isDue(t, d('2026-02-10'))).toBe(false);
  });

  test('bi-monthly on the 31st clamps short months and keeps its parity', () => {
    const t = withCadence({ kind: 'bi-monthly', dayOfMonth: 31, anchorDate: d('2024-01-31') });
    expect(occurrencesBetween(t, d('2024-01-01'), d('2024-05-31'))).toEqual(['2024-01-31', '2024-03-31', '2024-05-31']);
  });

  test('yearly Feb 29 across the 2100 century rule (2100 is not a leap year)', () => {
    const t = withCadence({ kind: 'yearly', month: 2, dayOfMonth: 29, anchorDate: d('2096-02-29') });
    expect(isDue(t, d('2096-02-29'))).toBe(true);
    expect(isDue(t, d('2100-02-28'))).toBe(true);
    expect(isDue(t, d('2104-02-29'))).toBe(true);
    expect(isDue(t, d('2104-02-28'))).toBe(false);
  });

  test('yearly Feb 29 on a 400-year leap (2000) behaves like any leap year', () => {
    const t = withCadence({ kind: 'yearly', month: 2, dayOfMonth: 29, anchorDate: d('2000-02-29') });
    expect(occurrencesBetween(t, d('2000-02-01'), d('2004-03-01'))).toEqual(['2000-02-29', '2001-02-28', '2002-02-28', '2003-02-28', '2004-02-29']);
  });

  test('yearly anchored later in the year does not fire earlier in its anchor year', () => {
    const t = withCadence({ kind: 'yearly', month: 6, dayOfMonth: 25, anchorDate: d('2024-12-25') });
    expect(isDue(t, d('2024-06-25'))).toBe(false);
    expect(isDue(t, d('2025-06-25'))).toBe(true);
  });

  test('as-needed routine is never due, even with a creation bound and a cadence-shaped field', () => {
    const t = withCadence({ kind: 'daily' }, { isAsNeeded: true });
    expect(occurrencesBetween(t, d('2024-01-01'), d('2025-12-31'), d('2024-01-01'))).toEqual([]);
  });
});

describe('creation-day boundary (device-local notBefore)', () => {
  test('a routine created late at night is due today and never a missed yesterday', () => {
    const createdLocal = toLocalDate(new Date(2026, 10, 20, 23, 59));
    expect(createdLocal).toBe('2026-11-20');
    const t = withCadence({ kind: 'daily' });
    expect(isDue(t, d('2026-11-20'), createdLocal)).toBe(true);
    expect(isDue(t, d('2026-11-19'), createdLocal)).toBe(false);
    expect(occurrencesBetween(t, d('2026-11-18'), d('2026-11-22'), createdLocal)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
  });

  test('a monthly-on-the-15th routine created on the 16th does not invent a January 15 miss', () => {
    const t = withCadence({ kind: 'monthly', dayOfMonth: 15, anchorDate: d('2025-01-15') });
    expect(occurrencesBetween(t, d('2026-01-01'), d('2026-02-28'), d('2026-01-16'))).toEqual(['2026-02-15']);
  });

  test('a created-today bound does not hide today for a weekly routine due today', () => {
    const t = withCadence({ kind: 'weekly', weekday: 5, anchorDate: d('2026-11-01') }); // Friday 2026-11-20
    expect(libWeekdayOf(d('2026-11-20'))).toBe(5);
    expect(isDue(t, d('2026-11-20'), d('2026-11-20'))).toBe(true);
  });

  test('an event backdated before its creation keeps its own date (not a fabricated miss)', () => {
    const t = makeTask({ type: 'event', cadence: null, eventDate: d('2026-11-01') });
    expect(isDue(t, d('2026-11-01'), d('2026-11-20'))).toBe(true);
  });
});

describe('timezone-dependent creation date (toLocalDate of createdAt, real zones)', () => {
  test('west of UTC: created 23:30 local (04:30Z the next day) is still the local creation day', () => {
    expect(probeInZone('America/New_York').nyNight).toBe('2026-11-20');
  });

  test('east of UTC: created 00:30 local on the 20th (11:30Z the 19th) is the 20th, so the 19th is not a fake miss', () => {
    const p = probeInZone('Pacific/Auckland');
    expect(p.aucklandCreated).toBe('2026-11-20');
    expect(p.aucklandDue).toEqual(['2026-11-20']);
  });

  test('the US fall-back day (25-hour day) yields one occurrence per calendar day', () => {
    const p = probeInZone('America/New_York');
    expect(p.nyFallEach).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(p.nyFallDiff).toBe(2);
    expect(p.nyFallDaily).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('events, courses and to-dos', () => {
  test('a one-off event on the leap day 2024-02-29 is due only that day', () => {
    const t = makeTask({ type: 'event', cadence: null, eventDate: d('2024-02-29') });
    expect(occurrencesBetween(t, d('2024-02-01'), d('2024-03-31'))).toEqual(['2024-02-29']);
  });

  test('a repeating event (no eventDate) follows its cadence and honours the creation bound', () => {
    const t = makeTask({ type: 'event', eventDate: null, cadence: { kind: 'weekly', weekday: 3, anchorDate: d('2026-11-01') } });
    expect(occurrencesBetween(t, d('2026-11-01'), d('2026-11-30'), d('2026-11-10'))).toEqual(['2026-11-11', '2026-11-18', '2026-11-25']);
  });

  test('a course with end date before start date is never due and does not loop (domain guard)', () => {
    const t = makeTask({ type: 'course', cadence: { kind: 'daily' }, startDate: d('2024-06-10'), endDate: d('2024-06-01') });
    expect(occurrencesBetween(t, d('2024-05-25'), d('2024-06-15'))).toEqual([]);
  });

  test('a single-day course (start equals end) is due once', () => {
    const t = makeTask({ type: 'course', cadence: { kind: 'daily' }, startDate: d('2024-06-10'), endDate: d('2024-06-10') });
    expect(occurrencesBetween(t, d('2024-06-09'), d('2024-06-11'))).toEqual(['2024-06-10']);
  });

  test('a course with an endedOn before its end date stops on endedOn (inclusive)', () => {
    const t = makeTask({ type: 'course', cadence: { kind: 'daily' }, startDate: d('2024-06-05'), endDate: d('2024-06-10'), endedOn: d('2024-06-07') });
    expect(occurrencesBetween(t, d('2024-06-05'), d('2024-06-10'))).toEqual(['2024-06-05', '2024-06-06', '2024-06-07']);
  });

  test('a course with no cadence is never due (defensive)', () => {
    const t = makeTask({ type: 'course', cadence: null, startDate: d('2024-06-05'), endDate: d('2024-06-10') });
    expect(occurrencesBetween(t, d('2024-06-05'), d('2024-06-10'))).toEqual([]);
  });

  test('a to-do is never due even if a cadence is present, and a Note is never due', () => {
    expect(occurrencesBetween(makeTask({ type: 'todo', cadence: { kind: 'daily' } }), d('2024-06-01'), d('2024-06-03'))).toEqual([]);
    expect(occurrencesBetween(makeTask({ type: 'todo', isNote: true, cadence: null }), d('2024-06-01'), d('2024-06-03'))).toEqual([]);
  });

  test('validateTaskDraft rejects a course whose end date is before its start date', () => {
    // The Add Course screen also guards it; the domain rule backs it up for every other path (assistant, edits).
    const draft = {
      type: 'course' as const,
      name: 'Course',
      cadence: { kind: 'daily' as const },
      startDate: d('2024-06-10'),
      endDate: d('2024-06-01'),
      idealSteps: [{ text: 'Take it', dueWeekdays: null }],
      fallbackSteps: [{ text: 'Skip', dueWeekdays: null }],
    };
    expect(validateTaskDraft(draft).ok).toBe(false);
  });
});

describe('ended tasks (endedOn is the last day it is due)', () => {
  test('due on endedOn, not on the day after', () => {
    const t = withCadence({ kind: 'daily' }, { endedOn: d('2026-11-20') });
    expect(isDue(t, d('2026-11-20'))).toBe(true);
    expect(isDue(t, d('2026-11-21'))).toBe(false);
    expect(occurrencesBetween(t, d('2026-11-18'), d('2026-11-30'))).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
  });

  test('a repeating event ended on a day is due on nothing after it', () => {
    const t = makeTask({ type: 'event', eventDate: null, cadence: { kind: 'daily' }, endedOn: d('2024-02-28') });
    expect(isDue(t, d('2024-02-28'))).toBe(true);
    expect(isDue(t, d('2024-02-29'))).toBe(false);
    expect(isDue(t, d('2024-03-01'))).toBe(false);
  });

  test('endedOn before the creation bound leaves nothing due', () => {
    const t = withCadence({ kind: 'daily' }, { endedOn: d('2026-11-01') });
    expect(occurrencesBetween(t, d('2026-11-01'), d('2026-11-30'), d('2026-11-10'))).toEqual([]);
  });
});

describe('leap years and month/year arithmetic (lib/date and dateMath agree)', () => {
  test('Jan 31 plus one month clamps to the last day of February in leap and common years', () => {
    expect(libAddMonths(d('2024-01-31'), 1)).toBe('2024-02-29');
    expect(libAddMonths(d('2025-01-31'), 1)).toBe('2025-02-28');
    expect(dm.addMonths(d('2024-01-31'), 1)).toBe('2024-02-29');
    expect(dm.addMonths(d('2025-01-31'), 1)).toBe('2025-02-28');
  });

  test('Feb 29 plus years clamps to Feb 28 on a common year and returns on the next leap year', () => {
    expect(libAddYears(d('2024-02-29'), 1)).toBe('2025-02-28');
    expect(libAddYears(d('2024-02-29'), 4)).toBe('2028-02-29');
    expect(libAddYears(d('2028-02-29'), 1)).toBe('2029-02-28');
    expect(dm.addYears(d('2024-02-29'), 1)).toBe('2025-02-28');
    expect(dm.addYears(d('2024-02-29'), 4)).toBe('2028-02-29');
  });

  test('day steps across the leap day and the year end', () => {
    expect(libAddDays(d('2024-02-28'), 1)).toBe('2024-02-29');
    expect(libAddDays(d('2024-02-29'), 1)).toBe('2024-03-01');
    expect(libAddDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(libAddDays(d('2027-01-01'), -1)).toBe('2026-12-31');
    expect(dm.addDays(d('2024-02-28'), 1)).toBe('2024-02-29');
    expect(dm.addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
  });

  test('day differences across the leap day are exact', () => {
    expect(diffDays(d('2024-03-01'), d('2024-02-28'))).toBe(2);
    expect(diffDays(d('2025-03-01'), d('2024-02-28'))).toBe(367);
    expect(dm.daysBetween(d('2024-02-28'), d('2024-03-01'))).toBe(2);
    expect(dm.daysBetween(d('2024-01-01'), d('2025-01-01'))).toBe(366);
  });

  test('month and week ends on leap and century boundaries', () => {
    expect(libEndOfMonth(d('2024-02-10'))).toBe('2024-02-29');
    expect(libEndOfMonth(d('2100-02-10'))).toBe('2100-02-28');
    expect(dm.endOfMonth(d('2100-02-10'))).toBe('2100-02-28');
    expect(libStartOfWeek(d('2024-02-29'))).toBe('2024-02-26');
    expect(libEndOfWeek(d('2024-02-29'))).toBe('2024-03-03');
  });

  test('known weekdays for leap days', () => {
    expect(libWeekdayOf(d('2024-02-29'))).toBe(4);
    expect(libWeekdayOf(d('2028-02-29'))).toBe(2);
  });

  test('dateMath and lib/date agree with date-fns across 1999 to 2101 (every day)', () => {
    let cur = d('1999-12-31');
    let checked = 0;
    while (cur <= d('2101-01-01')) {
      const asDate = parseLocalDate(cur);
      expect(dm.weekdayOf(cur)).toBe(getISODay(asDate));
      expect(libWeekdayOf(cur)).toBe(getISODay(asDate));
      checked++;
      cur = dm.addDays(cur, 1);
    }
    expect(checked).toBeGreaterThan(36000);
    // Month steps from the 29th/30th/31st across the whole span, clamped as date-fns clamps.
    for (const day of ['2024-01-29', '2024-01-30', '2024-01-31', '2025-08-31', '2100-01-31']) {
      for (let n = 0; n <= 24; n++) {
        const expected = toLocalDate(dfAddMonths(parseLocalDate(d(day)), n));
        expect(dm.addMonths(d(day), n)).toBe(expected);
      }
    }
    expect(toLocalDate(dfEndOfMonth(parseLocalDate(d('2100-02-01'))))).toBe('2100-02-28');
    expect(toLocalDate(dfAddDays(parseLocalDate(d('2100-02-28')), 1))).toBe('2100-03-01');
  });
});

describe('DST weeks (device-local calendar math under a DST-observing zone, real Date)', () => {
  // America/Santiago: DST starts Sun 2024-09-08 at local midnight, which does not exist (00:00 -> 01:00).
  // It ends Sat 2024-04-06 at 24:00 (the clock goes 23:59:59 -> 23:00 on the 6th, repeating that hour).
  let p: Record<string, any>;
  beforeAll(() => {
    p = probeInZone('America/Santiago');
  });

  test('the DST-start week enumerates every day exactly once', () => {
    expect(p.santiagoEach).toEqual([
      '2024-09-04', '2024-09-05', '2024-09-06', '2024-09-07', '2024-09-08', '2024-09-09', '2024-09-10', '2024-09-11', '2024-09-12',
    ]);
  });

  test('day steps and differences across the missing midnight are exact', () => {
    expect(p.santiagoAdd).toEqual(['2024-09-08', '2024-09-09']);
    expect(p.santiagoDiff).toEqual([7, 1]);
  });

  test('the nonexistent midnight maps to the right calendar day, weekday and week', () => {
    expect(p.santiagoToLocal).toBe('2024-09-08');
    expect(p.santiagoParseDate).toBe(8);
    expect(p.santiagoWeekday).toBe(7);
    expect(p.santiagoStartOfWeek).toEqual(['2024-09-02', '2024-09-09']);
  });

  test('a daily routine across the DST-start week gets exactly one occurrence per day', () => {
    expect(p.santiagoDaily).toEqual(['2024-09-06', '2024-09-07', '2024-09-08', '2024-09-09', '2024-09-10']);
  });

  test('the DST-end week (April, 25-hour day) keeps day steps and differences exact', () => {
    expect(p.santiagoAprilEach).toEqual(['2024-04-05', '2024-04-06', '2024-04-07', '2024-04-08', '2024-04-09']);
    expect(p.santiagoAprilDiff).toBe(4);
    expect(p.santiagoAprilAdd).toBe('2024-04-07');
  });
});

describe('per-step dueWeekdays (F23/F24 subset rule)', () => {
  const step = (id: string, dueWeekdays: readonly Weekday[] | null) => ({ id: id as never, taskId: 't1' as never, role: 'ideal' as const, text: id, position: 0, dueWeekdays });

  test('a Wednesday-only step is due on Wed only; an always-on step is due every occurrence', () => {
    const t = withCadence({ kind: 'daily' }, { idealSteps: [step('wed', [3]), step('always', null)] });
    expect(dueIdealStepIds(t, d('2024-06-05'))).toEqual(['wed', 'always']); // Wednesday
    expect(dueIdealStepIds(t, d('2024-06-04'))).toEqual(['always']); // Tuesday
  });

  test('a step never shows on a day its parent is not due', () => {
    const t = withCadence({ kind: 'specific-weekdays', weekdays: [1, 3, 5] }, { idealSteps: [step('mon', [1])] });
    expect(dueIdealStepIds(t, d('2024-06-03'))).toEqual(['mon']); // Monday
    expect(dueIdealStepIds(t, d('2024-06-04'))).toEqual([]); // Tuesday: parent not due
  });

  test('a weekly parent: a null-weekdays step is due only on the parent day', () => {
    const t = withCadence({ kind: 'weekly', weekday: 3, anchorDate: d('2024-06-05') }, { idealSteps: [step('s', null)] });
    expect(dueIdealStepIds(t, d('2024-06-05'))).toEqual(['s']);
    expect(dueIdealStepIds(t, d('2024-06-06'))).toEqual([]);
  });

  test('an empty dueWeekdays list never shows (defensive: no crash)', () => {
    const t = withCadence({ kind: 'daily' }, { idealSteps: [step('none', [])] });
    expect(dueIdealStepIds(t, d('2024-06-05'))).toEqual([]);
  });

  test('a one-off event with a step scoped to Monday is not due on any other date', () => {
    const t = makeTask({ type: 'event', cadence: null, eventDate: d('2024-06-03'), idealSteps: [step('mon', [1])] });
    expect(dueIdealStepIds(t, d('2024-06-03'))).toEqual(['mon']);
    expect(dueIdealStepIds(t, d('2024-06-10'))).toEqual([]);
  });
});

describe('long ranges stay fast', () => {
  test('a daily routine over 30 years is resolved quickly and correctly', () => {
    const t = withCadence({ kind: 'daily' });
    const start = Date.now();
    const days = occurrencesBetween(t, d('1996-01-01'), d('2025-12-31'));
    const ms = Date.now() - start;
    expect(days.length).toBe(dm.daysBetween(d('1996-01-01'), d('2025-12-31')) + 1);
    expect(ms).toBeLessThan(5000);
  });

  test('a specific-weekdays rhythm over 30 years stays fast', () => {
    const t = withCadence({ kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] });
    const start = Date.now();
    const days = occurrencesBetween(t, d('1996-01-01'), d('2025-12-31'));
    expect(Date.now() - start).toBeLessThan(5000);
    expect(days.length).toBeGreaterThan(7000);
  });

  test('an inverted range and a range entirely before the creation bound return empty quickly', () => {
    const t = withCadence({ kind: 'daily' });
    expect(occurrencesBetween(t, d('2030-01-01'), d('2020-01-01'))).toEqual([]);
    expect(occurrencesBetween(t, d('2020-01-01'), d('2020-12-31'), d('2026-01-01'))).toEqual([]);
  });
});

describe('cadence labels read correctly (no em dashes)', () => {
  const base = (patch: Record<string, unknown>) => ({ type: 'routine' as const, cadence: null, isAsNeeded: false, eventDate: null, ...patch }) as never;

  test('one label per cadence kind', () => {
    expect(cadenceSummary(base({ cadence: { kind: 'daily' } }))).toBe('Routine · Daily');
    expect(cadenceSummary(base({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5, 6] } }))).toBe('Routine · Mon–Sat');
    expect(cadenceSummary(base({ cadence: { kind: 'weekly', weekday: 3, anchorDate: '2024-01-03' } }))).toBe('Routine · Weekly · Wed');
    expect(cadenceSummary(base({ cadence: { kind: 'bi-weekly', weekday: 7, anchorDate: '2024-01-07' } }))).toBe('Routine · Bi-weekly · Sun');
    expect(cadenceSummary(base({ cadence: { kind: 'monthly', dayOfMonth: 1, anchorDate: '2024-01-01' } }))).toBe('Routine · Monthly · 1st');
    expect(cadenceSummary(base({ cadence: { kind: 'bi-monthly', dayOfMonth: 31, anchorDate: '2024-01-31' } }))).toBe('Routine · Bi-monthly · 31st');
    expect(cadenceSummary(base({ cadence: { kind: 'yearly', month: 2, dayOfMonth: 29, anchorDate: '2024-02-29' } }))).toBe('Routine · Yearly · Feb 29');
  });

  test('ordinals for every day of the month, including the teens', () => {
    const expectOrdinal = (n: number, s: string) =>
      expect(cadenceSummary(base({ cadence: { kind: 'monthly', dayOfMonth: n, anchorDate: '2024-01-01' } }))).toBe(`Routine · Monthly · ${s}`);
    expectOrdinal(1, '1st');
    expectOrdinal(2, '2nd');
    expectOrdinal(3, '3rd');
    expectOrdinal(4, '4th');
    expectOrdinal(11, '11th');
    expectOrdinal(12, '12th');
    expectOrdinal(13, '13th');
    expectOrdinal(21, '21st');
    expectOrdinal(22, '22nd');
    expectOrdinal(23, '23rd');
    expectOrdinal(24, '24th');
    expectOrdinal(31, '31st');
  });

  test('every yearly month abbreviates correctly', () => {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    names.forEach((n, i) => {
      expect(cadenceSummary(base({ cadence: { kind: 'yearly', month: i + 1, dayOfMonth: 5, anchorDate: '2024-01-05' } }))).toBe(`Routine · Yearly · ${n} 5`);
    });
  });

  test('weekday ranges: a full week, a contiguous pair, a wrap-around pair, and a single day', () => {
    expect(cadenceSummary(base({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5, 6, 7] } }))).toBe('Routine · Mon–Sun');
    expect(cadenceSummary(base({ cadence: { kind: 'specific-weekdays', weekdays: [6, 7] } }))).toBe('Routine · Sat–Sun');
    expect(cadenceSummary(base({ cadence: { kind: 'specific-weekdays', weekdays: [7, 1] } }))).toBe('Routine · Mon/Sun');
    expect(cadenceSummary(base({ cadence: { kind: 'specific-weekdays', weekdays: [3] } }))).toBe('Routine · Wed');
  });

  test('unsorted weekdays are sorted in the label', () => {
    expect(cadenceSummary(base({ cadence: { kind: 'specific-weekdays', weekdays: [5, 1, 3] } }))).toBe('Routine · Mon/Wed/Fri');
  });

  test('duplicate weekdays do not repeat in the label', () => {
    expect(cadenceSummary(base({ cadence: { kind: 'specific-weekdays', weekdays: [1, 1, 2] } }))).toBe('Routine · Mon–Tue');
  });

  test('event, course, to-do and as-needed labels', () => {
    expect(cadenceSummary({ type: 'event', cadence: null, isAsNeeded: false, eventDate: '2024-02-29' } as never)).toBe('Event · One-time');
    expect(cadenceSummary({ type: 'event', cadence: { kind: 'daily' }, isAsNeeded: false, eventDate: null } as never)).toBe('Event · Daily');
    expect(cadenceSummary({ type: 'course', cadence: { kind: 'daily' }, isAsNeeded: false, eventDate: null } as never)).toBe('Course · Daily');
    expect(cadenceSummary({ type: 'todo', cadence: null, isAsNeeded: false, eventDate: null } as never)).toBe('To-do');
    expect(cadenceSummary({ type: 'routine', cadence: null, isAsNeeded: true, eventDate: null } as never)).toBe('Routine · As-needed');
  });

  test('no label contains an em dash', () => {
    const samples = [
      base({ cadence: { kind: 'daily' } }),
      base({ cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5, 6, 7] } }),
      base({ cadence: { kind: 'specific-weekdays', weekdays: [] } }),
      base({ cadence: { kind: 'yearly', month: 12, dayOfMonth: 25, anchorDate: '2024-12-25' } }),
      base({ isAsNeeded: true }),
    ];
    for (const s of samples) expect(cadenceSummary(s)).not.toContain('—');
  });
});

describe('typed date strings (features/task/dateValidation)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isValidLocalDateString } = require('@/features/task/dateValidation') as typeof import('@/features/task/dateValidation');

  test('accepts real calendar dates, including Feb 29 only in leap years', () => {
    expect(isValidLocalDateString('2024-02-29')).toBe(true);
    expect(isValidLocalDateString('2028-02-29')).toBe(true);
    expect(isValidLocalDateString('2025-02-29')).toBe(false);
    expect(isValidLocalDateString('2100-02-29')).toBe(false);
    expect(isValidLocalDateString('2000-02-29')).toBe(true);
  });

  test('rejects impossible days and malformed shapes', () => {
    expect(isValidLocalDateString('2026-02-30')).toBe(false);
    expect(isValidLocalDateString('2026-04-31')).toBe(false);
    expect(isValidLocalDateString('2026-13-01')).toBe(false);
    expect(isValidLocalDateString('2026-1-5')).toBe(false);
    expect(isValidLocalDateString('')).toBe(false);
  });
});
