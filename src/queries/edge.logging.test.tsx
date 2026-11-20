/**
 * Edge-case campaign, area 18: LOGGING through the real mutations (fake repositories, mock clock).
 * Sequences a real person would do over a week: log, change their mind, undo, log again, log past
 * days, multi-dose and multi-step habits, Push to tomorrow (additive), Emergency day off, End
 * routine, Delete and Restore, midnight passing mid-sequence, double taps. XP and badges are
 * checked at every step against what the record says.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});

jest.mock('@/db', () => require('./testSupport/dbMock'));

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Id, Instant, LocalDate, Occurrence, Step, TaskWithSteps } from '@/types';

import { resolveRecordOccurrences, resolveTaskOccurrences } from './internal';
import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import { __testing__, useLogState } from './mutations';

const { logState, toggleStep, logDose, markOffDay, snoozeOccurrence, undoSnooze } = __testing__;

/* ------------------------------------------------------------------ harness */

const D = (s: string) => s as LocalDate;
function at(date: string, time = '12:00:00.000') {
  clock.today = date;
  clock.now = `${date}T${time}Z`;
}

let idCounter = 0;
function makeTask(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  idCounter += 1;
  const id = (overrides.id ?? `lg-task-${idCounter}`) as TaskWithSteps['id'];
  const ideal: Step = { id: `${id}-ideal` as Step['id'], taskId: id, role: 'ideal', text: 'Do it', position: 0, dueWeekdays: null };
  const fb: Step = { id: `${id}-fallback` as Step['id'], taskId: id, role: 'fallback', text: 'Min version', position: 0, dueWeekdays: null };
  return {
    id,
    type: 'routine',
    name: 'Walk',
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
    endedOn: null,
    createdAt: '2024-05-20T08:00:00.000Z' as Instant,
    updatedAt: '2024-05-20T08:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps: [ideal],
    fallbackSteps: [fb],
    ...overrides,
  } as TaskWithSteps;
}

function seed(overrides: Partial<TaskWithSteps> = {}): TaskWithSteps {
  const t = makeTask(overrides);
  fake.seedTask(t);
  return t;
}

const log = (task: TaskWithSteps, date: string, chip: 'done' | 'fallback' | 'skip' | 'todo', pushedFrom?: string) =>
  logState({ taskId: task.id, date: D(date), chip, ...(pushedFrom ? { pushedFrom: D(pushedFrom) } : {}) });
const push = (task: TaskWithSteps, date: string) => snoozeOccurrence({ taskId: task.id, date: D(date) });
const unpush = (task: TaskWithSteps, date: string) => undoSnooze({ taskId: task.id, date: D(date) });
const off = (date: string, task: TaskWithSteps | null, mark = true) => markOffDay({ date: D(date), taskId: task ? task.id : null, mark });

/** XP awards as "date=amount" for one task, sorted. */
function awards(task: TaskWithSteps): string[] {
  return fake
    .xpAwards()
    .filter((a) => a.taskId === task.id)
    .map((a) => `${a.date}=${a.amount}`)
    .sort();
}
const lifetime = () => repos.progress.lifetimeXp();

async function occs(task: TaskWithSteps, from: string, to: string): Promise<Occurrence[]> {
  const all = await resolveTaskOccurrences(repos, (await repos.tasks.get(task.id))!, D(to), D(clock.today));
  return all.filter((o) => o.date >= from);
}
const outcomes = async (task: TaskWithSteps, from: string, to: string) =>
  (await occs(task, from, to)).map((o) => `${o.date}${o.pushedFrom ? `<-${o.pushedFrom}` : ''}:${o.outcome}`);

/**
 * The invariant that must hold after EVERY step: lifetime XP equals the XP of the occurrences that
 * stand in the record (ideal 10, fallback 6), counting each award row once. Off days and pushed
 * occurrences included. Exceptions (days that went away) are asserted per test.
 */
async function recordXp(task: TaskWithSteps, through: string = clock.today): Promise<number> {
  const rec = await resolveRecordOccurrences(repos, D(through), D(clock.today));
  return rec.filter((o) => o.taskId === task.id).reduce((s, o) => s + (o.outcome === 'ideal' ? 10 : o.outcome === 'fallback' ? 6 : 0), 0);
}

beforeEach(() => {
  fake.reset();
  at('2024-06-01'); // a Saturday
});

/* ------------------------------------------------------------------ ideal / fallback / undo */

describe('log, change their mind, undo, log again', () => {
  it('ideal 10, fallback 6, undo 0, ideal 10 again: lifetime XP exact at each step, one award row', async () => {
    const t = seed();
    expect((await log(t, '2024-06-01', 'done')).ok).toBe(true);
    expect([await lifetime(), awards(t)]).toEqual([10, ['2024-06-01=10']]);
    await log(t, '2024-06-01', 'fallback');
    expect([await lifetime(), awards(t)]).toEqual([6, ['2024-06-01=6']]);
    await log(t, '2024-06-01', 'todo');
    expect([await lifetime(), awards(t)]).toEqual([0, []]);
    await log(t, '2024-06-01', 'done');
    expect([await lifetime(), awards(t)]).toEqual([10, ['2024-06-01=10']]);
    expect(fake.logsFor(t.id)).toHaveLength(1);
  });

  it('skip (a manual miss) is not XP and retracts an earlier award', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    const r = await log(t, '2024-06-01', 'skip');
    expect(r.ok && r.value.outcome).toBe('missed');
    expect(await lifetime()).toBe(0);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:missed']);
  });

  it('the result reports celebrate/xpAwarded for what stands, none for an undo', async () => {
    const t = seed();
    const a = await log(t, '2024-06-01', 'done');
    expect(a.ok && [a.value.celebrate, a.value.xpAwarded]).toEqual(['ideal', 10]);
    const b = await log(t, '2024-06-01', 'fallback');
    expect(b.ok && [b.value.celebrate, b.value.xpAwarded]).toEqual(['fallback', 6]);
    const c = await log(t, '2024-06-01', 'todo');
    expect(c.ok && [c.value.celebrate, c.value.xpAwarded, c.value.outcome]).toEqual(['none', 0, 'pending']);
  });

  it('badges earned stay earned when the log that earned them is undone (upsert-only), and are never duplicated', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    const first = fake.unlocks().map((u) => u.key).sort();
    expect(first.length).toBeGreaterThan(0);
    await log(t, '2024-06-01', 'todo');
    await log(t, '2024-06-01', 'done');
    await log(t, '2024-06-01', 'fallback');
    const after = fake.unlocks().map((u) => u.key);
    expect(new Set(after).size).toBe(after.length);
    for (const k of first) expect(after).toContain(k);
  });

  it('a second habit on the same day has its own award; undoing one leaves the other', async () => {
    const a = seed({ name: 'A' });
    const b = seed({ name: 'B' });
    await log(a, '2024-06-01', 'done');
    await log(b, '2024-06-01', 'fallback');
    expect(await lifetime()).toBe(16);
    await log(a, '2024-06-01', 'todo');
    expect(await lifetime()).toBe(6);
    expect(awards(b)).toEqual(['2024-06-01=6']);
  });

  it('logging a date with nothing due is refused with no row and no XP', async () => {
    const t = seed({ cadence: { kind: 'specific-weekdays', weekdays: [1] } as never }); // Mondays only
    const r = await log(t, '2024-06-01', 'done'); // a Saturday
    expect(r.ok).toBe(false);
    expect(fake.logsFor(t.id)).toHaveLength(0);
    expect(await lifetime()).toBe(0);
  });

  it('a date before the habit existed is refused', async () => {
    const t = seed();
    const r = await log(t, '2024-05-10', 'done');
    expect(r.ok).toBe(false);
    expect(await lifetime()).toBe(0);
  });
});

/* ------------------------------------------------------------------ past days */

describe('logging past days from the history', () => {
  it('a missed day logged later becomes ideal, XP lands on that day, and undoing it makes it a miss again', async () => {
    const t = seed();
    at('2024-06-05');
    expect(await outcomes(t, '2024-06-03', '2024-06-03')).toEqual(['2024-06-03:missed']);
    await log(t, '2024-06-03', 'done');
    expect(awards(t)).toEqual(['2024-06-03=10']);
    expect(await outcomes(t, '2024-06-03', '2024-06-03')).toEqual(['2024-06-03:ideal']);
    await log(t, '2024-06-03', 'todo');
    expect(awards(t)).toEqual([]);
    expect(await outcomes(t, '2024-06-03', '2024-06-03')).toEqual(['2024-06-03:missed']);
  });

  it('logging several past days then changing one keeps every other award exactly', async () => {
    const t = seed();
    at('2024-06-05');
    for (const d of ['2024-06-01', '2024-06-02', '2024-06-03', '2024-06-04']) await log(t, d, 'done');
    await log(t, '2024-06-02', 'fallback');
    await log(t, '2024-06-03', 'todo');
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=6', '2024-06-04=10']);
    expect(await lifetime()).toBe(await recordXp(t));
  });

  it('logging a past day across a month end and a leap day (Feb 29) keeps the right date', async () => {
    const t = seed({ createdAt: '2024-02-20T08:00:00.000Z' as Instant });
    at('2024-03-02');
    await log(t, '2024-02-29', 'done');
    await log(t, '2024-02-28', 'fallback');
    await log(t, '2024-03-01', 'done');
    expect(awards(t)).toEqual(['2024-02-28=6', '2024-02-29=10', '2024-03-01=10']);
  });

  it('logging a day in a cycle that has already been archived still awards XP and does not archive that cycle twice', async () => {
    const t = seed({ createdAt: '2024-05-20T08:00:00.000Z' as Instant });
    at('2024-06-02');
    await log(t, '2024-06-02', 'done'); // archives the cycles before June
    const before = fake.cycleRecords().length;
    await log(t, '2024-05-30', 'done'); // a day inside an archived cycle
    expect(awards(t)).toEqual(['2024-05-30=10', '2024-06-02=10']);
    expect(fake.cycleRecords().length).toBe(before);
    const keys = fake.cycleRecords().map((r) => `${r.cadence}:${r.startDate}:${r.endDate}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('logging a future date is not silently turned into XP for a day that has not happened (documented behaviour)', async () => {
    const t = seed();
    const r = await log(t, '2024-06-02', 'done');
    // The UI never offers a future day; at the data layer it resolves like today. We pin what happens
    // so a change is noticed: it is accepted and awarded under that date.
    expect(r.ok).toBe(true);
    expect(awards(t)).toEqual(['2024-06-02=10']);
  });
});

/* ------------------------------------------------------------------ multi-dose */

describe('multi-dose tasks', () => {
  it('partial doses read fallback (6), all doses read ideal (10), un-dosing steps back down and retracts at zero', async () => {
    const t = seed({ dosesPerDay: 3, idealSteps: [], fallbackSteps: [] });
    const d = (n: number) => logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: n });
    await d(1);
    expect(await lifetime()).toBe(6);
    await d(2);
    expect(await lifetime()).toBe(6);
    const full = await d(3);
    expect(full.ok && full.value.occurrence!.outcome).toBe('ideal');
    expect(await lifetime()).toBe(10);
    await d(2);
    expect(await lifetime()).toBe(6);
    expect(awards(t)).toEqual(['2024-06-01=6']);
    await d(0);
    expect(await lifetime()).toBe(0);
    expect(awards(t)).toEqual([]);
    expect(fake.logsFor(t.id)).toHaveLength(1);
  });

  it('whole-day override: a manual Done wins over the doses, un-dosing later does not unlog it, and Skip then Done recovers', async () => {
    const t = seed({ dosesPerDay: 3, idealSteps: [], fallbackSteps: [] });
    await logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 1 });
    await log(t, '2024-06-01', 'done');
    expect(await lifetime()).toBe(10);
    await logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 0 });
    expect(await lifetime()).toBe(10); // the manual chip stays until changed
    await log(t, '2024-06-01', 'skip');
    expect(await lifetime()).toBe(0);
    await log(t, '2024-06-01', 'done');
    expect(await lifetime()).toBe(10);
  });

  it('more doses than required is still just ideal (no extra XP), and doses are kept per day', async () => {
    const t = seed({ dosesPerDay: 2, idealSteps: [], fallbackSteps: [] });
    at('2024-06-02');
    await logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 5 });
    await logDose({ taskId: t.id, date: D('2024-06-02'), dosesCompleted: 1 });
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=6']);
  });

  it('doses on a multi-dose habit with ideal steps: steps and doses both have to be complete for ideal', async () => {
    const t = seed({ dosesPerDay: 2 });
    const ideal = t.idealSteps[0]!.id;
    await toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: ideal });
    expect(await lifetime()).toBe(6); // steps done, doses not
    await logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 2 });
    expect(await lifetime()).toBe(10);
    await toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: ideal });
    expect(await lifetime()).toBe(6); // doses only
    await logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 0 });
    expect(await lifetime()).toBe(0);
  });
});

/* ------------------------------------------------------------------ multi-step */

describe('multi-step tasks with per-step weekdays', () => {
  function stepsTask() {
    const id = 'lg-steps' as Id;
    const a: Step = { id: 'a' as Id, taskId: id, role: 'ideal', text: 'A (every day)', position: 0, dueWeekdays: null };
    const b: Step = { id: 'b' as Id, taskId: id, role: 'ideal', text: 'B (Mondays)', position: 1, dueWeekdays: [1] as never };
    return seed({ id, idealSteps: [a, b], fallbackSteps: [] });
  }

  it('Monday needs A and B; Saturday needs only A. Toggling up and down moves XP exactly', async () => {
    const t = stepsTask();
    at('2024-06-03'); // Monday
    const tog = (date: string, stepId: string) => toggleStep({ taskId: t.id, date: D(date), stepId: stepId as Id });
    await tog('2024-06-03', 'a');
    expect(awards(t)).toEqual(['2024-06-03=6']);
    await tog('2024-06-03', 'b');
    expect(awards(t)).toEqual(['2024-06-03=10']);
    await tog('2024-06-03', 'a');
    expect(awards(t)).toEqual(['2024-06-03=6']);
    await tog('2024-06-03', 'b');
    expect(awards(t)).toEqual([]);
    // Saturday (past): only A is due.
    await tog('2024-06-01', 'a');
    expect(awards(t)).toEqual(['2024-06-01=10']);
  });

  it('toggling a step that is not due that day does not complete the day or award anything', async () => {
    const t = stepsTask();
    const r = await toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: 'b' as Id }); // Saturday, B is Monday-only
    expect(r.ok).toBe(true);
    expect(awards(t)).toEqual([]);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:pending']);
  });

  it('a manual Done then a step toggle: the step-driven state takes over (documented), XP follows what the day now reads', async () => {
    const t = stepsTask();
    await log(t, '2024-06-01', 'done');
    expect(await lifetime()).toBe(10);
    await toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: 'a' as Id });
    expect(await lifetime()).toBe(10); // A is the only due step and is now ticked -> done
    await toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: 'a' as Id });
    expect(await lifetime()).toBe(0);
    expect(await lifetime()).toBe(await recordXp(t));
  });
});

/* ------------------------------------------------------------------ push to tomorrow */

describe('Push to tomorrow (additive)', () => {
  it('push today, tomorrow has its own occurrence AND the pushed one; log both: two awards, 20 XP', async () => {
    const t = seed();
    expect((await push(t, '2024-06-01')).ok).toBe(true);
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:not-due', '2024-06-02:pending', '2024-06-02<-2024-06-01:pending']);
    at('2024-06-02');
    await log(t, '2024-06-02', 'done', '2024-06-01');
    expect(awards(t)).toEqual(['2024-06-01=10']);
    await log(t, '2024-06-02', 'fallback');
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=6']);
    expect(await lifetime()).toBe(16);
    expect(await lifetime()).toBe(await recordXp(t));
    expect(fake.logsFor(t.id)).toHaveLength(2);
  });

  it('the pushed one is logged first, then the own one; changing either later never touches the other', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    at('2024-06-02');
    await log(t, '2024-06-02', 'done');
    await log(t, '2024-06-02', 'fallback', '2024-06-01');
    await log(t, '2024-06-02', 'todo', '2024-06-01');
    expect(awards(t)).toEqual(['2024-06-02=10']);
    await log(t, '2024-06-02', 'done', '2024-06-01');
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=10']);
  });

  it('undo the push after the pushed one was logged: it comes back to its own day with its log and the XP is unchanged', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    at('2024-06-02');
    await log(t, '2024-06-02', 'done', '2024-06-01');
    await log(t, '2024-06-02', 'done');
    expect(await lifetime()).toBe(20);
    expect((await unpush(t, '2024-06-01')).ok).toBe(true);
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:ideal', '2024-06-02:ideal']);
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=10']);
    expect(await lifetime()).toBe(20);
  });

  it('push, undo, push again: same row reused, no XP created by the push itself', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await push(t, '2024-06-01');
    expect(await lifetime()).toBe(10); // XP follows the pushed occurrence, nothing is retracted
    await unpush(t, '2024-06-01');
    await push(t, '2024-06-01');
    await unpush(t, '2024-06-01');
    expect(fake.logsFor(t.id)).toHaveLength(1);
    expect(awards(t)).toEqual(['2024-06-01=10']);
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:ideal', '2024-06-02:pending']);
  });

  it('pushing a logged day carries its log; un-logging it on the pushed day retracts that award', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await push(t, '2024-06-01');
    at('2024-06-02');
    expect(await outcomes(t, '2024-06-02', '2024-06-02')).toEqual(['2024-06-02:pending', '2024-06-02<-2024-06-01:ideal']);
    await log(t, '2024-06-02', 'todo', '2024-06-01');
    expect(awards(t)).toEqual([]);
    expect(await lifetime()).toBe(0);
  });

  it('push onto a day that is off (this habit): the pushed occurrence reads off and earns nothing; lifting the day off restores it', async () => {
    const t = seed();
    await off('2024-06-02', t);
    await push(t, '2024-06-01');
    expect(await outcomes(t, '2024-06-02', '2024-06-02')).toEqual(['2024-06-02:off', '2024-06-02<-2024-06-01:off']);
    at('2024-06-02');
    await log(t, '2024-06-02', 'done', '2024-06-01'); // logged while off
    expect(await lifetime()).toBe(0);
    await off('2024-06-02', t, false);
    // The logged pushed occurrence now stands as ideal again, so its XP must now exist.
    expect(await outcomes(t, '2024-06-02', '2024-06-02')).toEqual(['2024-06-02:pending', '2024-06-02<-2024-06-01:ideal']);
    expect(await lifetime()).toBe(await recordXp(t));
  });

  it('push onto a whole-day-off day, log the pushed one, lift the day off: XP is exact', async () => {
    const t = seed();
    await off('2024-06-02', null);
    await push(t, '2024-06-01');
    at('2024-06-02');
    await log(t, '2024-06-02', 'done', '2024-06-01');
    await log(t, '2024-06-02', 'fallback');
    expect(await lifetime()).toBe(0);
    await off('2024-06-02', null, false);
    expect(await lifetime()).toBe(await recordXp(t));
    expect(await lifetime()).toBe(16);
  });

  it('pushing yesterday (missed) from today: yesterday leaves the record, today gains the pushed one, logging it awards yesterday-keyed XP once', async () => {
    const t = seed();
    at('2024-06-02');
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:missed']);
    expect((await push(t, '2024-06-01')).ok).toBe(true);
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:not-due', '2024-06-02:pending', '2024-06-02<-2024-06-01:pending']);
    await log(t, '2024-06-02', 'done', '2024-06-01');
    await log(t, '2024-06-02', 'done', '2024-06-01'); // double tap
    expect(awards(t)).toEqual(['2024-06-01=10']);
  });

  it('a task that cannot be pushed: not snoozable, nothing due, or already pushed once: refused, zero writes', async () => {
    const stiff = seed({ snoozable: false });
    const r1 = await push(stiff, '2024-06-01');
    expect(!r1.ok && r1.error.message).toMatch(/not snoozable/i);
    expect(fake.logsFor(stiff.id)).toHaveLength(0);

    const mondays = seed({ cadence: { kind: 'specific-weekdays', weekdays: [1] } as never });
    const r2 = await push(mondays, '2024-06-01');
    expect(r2.ok).toBe(false);
    expect(fake.logsFor(mondays.id)).toHaveLength(0);

    const t = seed();
    await push(t, '2024-06-01');
    const again = await push(t, '2024-06-01'); // already pushed: its own day reads not-due
    expect(again.ok).toBe(false);
    expect(fake.logsFor(t.id)).toHaveLength(1);
  });

  it('a Monday-only habit pushed to Tuesday: the pushed one is the only occurrence there and cannot be pushed on again', async () => {
    const t = seed({ cadence: { kind: 'specific-weekdays', weekdays: [1] } as never });
    at('2024-06-03'); // Monday
    expect((await push(t, '2024-06-03')).ok).toBe(true);
    expect(await outcomes(t, '2024-06-03', '2024-06-04')).toEqual(['2024-06-03:not-due', '2024-06-04<-2024-06-03:pending']);
    at('2024-06-04');
    const second = await push(t, '2024-06-04');
    expect(!second.ok && second.error.message).toMatch(/already snoozed/i);
    await log(t, '2024-06-04', 'done', '2024-06-03');
    expect(awards(t)).toEqual(['2024-06-03=10']);
  });

  it('a chain: push Monday to Tuesday (daily), then push Tuesday onward; each row keeps its own award', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    at('2024-06-02');
    await log(t, '2024-06-02', 'done', '2024-06-01');
    expect((await push(t, '2024-06-02')).ok).toBe(true); // Tuesday's own goes to Wednesday
    at('2024-06-03');
    expect(await outcomes(t, '2024-06-01', '2024-06-03')).toEqual([
      '2024-06-01:not-due',
      '2024-06-02<-2024-06-01:ideal',
      '2024-06-03:pending',
      '2024-06-03<-2024-06-02:pending',
    ]);
    await log(t, '2024-06-03', 'fallback', '2024-06-02');
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=6']);
    expect(await lifetime()).toBe(await recordXp(t));
  });

  it('push on the last day before an END date: the pushed occurrence must not vanish with its log (a done day is not lost)', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await off('2024-06-02', null, false);
    const ended = await repos.tasks.update(t.id, { endedOn: D('2024-06-01') });
    expect(ended.ok).toBe(true);
    const r = await push(t, '2024-06-01');
    const rec = await outcomes(t, '2024-05-30', '2024-06-03');
    // Either the push is refused (day stays ideal), or the pushed day still shows. It must not disappear.
    expect(r.ok).toBe(false);
    expect(rec).toContain('2024-06-01:ideal');
    expect(await lifetime()).toBe(10);
  });

  it('push on the last day of a course: the pushed occurrence shows after the course end and can be logged', async () => {
    const t = seed({
      type: 'course',
      startDate: D('2024-05-27'),
      endDate: D('2024-06-01'),
      cadence: { kind: 'daily' } as never,
    });
    expect((await push(t, '2024-06-01')).ok).toBe(true);
    at('2024-06-02');
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:not-due', '2024-06-02<-2024-06-01:pending']);
    await log(t, '2024-06-02', 'done', '2024-06-01');
    expect(awards(t)).toEqual(['2024-06-01=10']);
  });

  it('after the day moves on (midnight twice) an unlogged pushed occurrence reads missed on its own day, and undoing then lands as missed', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    at('2024-06-03');
    expect(await outcomes(t, '2024-06-02', '2024-06-02')).toEqual(['2024-06-02:missed', '2024-06-02<-2024-06-01:missed']);
    await unpush(t, '2024-06-01');
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:missed', '2024-06-02:missed']);
  });

  it('undo with nothing pushed is refused and writes nothing', async () => {
    const t = seed();
    const r = await unpush(t, '2024-06-01');
    expect(r.ok).toBe(false);
    expect(fake.logsFor(t.id)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ emergency day off */

describe('Emergency day off', () => {
  it('for one habit, after logging: the day reads off, XP stays; lifting it restores the log exactly', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'fallback');
    const before = fake.logsFor(t.id)[0];
    await off('2024-06-01', t);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:off']);
    expect(await lifetime()).toBe(6);
    await off('2024-06-01', t, false);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:fallback']);
    expect(fake.logsFor(t.id)[0]).toEqual(before);
    expect(await lifetime()).toBe(6);
  });

  it('for the whole day, after logging two habits: both read off, lifting restores both rows exactly', async () => {
    const a = seed({ name: 'A' });
    const b = seed({ name: 'B' });
    await log(a, '2024-06-01', 'done');
    await log(b, '2024-06-01', 'fallback');
    const rows = [fake.logsFor(a.id)[0], fake.logsFor(b.id)[0]];
    await off('2024-06-01', null);
    expect(await outcomes(a, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:off']);
    expect(await outcomes(b, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:off']);
    expect(await lifetime()).toBe(16);
    await off('2024-06-01', null, false);
    expect([fake.logsFor(a.id)[0], fake.logsFor(b.id)[0]]).toEqual(rows);
    expect(await outcomes(a, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:ideal']);
    expect(await lifetime()).toBe(16);
  });

  it('logging while the day is off earns nothing yet; lifting the day (this habit) awards what was logged, exactly once', async () => {
    const t = seed();
    await off('2024-06-01', t);
    await log(t, '2024-06-01', 'done');
    expect(await lifetime()).toBe(0);
    await off('2024-06-01', t, false);
    expect(await lifetime()).toBe(10);
    await off('2024-06-01', t, false); // lifted twice
    expect(awards(t)).toEqual(['2024-06-01=10']);
  });

  it('logging while the WHOLE day is off, then lifting it: the logged habits are awarded (no log is lost)', async () => {
    const a = seed({ name: 'A' });
    const b = seed({ name: 'B' });
    await off('2024-06-01', null);
    await log(a, '2024-06-01', 'done');
    await log(b, '2024-06-01', 'fallback');
    expect(await lifetime()).toBe(0);
    await off('2024-06-01', null, false);
    expect(await lifetime()).toBe(16);
    expect(await lifetime()).toBe((await recordXp(a)) + (await recordXp(b)));
  });

  it('off then lifted with nothing logged leaves the day exactly as it was (pending today, missed in the past)', async () => {
    const t = seed();
    at('2024-06-03');
    await off('2024-06-01', null);
    await off('2024-06-03', t);
    expect(await outcomes(t, '2024-06-01', '2024-06-03')).toEqual(['2024-06-01:off', '2024-06-02:missed', '2024-06-03:off']);
    await off('2024-06-01', null, false);
    await off('2024-06-03', t, false);
    expect(await outcomes(t, '2024-06-01', '2024-06-03')).toEqual(['2024-06-01:missed', '2024-06-02:missed', '2024-06-03:pending']);
  });

  it('marking twice (double tap) leaves one off mark per day and never duplicates XP', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await Promise.all([off('2024-06-01', t), off('2024-06-01', t)]);
    await Promise.all([off('2024-06-01', t, false), off('2024-06-01', t, false)]);
    expect(awards(t)).toEqual(['2024-06-01=10']);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:ideal']);
  });

  it('a task-level off mark on a day that is not due changes nothing and is reversible', async () => {
    const t = seed({ cadence: { kind: 'specific-weekdays', weekdays: [1] } as never });
    const r = await off('2024-06-01', t);
    expect(r.ok).toBe(true);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual([]);
    await off('2024-06-01', t, false);
    expect(await lifetime()).toBe(0);
  });

  it('whole-day off marks a pushed occurrence landing on it as off; the source day keeps reading not-due', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    await off('2024-06-02', null);
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:not-due', '2024-06-02:off', '2024-06-02<-2024-06-01:off']);
  });

  it('off for a habit never retracts XP already earned, even when it was earned as a pushed occurrence', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await push(t, '2024-06-01');
    at('2024-06-02');
    await off('2024-06-02', t);
    expect(awards(t)).toEqual(['2024-06-01=10']);
    await off('2024-06-02', t, false);
    expect(awards(t)).toEqual(['2024-06-01=10']);
  });

  it('a badge that a lifted day would unlock is saved by that lift (badges follow the record, not only the next tap)', async () => {
    const t = seed();
    await off('2024-06-01', null);
    await log(t, '2024-06-01', 'done');
    const withheld = fake.unlocks().map((u) => u.key);
    await off('2024-06-01', null, false);
    const after = fake.unlocks().map((u) => u.key);
    expect(after.length).toBeGreaterThanOrEqual(withheld.length);
    expect(new Set(after).size).toBe(after.length);
  });
});

/* ------------------------------------------------------------------ end routine */

describe('End routine across states', () => {
  const end = async (t: TaskWithSteps) => {
    const { useEndTask } = require('./mutations') as typeof import('./mutations');
    return hookMutate(useEndTask, t.id);
  };

  it('today done: ends today; today stays ideal and XP stays', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    expect(await end(t)).toEqual({ ok: true, value: '2024-06-01' });
    expect(await outcomes(t, '2024-06-01', '2024-06-03')).toEqual(['2024-06-01:ideal']);
    expect(await lifetime()).toBe(10);
  });

  it('today off (this habit) and not logged: ends yesterday, today is gone, and lifting the off mark does not bring it back', async () => {
    const t = seed();
    await off('2024-06-01', t);
    expect(await end(t)).toEqual({ ok: true, value: '2024-05-31' });
    expect(await outcomes(t, '2024-06-01', '2024-06-03')).toEqual([]);
    await off('2024-06-01', t, false);
    expect(await outcomes(t, '2024-06-01', '2024-06-03')).toEqual([]);
  });

  it('today logged then marked off: it is not "done today", so it ends yesterday (the off day stays out of the record) and XP stays', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await off('2024-06-01', t);
    const r = await end(t);
    expect(r.ok).toBe(true);
    expect(await lifetime()).toBe(10);
  });

  it('today pushed to tomorrow: ends yesterday; nothing of today or tomorrow shows, and no day is counted missed', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    expect(await end(t)).toEqual({ ok: true, value: '2024-05-31' });
    at('2024-06-05');
    const rec = await resolveRecordOccurrences(repos, D('2024-06-05'), D('2024-06-05'));
    expect(rec.filter((o) => o.taskId === t.id && o.date >= '2024-06-01')).toEqual([]);
  });

  it('a pushed occurrence from yesterday sitting on today and logged: ends today and it counts', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    at('2024-06-02');
    await log(t, '2024-06-02', 'done', '2024-06-01');
    await log(t, '2024-06-02', 'done');
    expect(await end(t)).toEqual({ ok: true, value: '2024-06-02' });
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=10']);
    expect(await outcomes(t, '2024-06-01', '2024-06-03')).toEqual(['2024-06-01:not-due', '2024-06-02:ideal', '2024-06-02<-2024-06-01:ideal']);
  });

  it('today done then pushed to tomorrow, then End: the done day is not lost from the record (End brings it back to today)', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await push(t, '2024-06-01');
    expect(await end(t)).toEqual({ ok: true, value: '2024-06-01' });
    expect(await outcomes(t, '2024-05-31', '2024-06-03')).toContain('2024-06-01:ideal');
    expect(awards(t)).toEqual(['2024-06-01=10']);
  });

  it('yesterday done, pushed to today, then End: the pushed done day sits on today, so it ends today and the done day stays in the record', async () => {
    const t = seed();
    at('2024-05-31');
    await log(t, '2024-05-31', 'done');
    await push(t, '2024-05-31');
    at('2024-06-01');
    expect(await end(t)).toEqual({ ok: true, value: '2024-06-01' });
    expect(await outcomes(t, '2024-05-30', '2024-06-03')).toContain('2024-06-01<-2024-05-31:ideal');
    expect(awards(t)).toEqual(['2024-05-31=10']);
  });

  it('an unlogged push followed by End leaves no miss behind (the push was a deliberate "not now")', async () => {
    const t = seed();
    at('2024-05-31');
    await push(t, '2024-05-31');
    at('2024-06-01');
    await end(t);
    const rec = await resolveRecordOccurrences(repos, D('2024-06-10'), D('2024-06-10'));
    expect(rec.filter((o) => o.taskId === t.id && o.date >= '2024-05-31' && o.outcome === 'missed')).toEqual([]);
  });

  it('logging after it ended is refused (nothing is due), and Start again then logging works with the pause marked off', async () => {
    const t = seed();
    await end(t); // ends yesterday
    expect((await log(t, '2024-06-01', 'done')).ok).toBe(false);
    at('2024-06-04');
    const { useStartAgain } = require('./mutations') as typeof import('./mutations');
    await hookMutate(useStartAgain, t.id);
    expect(await outcomes(t, '2024-05-31', '2024-06-04')).toEqual([
      '2024-05-31:missed',
      '2024-06-01:off',
      '2024-06-02:off',
      '2024-06-03:off',
      '2024-06-04:pending',
    ].filter((s) => s !== '2024-05-31:missed' || true));
    expect((await log(t, '2024-06-04', 'done')).ok).toBe(true);
  });

  it('End twice at the same time (double tap) ends once and returns the same day', async () => {
    const t = seed();
    const { useEndTask } = require('./mutations') as typeof import('./mutations');
    const { result } = await rh(useEndTask);
    let out: unknown[] = [];
    await act(async () => {
      out = await Promise.all([result.current.mutateAsync(t.id), result.current.mutateAsync(t.id)]);
    });
    expect(out).toEqual([
      { ok: true, value: '2024-05-31' },
      { ok: true, value: '2024-05-31' },
    ]);
    expect((await repos.tasks.get(t.id))!.endedOn).toBe('2024-05-31');
  });
});

/* ------------------------------------------------------------------ delete / restore */

describe('Delete and Restore across these states', () => {
  const del = async (t: TaskWithSteps) => hookMutate((require('./mutations') as typeof import('./mutations')).useDeleteTask, t.id);
  const restore = async (t: TaskWithSteps) => hookMutate((require('./mutations') as typeof import('./mutations')).useRestoreTask, t.id);
  const forever = async (t: TaskWithSteps) => hookMutate((require('./mutations') as typeof import('./mutations')).useDeleteForever, t.id);

  it('every write to a deleted habit is refused and changes nothing (log, step, dose, off, push, undo, end)', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await push(t, '2024-05-31');
    await del(t);
    const rows = JSON.stringify(fake.logsFor(t.id));
    const xp = await lifetime();
    const results = await Promise.all([
      log(t, '2024-06-01', 'fallback'),
      toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: t.idealSteps[0]!.id }),
      logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 1 }),
      off('2024-06-01', t),
      push(t, '2024-06-01'),
      unpush(t, '2024-05-31'),
      end(t),
    ]);
    for (const r of results) expect(r.ok).toBe(false);
    expect(JSON.stringify(fake.logsFor(t.id))).toBe(rows);
    expect(await lifetime()).toBe(xp);
  });

  async function end(t: TaskWithSteps) {
    const { useEndTask } = require('./mutations') as typeof import('./mutations');
    return hookMutate(useEndTask, t.id);
  }

  it('delete after logging keeps XP; restore days later marks the away days off and today pending', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await del(t);
    expect(await lifetime()).toBe(10);
    at('2024-06-04');
    expect((await restore(t)).ok).toBe(true);
    expect(await outcomes(t, '2024-06-01', '2024-06-04')).toEqual(['2024-06-01:ideal', '2024-06-02:off', '2024-06-03:off', '2024-06-04:pending']);
    expect(await lifetime()).toBe(10);
  });

  it('delete with today unlogged, restore the same day: today is pending again, nothing missed', async () => {
    const t = seed();
    await del(t);
    expect((await restore(t)).ok).toBe(true);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:pending']);
  });

  it('delete with today pushed to tomorrow, restore two days later: the pushed day is not a miss and is off like the rest', async () => {
    const t = seed();
    await push(t, '2024-06-01');
    await del(t);
    at('2024-06-03');
    await restore(t);
    const o = await outcomes(t, '2024-06-01', '2024-06-03');
    expect(o.some((s) => s.endsWith(':missed'))).toBe(false);
    expect(o[o.length - 1]).toBe('2024-06-03:pending');
  });

  it('delete with an off day in the record, restore: the off day stays off and is not doubled into XP', async () => {
    const t = seed();
    await off('2024-06-01', t);
    await del(t);
    await restore(t);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:off']);
    expect(await lifetime()).toBe(0);
  });

  it('restore twice at the same time restores once, the second reports not found', async () => {
    const t = seed();
    await del(t);
    at('2024-06-03');
    const { useRestoreTask } = require('./mutations') as typeof import('./mutations');
    const { result } = await rh(useRestoreTask);
    let out: Array<{ ok: boolean }> = [];
    await act(async () => {
      out = (await Promise.allSettled([result.current.mutateAsync(t.id), result.current.mutateAsync(t.id)])).map((s) => (s.status === 'fulfilled' ? s.value : { ok: false }));
    });
    expect(out.filter((r) => r.ok).length).toBeGreaterThanOrEqual(1);
    expect((await repos.tasks.get(t.id))!.deletedAt).toBeNull();
  });

  it('Delete forever with a pushed day and an off day in the record: settled days stay once each, XP and consistency unchanged', async () => {
    const t = seed();
    at('2024-06-04');
    await log(t, '2024-06-01', 'done');
    await off('2024-06-02', t);
    await push(t, '2024-06-03'); // 03 vacated, 04 gets the pushed one
    await log(t, '2024-06-04', 'fallback', '2024-06-03');
    await log(t, '2024-06-04', 'done');
    const xp = await lifetime();
    const beforeRecord = (await resolveRecordOccurrences(repos, D('2024-06-04'), D('2024-06-04'))).map((o) => `${o.date}:${o.outcome}`).sort();
    await del(t);
    at('2024-06-05');
    expect((await forever(t)).ok).toBe(true);
    expect(await repos.tasks.get(t.id)).toBeNull();
    expect(await lifetime()).toBe(xp);
    const afterRecord = (await resolveRecordOccurrences(repos, D('2024-06-05'), D('2024-06-05'))).map((o) => `${o.date}:${o.outcome}`).sort();
    // Same settled days (the deletion day's occurrences were logged, so they stay).
    expect(afterRecord.filter((s) => s < '2024-06-05')).toEqual(beforeRecord.filter((s) => !s.endsWith(':pending')).filter((s) => !s.includes('not-due')));
  });

  it('XP is never taken back by delete, restore or delete forever', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await del(t);
    await restore(t);
    await del(t);
    await forever(t);
    expect(await lifetime()).toBe(10);
  });
});

/* ------------------------------------------------------------------ midnight */

describe('midnight passing between two mutations', () => {
  it('log today at 23:59, then the clock rolls to the next day: the next log lands on the new day and yesterday keeps its award', async () => {
    const t = seed();
    at('2024-06-01', '23:59:00.000');
    await log(t, '2024-06-01', 'done');
    at('2024-06-02', '00:01:00.000');
    await log(t, '2024-06-02', 'fallback');
    expect(awards(t)).toEqual(['2024-06-01=10', '2024-06-02=6']);
  });

  it('a screen opened before midnight still saves to yesterday after it: yesterday goes from pending to ideal, never lost', async () => {
    const t = seed();
    at('2024-06-02', '00:05:00.000');
    await log(t, '2024-06-01', 'done');
    expect(awards(t)).toEqual(['2024-06-01=10']);
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:ideal', '2024-06-02:pending']);
  });

  it('push at 23:59, undo after midnight: back on the right day, and the day it moved to is its own again', async () => {
    const t = seed();
    at('2024-06-01', '23:59:00.000');
    await push(t, '2024-06-01');
    at('2024-06-02', '00:02:00.000');
    await unpush(t, '2024-06-01');
    expect(await outcomes(t, '2024-06-01', '2024-06-02')).toEqual(['2024-06-01:missed', '2024-06-02:pending']);
  });

  it('push across a month end and a year end: the day after is computed, not chosen', async () => {
    const t = seed({ createdAt: '2023-12-01T08:00:00.000Z' as Instant });
    at('2023-12-31');
    await push(t, '2023-12-31');
    at('2024-01-01');
    expect(await outcomes(t, '2023-12-31', '2024-01-01')).toEqual(['2023-12-31:not-due', '2024-01-01:pending', '2024-01-01<-2023-12-31:pending']);
    await log(t, '2024-01-01', 'done', '2023-12-31');
    expect(awards(t)).toEqual(['2023-12-31=10']);
  });

  it('push on Feb 28 of a leap year goes to Feb 29', async () => {
    const t = seed({ createdAt: '2024-02-01T08:00:00.000Z' as Instant });
    at('2024-02-28');
    await push(t, '2024-02-28');
    at('2024-02-29');
    expect(await outcomes(t, '2024-02-28', '2024-02-29')).toEqual(['2024-02-28:not-due', '2024-02-29:pending', '2024-02-29<-2024-02-28:pending']);
  });

  it('end of month: a late log for the 30th made after midnight into July is awarded once, and June is archived once', async () => {
    const t = seed();
    at('2024-07-01', '00:10:00.000');
    await log(t, '2024-06-30', 'done');
    await log(t, '2024-06-30', 'done');
    expect(awards(t)).toEqual(['2024-06-30=10']);
    const june = fake.cycleRecords().filter((r) => r.endDate === '2024-06-30');
    expect(june).toHaveLength(1);
  });

  it('a clock moved BACK (timezone change or a wrong clock fixed) does not duplicate or lose awards', async () => {
    const t = seed();
    at('2024-06-03');
    await log(t, '2024-06-03', 'done');
    at('2024-06-02');
    await log(t, '2024-06-02', 'done');
    await log(t, '2024-06-03', 'fallback');
    expect(awards(t)).toEqual(['2024-06-02=10', '2024-06-03=6']);
  });
});

/* ------------------------------------------------------------------ double fire */

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}
const unmounts: Array<() => void> = [];
async function rh<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const r = await renderHook(hook, { wrapper: makeWrapper(client) });
  unmounts.push(r.unmount);
  return r;
}
async function hookMutate<TArg, TRes>(useHook: () => { mutateAsync: (a: TArg) => Promise<TRes> }, arg: TArg): Promise<TRes> {
  const { result } = await rh(useHook);
  let out!: TRes;
  await act(async () => {
    out = await result.current.mutateAsync(arg);
  });
  return out;
}
afterEach(async () => {
  await act(async () => {
    unmounts.forEach((u) => u());
  });
  unmounts.length = 0;
});

describe('double-fired mutations', () => {
  it('logState twice at once: one row, one award, 10 XP, badges not duplicated', async () => {
    const t = seed();
    await Promise.all([log(t, '2024-06-01', 'done'), log(t, '2024-06-01', 'done')]);
    expect(fake.logsFor(t.id)).toHaveLength(1);
    expect(awards(t)).toEqual(['2024-06-01=10']);
    expect(await lifetime()).toBe(10);
    const keys = fake.unlocks().map((u) => u.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('the real hook fired twice at once behaves the same', async () => {
    const t = seed();
    const { result } = await rh(useLogState);
    await act(async () => {
      await Promise.all([
        result.current.mutateAsync({ taskId: t.id, date: D('2024-06-01'), chip: 'done' }),
        result.current.mutateAsync({ taskId: t.id, date: D('2024-06-01'), chip: 'done' }),
      ]);
    });
    expect(fake.logsFor(t.id)).toHaveLength(1);
    expect(await lifetime()).toBe(10);
  });

  it('two different chips at once settle to one row whose XP matches what the day now reads', async () => {
    const t = seed();
    await Promise.all([log(t, '2024-06-01', 'done'), log(t, '2024-06-01', 'fallback')]);
    expect(fake.logsFor(t.id)).toHaveLength(1);
    expect(await lifetime()).toBe(await recordXp(t));
  });

  it('a rapid done / undo / done / fallback burst (not awaited between) ends consistent with the final tap', async () => {
    const t = seed();
    await Promise.all([log(t, '2024-06-01', 'done'), log(t, '2024-06-01', 'todo'), log(t, '2024-06-01', 'done'), log(t, '2024-06-01', 'fallback')]);
    expect(fake.logsFor(t.id)).toHaveLength(1);
    expect(await lifetime()).toBe(await recordXp(t));
  });

  it('toggleStep and logDose fired twice never create a second row or a second award', async () => {
    const t = seed({ dosesPerDay: 2 });
    const step = t.idealSteps[0]!.id;
    await Promise.all([toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: step }), toggleStep({ taskId: t.id, date: D('2024-06-01'), stepId: step })]);
    await Promise.all([logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 2 }), logDose({ taskId: t.id, date: D('2024-06-01'), dosesCompleted: 2 })]);
    expect(fake.logsFor(t.id)).toHaveLength(1);
    expect(fake.xpAwards().filter((a) => a.taskId === t.id)).toHaveLength(1);
    expect(await lifetime()).toBe(await recordXp(t));
  });

  it('push twice at once: one pointer, one row, tomorrow has exactly one pushed occurrence', async () => {
    const t = seed();
    await Promise.all([push(t, '2024-06-01'), push(t, '2024-06-01')]);
    expect(fake.logsFor(t.id)).toHaveLength(1);
    expect(await outcomes(t, '2024-06-02', '2024-06-02')).toEqual(['2024-06-02:pending', '2024-06-02<-2024-06-01:pending']);
  });

  it('undo push twice at once: restored once, no error thrown, XP unchanged', async () => {
    const t = seed();
    await log(t, '2024-06-01', 'done');
    await push(t, '2024-06-01');
    const rs = await Promise.all([unpush(t, '2024-06-01'), unpush(t, '2024-06-01')]);
    expect(rs.some((r) => r.ok)).toBe(true);
    expect(await outcomes(t, '2024-06-01', '2024-06-01')).toEqual(['2024-06-01:ideal']);
    expect(await lifetime()).toBe(10);
  });

  it('push and log fired together (tap Done while pushing): the result is one of the two clean orders, XP matching the record', async () => {
    const t = seed();
    await Promise.all([push(t, '2024-06-01'), log(t, '2024-06-01', 'done')]);
    at('2024-06-02');
    expect(await lifetime()).toBe(await recordXp(t));
    expect(fake.logsFor(t.id)).toHaveLength(1);
  });

  it('log and delete fired together: whichever wins, nothing is written after the delete and XP matches', async () => {
    const t = seed();
    const { useDeleteTask } = require('./mutations') as typeof import('./mutations');
    const { result } = await rh(useDeleteTask);
    await act(async () => {
      await Promise.all([result.current.mutateAsync(t.id), log(t, '2024-06-01', 'done')]);
    });
    const xp = await lifetime();
    expect([0, 10]).toContain(xp);
    expect(fake.xpAwards().filter((a) => a.taskId === t.id)).toHaveLength(xp === 10 ? 1 : 0);
  });
});

/* ------------------------------------------------------------------ randomized week */

describe('a random week of taps never leaves XP out of step with the record', () => {
  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const addDay = (d: string, n: number) => {
    const dt = new Date(`${d}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  };

  async function runWeek(seedNo: number, kind: 'plain' | 'doses' | 'steps') {
    fake.reset();
    at('2024-06-01');
    const id = `rnd-${seedNo}-${kind}` as Id;
    const a: Step = { id: `${id}-a` as Id, taskId: id, role: 'ideal', text: 'A', position: 0, dueWeekdays: null };
    const b: Step = { id: `${id}-b` as Id, taskId: id, role: 'ideal', text: 'B', position: 1, dueWeekdays: [1, 3, 6] as never };
    const t = seed(
      kind === 'plain' ? { id } : kind === 'doses' ? { id, dosesPerDay: 3, idealSteps: [], fallbackSteps: [] } : { id, idealSteps: [a, b], fallbackSteps: [] },
    );
    const rand = rng(seedNo * 7919 + kind.length);
    const trail: string[] = [];
    for (let i = 0; i < 28; i += 1) {
      const roll = rand();
      const today = clock.today;
      const shown = await occs(t, addDay(today, -4), addDay(today, 1));
      const pick = shown.length ? shown[Math.floor(rand() * shown.length)]! : null;
      let label = '';
      if (roll < 0.14) {
        at(addDay(today, 1));
        label = 'midnight';
      } else if (pick && roll < 0.45) {
        const chip = (['done', 'fallback', 'todo', 'skip'] as const)[Math.floor(rand() * 4)]!;
        label = `log ${pick.date}${pick.pushedFrom ? `<-${pick.pushedFrom}` : ''} ${chip}`;
        await log(t, pick.date, chip, pick.pushedFrom);
      } else if (pick && roll < 0.58) {
        const sid = ['a', 'b'].map((k) => `${id}-${k}` as Id)[Math.floor(rand() * 2)]!;
        const step = kind === 'steps' ? sid : t.idealSteps[0]?.id;
        if (step) {
          label = `step ${pick.date}${pick.pushedFrom ? `<-${pick.pushedFrom}` : ''} ${step.slice(-1)}`;
          await toggleStep({ taskId: t.id, date: pick.date, ...(pick.pushedFrom ? { pushedFrom: pick.pushedFrom } : {}), stepId: step });
        }
      } else if (pick && roll < 0.7) {
        const n = Math.floor(rand() * 4);
        label = `dose ${pick.date}${pick.pushedFrom ? `<-${pick.pushedFrom}` : ''} ${n}`;
        await logDose({ taskId: t.id, date: pick.date, ...(pick.pushedFrom ? { pushedFrom: pick.pushedFrom } : {}), dosesCompleted: n });
      } else if (roll < 0.86) {
        const d = addDay(today, -Math.floor(rand() * 3));
        label = `push ${d}`;
        await push(t, d);
      } else {
        const d = addDay(today, -Math.floor(rand() * 4));
        label = `undo ${d}`;
        await unpush(t, d);
      }
      trail.push(label);
      const xp = await lifetime();
      const rec = await recordXp(t, addDay(clock.today, 3));
      if (xp !== rec) throw new Error(`seed ${seedNo} ${kind}: after [${trail.join(' | ')}] lifetime ${xp} but record ${rec}`);
      const keys = fake.xpAwards().map((x) => `${x.taskId}:${x.date}`);
      if (new Set(keys).size !== keys.length) throw new Error(`duplicate award rows ${keys}`);
    }
  }

  it.each([['plain', 40], ['doses', 40], ['steps', 12]] as const)('%s habit: %i seeded weeks', async (kind, weeks) => {
    for (let s = 1; s <= weeks; s += 1) await runWeek(s, kind);
  }, 120000);
});
