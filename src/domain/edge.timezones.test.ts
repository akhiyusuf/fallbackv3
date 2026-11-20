/**
 * Round 2, time zones and clock changes across the stored data (review/haiku/27-timezones.md).
 *
 * Jest sandboxes `process.env`, so a TZ assigned inside a test never reaches the real Date. Every
 * zone-dependent probe runs in a CHILD Node process with TZ set (the same approach as
 * edge.schedule.test.ts). The child transpiles the real `src/` modules with the repo's TypeScript,
 * resolves `@/` to `src/`, and loads the real `src/queries/internal.ts` with the in-memory fake
 * repositories. `expo-crypto` is stubbed (the only native import on this path).
 *
 * Reading the results: `it.failing(...)` marks a REAL BUG that is outside this area's owned files
 * (src/queries/internal.ts). It passes while the bug is present and turns red once it is fixed.
 */
declare function require(id: string): any;
declare const __dirname: string;

const { execFileSync } = require('child_process') as { execFileSync: (file: string, args: string[], opts: object) => string };
const path = require('path') as { join: (...p: string[]) => string; resolve: (...p: string[]) => string };

import { DELETED_KEEP_DAYS, daysLeft, purgeCutoff } from './retention';
import { currentCycleWindow, cyclesElapsedSince } from './cycles';
import type { Instant, LocalDate } from '@/types';

const ROOT = path.resolve(__dirname, '../..');

/** Runs `body` (the body of an async function) in a child Node process with TZ set; returns its JSON. */
function runInZone<T = any>(tz: string, body: string): T {
  const prelude = `
    const path = require('path'); const fs = require('fs'); const Module = require('module');
    const ts = require(${JSON.stringify(path.join(ROOT, 'node_modules', 'typescript'))});
    const ROOT = ${JSON.stringify(ROOT)};
    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function (req, ...rest) {
      if (req.startsWith('@/')) req = path.join(ROOT, 'src', req.slice(2));
      return origResolve.call(this, req, ...rest);
    };
    const origLoad = Module._load;
    Module._load = function (req, ...rest) {
      if (req === 'expo-crypto') return { randomUUID: () => 'uuid-' + Math.random().toString(16).slice(2) };
      return origLoad.call(this, req, ...rest);
    };
    require.extensions['.ts'] = (m, f) => {
      const out = ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
      m._compile(out.outputText, f);
    };
    function mk(o) {
      return Object.assign({ id: 't1', type: 'routine', name: 'Edge', note: null, icon: 'Repeat', color: 'forge-orange',
        isAsNeeded: false, cadence: { kind: 'daily' }, eventDate: null, timeOfDay: null, startDate: null, endDate: null,
        dosesPerDay: 1, isTracked: true, importance: null, necessity: null, todoDoneAt: null, priorityRank: null,
        isNote: false, snoozable: true, createdAt: '2026-11-01T09:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z',
        deletedAt: null, endedOn: null, idealSteps: [], fallbackSteps: [] }, o);
    }
    async function log(f, task, date, chip) {
      const at = date + 'T10:00:00.000Z';
      await f.repos.logs.upsert({ id: task.id + '-' + date, taskId: task.id, date, chipState: chip, isManualOverride: true,
        completedStepIds: [], dosesCompleted: 0, movedToDate: null, createdAt: at, updatedAt: at });
    }
    const show = (occs) => occs.map((o) => [o.date, o.outcome]);
  `;
  const script = `${prelude}\n(async () => {\n${body}\n})().then((r) => console.log('@@' + JSON.stringify(r)), (e) => { console.error(e && e.stack || e); process.exit(1); });`;
  const stdout = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8', timeout: 120000 });
  const line = stdout.split('\n').find((l) => l.startsWith('@@'));
  if (!line) throw new Error(`no probe output for ${tz}: ${stdout}`);
  return JSON.parse(line.slice(2)) as T;
}

const ZONES = [
  'Pacific/Fiji', // UTC+12, no DST since 2022
  'Pacific/Honolulu', // UTC-10
  'Pacific/Auckland', // UTC+12/+13, DST starts late September
  'America/New_York', // UTC-5/-4, DST
  'America/Santiago', // DST that starts and ends at local midnight
  'Pacific/Kiritimati', // UTC+14
  'Pacific/Pago_Pago', // UTC-11
  'Pacific/Chatham', // UTC+12:45/+13:45
  'Asia/Kathmandu', // UTC+5:45
  'Australia/Lord_Howe', // 30-minute DST shift
  'Europe/London',
];

/* ------------------------------------------------------------------ calendar arithmetic in every zone */

describe('calendar arithmetic (lib/date) agrees with the zone-free dateMath in every zone, every day 2025 to 2027', () => {
  for (const zone of ZONES) {
    it(`${zone}: round trip, addDays, diffDays, weekday, week and month ends`, () => {
      const r = runInZone<{ checked: number; mismatches: string[] }>(
        zone,
        `
        const lib = require('@/lib/date');
        const dm = require('@/domain/dateMath');
        const mismatches = [];
        let checked = 0;
        let d = '2025-01-01';
        const end = '2027-01-05';
        while (d <= end) {
          const prev = dm.addDays(d, -1);
          const next = dm.addDays(d, 1);
          const checks = {
            roundTrip: lib.toLocalDate(lib.parseLocalDate(d)) === d,
            midnightRoundTrip: lib.toLocalDate(new Date(new Date(lib.parseLocalDate(d)).toISOString())) === d,
            addDays: lib.addDays(d, 1) === next,
            addDaysBack: lib.addDays(d, -1) === prev,
            diffDays: lib.diffDays(d, prev) === dm.daysBetween(prev, d) && lib.diffDays(next, d) === 1,
            weekday: lib.weekdayOf(d) === dm.weekdayOf(d),
            startOfWeek: lib.startOfWeek(d) === dm.startOfWeek(d),
            endOfWeek: lib.endOfWeek(d) === dm.endOfWeek(d),
            startOfMonth: lib.startOfMonth(d) === dm.startOfMonth(d),
            endOfMonth: lib.endOfMonth(d) === dm.endOfMonth(d),
            addMonths: lib.addMonths(d, 1) === dm.addMonths(d, 1),
          };
          for (const [k, ok] of Object.entries(checks)) if (!ok) mismatches.push(d + ':' + k);
          checked += 1;
          d = next;
        }
        return { checked, mismatches: mismatches.slice(0, 20) };
        `,
      );
      expect(r.mismatches).toEqual([]);
      expect(r.checked).toBeGreaterThan(700);
    });
  }

  it('the local midnight instant of every day maps back to that day, and one millisecond earlier to the day before', () => {
    const r = runInZone<{ bad: string[]; nonexistentMidnights: number; sliceDiffersFromLocal: number }>(
      'Pacific/Auckland',
      `
      const lib = require('@/lib/date');
      const dm = require('@/domain/dateMath');
      const bad = []; let nonexistentMidnights = 0; let sliceDiffersFromLocal = 0;
      let d = '2025-01-01';
      while (d <= '2027-01-05') {
        const [y, m, day] = d.split('-').map(Number);
        const midnight = new Date(y, m - 1, day, 0, 0, 0, 0);
        if (midnight.getDate() !== day || midnight.getHours() !== 0) nonexistentMidnights += 1;
        const iso = midnight.toISOString();
        if (lib.toLocalDate(new Date(iso)) !== d) bad.push(d + ' at ' + iso);
        const justBefore = new Date(midnight.getTime() - 1);
        if (lib.toLocalDate(justBefore) !== dm.addDays(d, -1)) bad.push(d + ' minus 1 ms');
        if (iso.slice(0, 10) !== d) sliceDiffersFromLocal += 1;
        d = dm.addDays(d, 1);
      }
      return { bad: bad.slice(0, 10), nonexistentMidnights, sliceDiffersFromLocal };
      `,
    );
    expect(r.bad).toEqual([]);
    // Auckland is ahead of UTC, so its local midnight falls on the previous UTC date. The naive
    // `iso.slice(0, 10)` (the mistake `occurrence.ts` warns about) is wrong on every such day.
    expect(r.sliceDiffersFromLocal).toBeGreaterThan(300);
    expect(r.nonexistentMidnights).toBe(0);
  });

  it('America/Santiago: the midnight that does not exist on DST-start days still maps to that calendar day', () => {
    const r = runInZone<{ bad: string[]; nonexistent: number }>(
      'America/Santiago',
      `
      const lib = require('@/lib/date');
      const bad = []; let nonexistent = 0;
      let d = '2025-01-01';
      while (d <= '2027-01-05') {
        const [y, m, day] = d.split('-').map(Number);
        const midnight = new Date(y, m - 1, day, 0, 0, 0, 0);
        if (midnight.getHours() !== 0) nonexistent += 1;
        if (lib.toLocalDate(midnight) !== d) bad.push(d);
        d = lib.addDays(d, 1);
      }
      return { bad: bad.slice(0, 10), nonexistent };
      `,
    );
    expect(r.bad).toEqual([]);
    expect(r.nonexistent).toBeGreaterThan(0); // Santiago does have nonexistent local midnights
  });
});

/* ------------------------------------------------------------------ travel: the creation-day bound */

describe('travel between creating a habit and the next day (creation-day bound, real resolver)', () => {
  // Created at 00:30 on 20 Nov in Fiji (UTC+12): 12:30Z on 19 Nov.
  const CREATED_FIJI_0030 = '2026-11-19T12:30:00.000Z';

  it('read in Fiji, the habit is first due on the 20th (its own creation day): no fabricated 19th', () => {
    const occs = runInZone<Array<[string, string]>>(
      'Pacific/Fiji',
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '${CREATED_FIJI_0030}' });
      return show(await internal.resolveTaskOccurrences(f.repos, task, '2026-11-20', '2026-11-20'));
      `,
    );
    expect(occs.map(([d]) => d)).toEqual(['2026-11-20']);
  });

  it.failing('BUG (internal.ts creationLocalDate): habit created 20 Nov in Fiji must not show a missed 19 Nov after travelling to Honolulu', () => {
    const dates = runInZone<string[]>(
      'Pacific/Honolulu',
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '${CREATED_FIJI_0030}' });
      return (await internal.resolveTaskOccurrences(f.repos, task, '2026-11-20', '2026-11-20')).map((o) => o.date);
      `,
    );
    expect(dates).not.toContain('2026-11-19');
  });

  it.failing('BUG (internal.ts creationLocalDate): habit created 19 Nov at 23:30 in Honolulu must keep 19 Nov as its first day in Fiji', () => {
    // 23:30 Honolulu on 19 Nov is 09:30Z on 20 Nov, which is 21:30 on 20 Nov in Fiji.
    const dates = runInZone<string[]>(
      'Pacific/Fiji',
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '2026-11-20T09:30:00.000Z' });
      return (await internal.resolveTaskOccurrences(f.repos, task, '2026-11-20', '2026-11-20')).map((o) => o.date);
      `,
    );
    expect(dates[0]).toBe('2026-11-19');
  });

  it('a log written on the day it was created survives the trip: logs are local dates and stay put', () => {
    const occs = runInZone<Array<[string, string]>>(
      'Pacific/Honolulu',
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '${CREATED_FIJI_0030}' });
      await log(f, task, '2026-11-20', 'done');
      return show(await internal.resolveTaskOccurrences(f.repos, task, '2026-11-20', '2026-11-20'));
      `,
    );
    expect(occs).toContainEqual(['2026-11-20', 'ideal']);
  });
});

/* ------------------------------------------------------------------ deletion day after a zone change */

describe('deletion day (deletionDay / deletedRecordOf) after a zone change', () => {
  // Routine created 17 Nov 2026 (UTC instant), done on 18 Nov, not done on 19 or 20 Nov.
  const CREATED = '2026-11-17T09:00:00.000Z';
  const probeRecord = (zone: string, deletedAt: string) =>
    runInZone<{ day: string | null; record: Array<[string, string]> }>(
      zone,
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '${CREATED}', deletedAt: '${deletedAt}' });
      f.seedTask(task);
      await log(f, task, '2026-11-18', 'done');
      const day = internal.deletionDay(task);
      const occs = await internal.resolveDeletedTaskRecord(f.repos, task, '2026-11-25', '2026-11-25');
      return { day, record: show(occs).filter(([d]) => d >= '2026-11-19') };
      `,
    );

  it('deleted at 23:00 on 20 Nov in New York: the record ends before the 20th (no missed 20th)', () => {
    // 04:00Z on 21 Nov is 23:00 on 20 Nov in New York (EST, UTC-5).
    const r = probeRecord('America/New_York', '2026-11-21T04:00:00.000Z');
    expect(r.day).toBe('2026-11-20');
    expect(r.record).toEqual([['2026-11-19', 'missed']]);
  });

  it.failing('BUG (internal.ts deletionDay): the same deletion read in Auckland (UTC+13) must not add a missed 20th', () => {
    // Same instant: it is 17:00 on 21 Nov in Auckland, so the deletion day moves to the 21st and
    // the 20th, a day the person was still in, now counts as a settled missed day.
    const ny = probeRecord('America/New_York', '2026-11-21T04:00:00.000Z');
    const auckland = probeRecord('Pacific/Auckland', '2026-11-21T04:00:00.000Z');
    expect(auckland.record).toEqual(ny.record);
  });

  it.failing('BUG (internal.ts deletionDay): deleted at 00:30 on 21 Nov in Auckland must still count the missed 20th when read in New York', () => {
    // 11:30Z on 20 Nov: 00:30 on 21 Nov in Auckland, but 06:30 on 20 Nov in New York, so the
    // 20th is treated as the deletion day and its missed outcome is dropped.
    const auckland = probeRecord('Pacific/Auckland', '2026-11-20T11:30:00.000Z');
    const ny = probeRecord('America/New_York', '2026-11-20T11:30:00.000Z');
    expect(auckland.record).toContainEqual(['2026-11-20', 'missed']);
    expect(ny.record).toEqual(auckland.record);
  });

  it('deleted at exactly local midnight (00:00:00.000) in each zone: the deletion day is that calendar day', () => {
    for (const zone of ['America/New_York', 'Pacific/Fiji', 'Asia/Kathmandu', 'Pacific/Kiritimati']) {
      const day = runInZone<string | null>(
        zone,
        `
        const internal = require('@/queries/internal');
        const deletedAt = new Date(2026, 10, 20, 0, 0, 0, 0).toISOString();
        return internal.deletionDay(mk({ deletedAt }));
        `,
      );
      expect({ zone, day }).toEqual({ zone, day: '2026-11-20' });
    }
  });

  it.failing('BUG (internal.ts deletedRecordOf, clock set back): a habit deleted "in the future" must not count today as a settled missed day', () => {
    // The device clock was set back to 19 Nov (NY) after deleting at 23:00 on 20 Nov. Today is the 19th
    // and has not been done, so it must not be a missed day: it is not over yet.
    const r = runInZone<Array<[string, string]>>(
      'America/New_York',
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '${CREATED}', deletedAt: '2026-11-21T04:00:00.000Z' });
      f.seedTask(task);
      return show(await internal.resolveDeletedTaskRecord(f.repos, task, '2026-11-19', '2026-11-19'));
      `,
    );
    expect(r.map(([d]) => d)).not.toContain('2026-11-19');
  });
});

/* ------------------------------------------------------------------ the 30-day window */

describe('the 30-day Recently deleted window (retention.ts, instants only)', () => {
  it('the window is 30 x 24 h of absolute time, so the zone a deletion was made in never moves its purge instant', () => {
    // A deletion at local midnight, 20 Nov, in New York and in Fiji: the same UTC instant either way.
    const nyMidnight = runInZone<string>('America/New_York', `return new Date(2026, 10, 20, 0, 0, 0, 0).toISOString();`) as Instant;
    const fijiMidnight = runInZone<string>('Pacific/Fiji', `return new Date(2026, 10, 20, 0, 0, 0, 0).toISOString();`) as Instant;
    expect(nyMidnight).toBe('2026-11-20T05:00:00.000Z');
    expect(fijiMidnight).toBe('2026-11-19T12:00:00.000Z');
    // Purge is the same instant for both reads, whichever zone is current when the day is read.
    expect(purgeCutoff(new Date(new Date(nyMidnight).getTime() + DELETED_KEEP_DAYS * 86400000).toISOString() as Instant)).toBe(nyMidnight);
    expect(daysLeft(nyMidnight, nyMidnight as Instant)).toBe(30);
  });

  it('daysLeft counts whole 24 h days: 30 at deletion, 1 on the last day, 0 at and after the purge instant', () => {
    const D = '2026-11-20T05:00:00.000Z' as Instant;
    const at = (ms: number) => new Date(new Date(D).getTime() + ms).toISOString() as Instant;
    expect(daysLeft(D, D)).toBe(30);
    expect(daysLeft(D, at(29 * 86400000 + 1))).toBe(1);
    expect(daysLeft(D, at(30 * 86400000 - 1))).toBe(1);
    expect(daysLeft(D, at(30 * 86400000))).toBe(0);
  });

  it('spring forward (New York, 8 Mar 2026): the window is one wall-clock hour longer, never shorter', () => {
    // Deleted at local midnight 1 Mar 2026 (EST, 05:00Z). 720 absolute hours later it is 01:00 EDT on 31 Mar.
    const deleted = '2026-03-01T05:00:00.000Z' as Instant;
    const purgeAt = new Date(new Date(deleted).getTime() + DELETED_KEEP_DAYS * 86400000).toISOString();
    expect(purgeAt).toBe('2026-03-31T05:00:00.000Z');
    const wall = runInZone<string>('America/New_York', `return new Date('${purgeAt}').toString();`);
    expect(wall).toContain('01:00:00');
    expect(wall).toContain('Mar 31 2026');
  });

  it('fall back (New York, 1 Nov 2026): the window is 720 absolute hours, so the last wall-clock day ends an hour early (pinned trade-off)', () => {
    // Deleted at local midnight 20 Oct (EDT, 04:00Z). The 25-hour day on 1 Nov makes 720 absolute hours
    // end at 23:00 on 18 Nov locally, one hour before the calendar 30th day (19 Nov) starts. The
    // existing retention test pins this on purpose ("pure 24 h steps, no local-calendar drift").
    const deleted = '2026-10-20T04:00:00.000Z' as Instant;
    const purgeAt = new Date(new Date(deleted).getTime() + DELETED_KEEP_DAYS * 86400000).toISOString() as Instant;
    expect(purgeAt).toBe('2026-11-19T04:00:00.000Z');
    expect(daysLeft(deleted, new Date(new Date(purgeAt).getTime() - 1).toISOString() as Instant)).toBe(1);
    const wall = runInZone<string>('America/New_York', `return new Date('${purgeAt}').toString();`);
    expect(wall).toContain('Nov 18 2026 23:00:00');
  });

  it('a deletion stamped ahead of a clock that was set back a day shows 30 days left and is not purged', () => {
    const now = '2026-11-19T12:00:00.000Z' as Instant; // clock set back
    const deletedAt = '2026-11-20T12:00:00.000Z' as Instant; // stamped before the reset
    expect(daysLeft(deletedAt, now)).toBe(30);
    expect(deletedAt < purgeCutoff(now)).toBe(false);
  });
});

/* ------------------------------------------------------------------ DST days in the stored record */

describe('DST days in the stored record (real resolver)', () => {
  it('a daily habit has exactly one occurrence per calendar day across the New York fall-back (25-hour day) and spring-forward', () => {
    const r = runInZone<{ dates: string[] }>(
      'America/New_York',
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '2026-01-01T09:00:00.000Z' });
      return { dates: (await internal.resolveTaskOccurrences(f.repos, task, '2026-12-31', '2026-12-31')).map((o) => o.date) };
      `,
    );
    const dm = require('./dateMath') as typeof import('./dateMath');
    // Every calendar day of 2026, in order, with no gap and no duplicate across both transitions.
    expect(r.dates.length).toBe(365);
    for (let i = 1; i < r.dates.length; i++) {
      expect(r.dates[i]).toBe(dm.addDays(r.dates[i - 1] as LocalDate, 1));
    }
    expect(r.dates).toContain('2026-03-08');
    expect(r.dates).toContain('2026-11-01');
  });

  it('the record reads the same days whatever the zone when there are no travel-sensitive stamps (control)', () => {
    const readIn = (zone: string) =>
      runInZone<string[]>(
        zone,
        `
        const internal = require('@/queries/internal');
        const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
        const f = createFakeRepos();
        const task = mk({ createdAt: '2026-11-01T12:00:00.000Z' }); // noon UTC: the same day in every zone here
        await log(f, task, '2026-11-03', 'done');
        return (await internal.resolveRecordOccurrences(f.repos, '2026-11-05', '2026-11-05')).map((o) => o.date + o.outcome);
        `,
      );
    expect(readIn('Pacific/Fiji')).toEqual(readIn('America/New_York'));
  });
});

/* ------------------------------------------------------------------ device clock set back */

describe('device clock set back a day', () => {
  it('a log dated after the (reset) today stays out of the Today and record reads until its day arrives', () => {
    const r = runInZone<{ today: string[]; record: string[] }>(
      'Pacific/Auckland',
      `
      const internal = require('@/queries/internal');
      const { createFakeRepos } = require('@/queries/testSupport/fakeRepos');
      const f = createFakeRepos();
      const task = mk({ createdAt: '2026-11-10T09:00:00.000Z' });
      await log(f, task, '2026-11-21', 'done'); // written while the clock was ahead
      const today = (await internal.resolveTaskOccurrences(f.repos, task, '2026-11-19', '2026-11-19')).map((o) => o.date);
      const record = (await internal.resolveRecordOccurrences(f.repos, '2026-11-19', '2026-11-19')).map((o) => o.date);
      return { today, record };
      `,
    );
    expect(r.today).not.toContain('2026-11-21');
    expect(r.record).not.toContain('2026-11-21');
    expect(r.today[r.today.length - 1]).toBe('2026-11-19');
  });
});
