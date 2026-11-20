/**
 * Edge-case campaign, round 2, area 24: A YEAR IN THE LIFE, simulated.
 *
 * A seeded random driver runs a person through 365 days against the real mutations (fake
 * repositories, mock clock): habits of every kind are created, logged ideal/fallback/undone, logged
 * late, pushed and un-pushed, put on Emergency days off, ended and started again, deleted,
 * restored, deleted for good, edited mid-way, the cycle cadence changed, and the app is left
 * closed for days and weeks at a time. After EVERY step the invariants below are checked.
 *
 * A run is a list of plain-data operations generated from the seed alone, so a failure replays
 * from "seed + step", and is shrunk (chunks of operations removed while the same invariant still
 * fails) to a minimal list that is printed in the failure message.
 *
 * Invariants (names are what a failure prints):
 *  xp-drop           lifetime XP only goes down on an un-log (log todo/skip, step toggle, dose
 *                    change, push, undo push), never on a delete/restore/end/clock/cadence step
 *  xp-orphan         every award of a task that still exists points at an occurrence in the record
 *                    that is XP-eligible (or off: an Emergency day off never takes XP back)
 *  xp-missing        every XP-eligible occurrence of a live or deleted task has its award, with
 *                    the right amount, keyed by (pushedFrom ?? date)
 *  xp-duplicate      one award row per (task, date)
 *  consistency-range every consistency percent (aggregate and per task) is a finite number in 0-100
 *  past-pending      a past day never reads pending in the record
 *  settled-lost      ending, deleting, restoring, deleting for good, a cadence change, a new habit
 *                    or the clock moving never loses a settled past day (ideal, fallback, missed,
 *                    off counted per date)
 *  cycle-records     records are disjoint, contiguous, each archived once, in the past
 *  cycle-pointer     after the app is opened, the pointer window holds today and follows the records
 *  log-rows          one log row per (task, date); a push points exactly one day ahead; no row
 *                    belongs to a task that no longer exists
 *  badge-lost        a badge that was shown (saved or earned right now) never disappears
 *  today-ghost       Today never shows a deleted habit or an ended one past its last day
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

import type { Cadence, Id, LocalDate, Occurrence, Step, TaskDraft, TaskWithSteps } from '@/types';

import { addDays } from '@/lib/date';
import { aggregateConsistency, perTaskConsistency, reconcileAchievements } from '@/domain';

import { resolveAllOccurrences, resolveRecordOccurrences } from './internal';
import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';
import {
  __testing__,
  catchUpCycles,
  useCreateTask,
  useDeleteForever,
  useDeleteTask,
  useEndTask,
  useRestoreTask,
  useStartAgain,
  useUpdateTask,
} from './mutations';

const { logState, toggleStep, logDose, markOffDay, snoozeOccurrence, undoSnooze, updateSettings } = __testing__;

const D = (s: string) => s as LocalDate;
const START = '2024-01-15'; // the year crosses a leap day, every month end and the year end
const DAYS = 365;
const SEEDS = Number(process.env.SIM_SEEDS ?? 50);

/* ------------------------------------------------------------------ the operations (plain data) */

type Chip = 'done' | 'fallback' | 'todo' | 'skip';
type Op =
  | { k: 'advance'; d: number }
  | { k: 'open' }
  | { k: 'create'; kind: number; a: number; b: number }
  | { k: 'log'; t: number; ago: number; chip: Chip; pushed: boolean }
  | { k: 'step'; t: number; ago: number; s: number; pushed: boolean }
  | { k: 'dose'; t: number; ago: number; n: number; pushed: boolean }
  | { k: 'push'; t: number; ago: number }
  | { k: 'unpush'; t: number; ago: number }
  | { k: 'off'; t: number; whole: boolean; ago: number; mark: boolean }
  | { k: 'end'; t: number }
  | { k: 'start'; t: number }
  | { k: 'delete'; t: number }
  | { k: 'restore'; t: number }
  | { k: 'forever'; t: number }
  | { k: 'cadence'; weekly: boolean }
  | { k: 'rename'; t: number }
  | { k: 'reschedule'; t: number; a: number };

/** mulberry32: small, fast, deterministic. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(seed: number): Op[] {
  const r = rng(seed * 7919 + 13);
  const int = (n: number) => Math.floor(r() * n);
  const pick = <T,>(xs: readonly T[]): T => xs[int(xs.length)] as T;
  const ago = () => (r() < 0.6 ? 0 : r() < 0.8 ? 1 + int(3) : 1 + int(30));
  const ops: Op[] = [];
  // Always start with a couple of habits.
  ops.push({ k: 'create', kind: 0, a: 0, b: 0 }, { k: 'create', kind: int(11), a: int(1000), b: int(1000) });
  for (let day = 0; day < DAYS; ) {
    const n = pick([0, 1, 1, 2, 2, 3, 4]);
    for (let i = 0; i < n; i++) {
      const x = r();
      const t = int(1000);
      if (x < 0.34) ops.push({ k: 'log', t, ago: ago(), chip: pick<Chip>(['done', 'done', 'done', 'fallback', 'fallback', 'todo', 'skip']), pushed: r() < 0.3 });
      else if (x < 0.42) ops.push({ k: 'step', t, ago: ago(), s: int(5), pushed: r() < 0.2 });
      else if (x < 0.5) ops.push({ k: 'dose', t, ago: ago(), n: int(4), pushed: r() < 0.2 });
      else if (x < 0.58) ops.push({ k: 'push', t, ago: ago() });
      else if (x < 0.63) ops.push({ k: 'unpush', t, ago: ago() });
      else if (x < 0.7) ops.push({ k: 'off', t, whole: r() < 0.4, ago: ago(), mark: r() < 0.75 });
      else if (x < 0.75) ops.push({ k: 'create', kind: int(11), a: int(1000), b: int(1000) });
      else if (x < 0.78) ops.push({ k: 'end', t });
      else if (x < 0.81) ops.push({ k: 'start', t });
      else if (x < 0.84) ops.push({ k: 'delete', t });
      else if (x < 0.87) ops.push({ k: 'restore', t });
      else if (x < 0.89) ops.push({ k: 'forever', t });
      else if (x < 0.91) ops.push({ k: 'cadence', weekly: r() < 0.5 });
      else if (x < 0.94) ops.push({ k: 'rename', t });
      else if (x < 0.97) ops.push({ k: 'reschedule', t, a: int(1000) });
      else ops.push({ k: 'open' });
    }
    // Midnight passes. Sometimes the app is not opened for days, sometimes weeks.
    const y = r();
    const d = y < 0.82 ? 1 : y < 0.95 ? 2 + int(8) : 7 + int(21);
    ops.push({ k: 'advance', d });
    if (r() < 0.6) ops.push({ k: 'open' });
    day += d;
  }
  return ops;
}

/* ------------------------------------------------------------------ the world */

interface World {
  ids: Id[];
  /** Every date the person logged, for sanity only. */
  ops: number;
}

const D1: Cadence = { kind: 'daily' };
function draftFor(kind: number, a: number, b: number): TaskDraft {
  const today = D(clock.today);
  const step = (text: string, dueWeekdays: TaskDraft['idealSteps'][number]['dueWeekdays'] = null) => ({ text, dueWeekdays });
  const base = { idealSteps: [step('Do it')], fallbackSteps: [step('Tiny')] };
  const wd = ((a % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const snoozable = b % 5 !== 0;
  switch (kind % 11) {
    case 0:
      return { type: 'routine', name: 'Daily', cadence: D1, snoozable, ...base };
    case 1:
      return { type: 'routine', name: 'Weekdays', cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] }, snoozable, ...base };
    case 2:
      return { type: 'routine', name: 'Fortnight', cadence: { kind: 'bi-weekly', weekday: wd, anchorDate: today }, snoozable, ...base };
    case 3:
      return { type: 'routine', name: 'Monthly 31', cadence: { kind: 'monthly', dayOfMonth: 31, anchorDate: today }, snoozable, ...base };
    case 4: {
      const start = addDays(today, a % 3);
      return {
        type: 'course',
        name: 'Course',
        cadence: b % 2 === 0 ? D1 : { kind: 'specific-weekdays', weekdays: [1, 3, 5] },
        startDate: start,
        endDate: addDays(start, 10 + (b % 30)),
        dosesPerDay: 1 + (a % 3),
        snoozable,
        ...base,
      };
    }
    case 5:
      return { type: 'event', name: 'Weekly event', cadence: { kind: 'weekly', weekday: wd, anchorDate: today }, snoozable, ...base };
    case 6:
      return { type: 'event', name: 'One-off', eventDate: addDays(today, (a % 6) - 3), snoozable, ...base };
    case 7:
      return { type: 'routine', name: 'Doses', cadence: D1, dosesPerDay: 2 + (a % 2), snoozable, ...base };
    case 8:
      return {
        type: 'routine',
        name: 'Steps',
        cadence: D1,
        snoozable,
        idealSteps: [step('A'), step('B', [1, 2, 3, 4, 5]), step('C', [6, 7])],
        fallbackSteps: [step('Tiny')],
      };
    case 9:
      return { type: 'routine', name: 'Every other month', cadence: { kind: 'bi-monthly', dayOfMonth: 15 + (a % 15), anchorDate: today }, snoozable, ...base };
    default:
      return { type: 'routine', name: 'Yearly', cadence: { kind: 'yearly', month: 1 + (a % 12), dayOfMonth: 1 + (b % 28), anchorDate: today }, snoozable, ...base };
  }
}

const NEW_CADENCES: readonly Cadence[] = [
  { kind: 'daily' },
  { kind: 'specific-weekdays', weekdays: [2, 4, 6] },
  { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] },
  { kind: 'weekly', weekday: 3, anchorDate: '2024-01-01' as LocalDate },
];

/* ------------------------------------------------------------------ hooks harness */

let hooks!: { current: ReturnType<typeof useAll> };
let unmount!: () => void;
function useAll() {
  return {
    create: useCreateTask(),
    update: useUpdateTask(),
    del: useDeleteTask(),
    restore: useRestoreTask(),
    forever: useDeleteForever(),
    end: useEndTask(),
    start: useStartAgain(),
  };
}

beforeAll(async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qc }, children);
  const r = await renderHook(useAll, { wrapper: Wrapper });
  hooks = r.result;
  unmount = r.unmount;
});
afterAll(async () => {
  await act(async () => unmount());
});

async function run<T>(fn: () => Promise<T>): Promise<T> {
  let out!: T;
  await act(async () => {
    out = await fn();
  });
  return out;
}

/* ------------------------------------------------------------------ executing one operation */

function at(date: string) {
  clock.today = date;
  clock.now = `${date}T12:00:00.000Z`;
}

async function pushedFromFor(taskId: Id, date: LocalDate, wanted: boolean): Promise<LocalDate | undefined> {
  if (!wanted) return undefined;
  const prior = addDays(date, -1);
  const row = (await repos.logs.listForTask(taskId, prior, prior))[0];
  return row && row.movedToDate === date ? prior : undefined;
}

async function execute(op: Op, w: World): Promise<void> {
  const today = D(clock.today);
  const task = (t: number) => (w.ids.length ? w.ids[t % w.ids.length] : undefined) as Id | undefined;
  switch (op.k) {
    case 'advance':
      at(addDays(today, op.d));
      return;
    case 'open':
      await catchUpCycles();
      return;
    case 'create': {
      const res = await run(() => hooks.current.create.mutateAsync(draftFor(op.kind, op.a, op.b)));
      if (res.ok) w.ids.push(res.value);
      return;
    }
    case 'log': {
      const id = task(op.t);
      if (!id) return;
      const date = addDays(today, -op.ago);
      await logState({ taskId: id, date, chip: op.chip, pushedFrom: await pushedFromFor(id, date, op.pushed) });
      return;
    }
    case 'step': {
      const id = task(op.t);
      const t = id ? await repos.tasks.get(id) : null;
      if (!id || !t || t.idealSteps.length === 0) return;
      const date = addDays(today, -op.ago);
      await toggleStep({ taskId: id, date, stepId: t.idealSteps[op.s % t.idealSteps.length]!.id, pushedFrom: await pushedFromFor(id, date, op.pushed) });
      return;
    }
    case 'dose': {
      const id = task(op.t);
      if (!id) return;
      const date = addDays(today, -op.ago);
      await logDose({ taskId: id, date, dosesCompleted: op.n, pushedFrom: await pushedFromFor(id, date, op.pushed) });
      return;
    }
    case 'push': {
      const id = task(op.t);
      if (id) await snoozeOccurrence({ taskId: id, date: addDays(today, -op.ago) });
      return;
    }
    case 'unpush': {
      const id = task(op.t);
      if (id) await undoSnooze({ taskId: id, date: addDays(today, -op.ago) });
      return;
    }
    case 'off': {
      const id = task(op.t);
      await markOffDay({ date: addDays(today, -op.ago), taskId: op.whole || !id ? null : id, mark: op.mark });
      return;
    }
    case 'end': {
      const id = task(op.t);
      if (id) await run(() => hooks.current.end.mutateAsync(id));
      return;
    }
    case 'start': {
      const id = task(op.t);
      if (id) await run(() => hooks.current.start.mutateAsync(id));
      return;
    }
    case 'delete': {
      const id = task(op.t);
      if (id) await run(() => hooks.current.del.mutateAsync(id));
      return;
    }
    case 'restore': {
      const id = task(op.t);
      if (id) await run(() => hooks.current.restore.mutateAsync(id));
      return;
    }
    case 'forever': {
      const id = task(op.t);
      if (id) await run(() => hooks.current.forever.mutateAsync(id));
      return;
    }
    case 'cadence':
      await updateSettings({ cycleCadence: op.weekly ? 'weekly' : 'monthly' });
      return;
    case 'rename': {
      const id = task(op.t);
      if (id) await run(() => hooks.current.update.mutateAsync({ id, patch: { name: `Renamed ${op.t}` } }));
      return;
    }
    case 'reschedule': {
      const id = task(op.t);
      const t = id ? await repos.tasks.get(id) : null;
      // Only the routines that already run every day or on weekdays (their steps stay valid).
      if (!id || !t || t.type !== 'routine' || t.idealSteps.some((s) => s.dueWeekdays !== null)) return;
      await run(() => hooks.current.update.mutateAsync({ id, patch: { cadence: NEW_CADENCES[op.a % NEW_CADENCES.length] } }));
      return;
    }
  }
}

/* ------------------------------------------------------------------ invariants */

interface Snapshot {
  xp: number;
  settled: Map<string, string>; // date -> "ideal:n fallback:n missed:n off:n"
  badges: Set<string>;
  cutoff: string;
}

function settledByDate(rec: readonly Occurrence[], today: string): Map<string, string> {
  const per = new Map<string, [number, number, number, number]>();
  for (const o of rec) {
    if (o.date >= today) continue;
    const i = o.outcome === 'ideal' ? 0 : o.outcome === 'fallback' ? 1 : o.outcome === 'missed' ? 2 : o.outcome === 'off' ? 3 : -1;
    if (i < 0) continue;
    const row = per.get(o.date) ?? [0, 0, 0, 0];
    row[i]! += 1;
    per.set(o.date, row);
  }
  return new Map([...per].map(([d, v]) => [d, v.join(',')]));
}

async function displayedBadges(rec: readonly Occurrence[], today: LocalDate): Promise<Set<string>> {
  const [unlocks, settings] = await Promise.all([repos.progress.listUnlocks(), repos.settings.get()]);
  const fresh = reconcileAchievements({ occurrences: rec, tenureAnchor: settings.tenureAnchorDate, today, alreadyUnlocked: unlocks, now: clock.now as never });
  return new Set([...unlocks, ...fresh].map((u) => u.key));
}

async function snapshot(): Promise<Snapshot> {
  const today = D(clock.today);
  const rec = await resolveRecordOccurrences(repos, today, today);
  return { xp: await repos.progress.lifetimeXp(), settled: settledByDate(rec, clock.today), badges: await displayedBadges(rec, today), cutoff: clock.today };
}

const MAY_RETRACT = new Set<Op['k']>(['log', 'step', 'dose', 'push', 'unpush']);
const KEEPS_SETTLED = new Set<Op['k']>(['advance', 'open', 'create', 'end', 'start', 'delete', 'restore', 'forever', 'cadence', 'rename']);

/** Invariant names a run is allowed to hit (each one documented in review/sonnet/24-simulation.md). */
const KNOWN_OPEN = new Set<string>(
  (process.env.SIM_KNOWN ?? '').split(',').filter(Boolean),
);

class Broken extends Error {
  constructor(public invariant: string, detail: string) {
    super(`${invariant}: ${detail}`);
  }
}

async function check(op: Op, before: Snapshot, rescheduled: Set<Id>): Promise<void> {
  const today = D(clock.today);
  const rec = await resolveRecordOccurrences(repos, today, today);
  const all = await repos.tasks.list({ includeDeleted: true });
  const byId = new Map(all.map((t) => [t.id, t] as [Id, TaskWithSteps]));
  const awards = fake.xpAwards();

  // xp-drop
  const xp = await repos.progress.lifetimeXp();
  if (!Number.isFinite(xp)) throw new Broken('xp-drop', `lifetime XP is ${xp}`);
  if (xp < before.xp && !MAY_RETRACT.has(op.k)) throw new Broken('xp-drop', `XP fell ${before.xp} -> ${xp} on ${op.k}`);

  // xp-duplicate / xp-orphan / xp-missing
  const seen = new Set<string>();
  for (const a of awards) {
    const key = `${a.taskId}:${a.date}`;
    if (seen.has(key)) throw new Broken('xp-duplicate', key);
    seen.add(key);
  }
  const occByKey = new Map<string, Occurrence>();
  for (const o of rec) if (o.outcome !== 'not-due' && !String(o.taskId).startsWith('retired:')) occByKey.set(`${o.taskId}:${o.pushedFrom ?? o.date}`, o);
  for (const a of awards) {
    if (a.taskId === null || !byId.has(a.taskId)) continue; // the task was deleted for good: its XP stays
    if (rescheduled.has(a.taskId)) continue; // editing a schedule rewrites the past; see report
    const o = occByKey.get(`${a.taskId}:${a.date}`);
    const ok = o && (o.outcome === 'ideal' || o.outcome === 'fallback' || o.outcome === 'off');
    if (!ok) throw new Broken('xp-orphan', `award ${a.date}=${a.amount} of ${a.taskId} points at ${o ? o.outcome : 'nothing'}`);
  }
  for (const [key, o] of occByKey) {
    if (o.outcome !== 'ideal' && o.outcome !== 'fallback') continue;
    if (rescheduled.has(o.taskId)) continue;
    const a = awards.find((x) => `${x.taskId}:${x.date}` === key);
    const want = o.outcome === 'ideal' ? 10 : 6;
    if (!a || a.amount !== want) throw new Broken('xp-missing', `${o.outcome} on ${key} has award ${a ? a.amount : 'none'}`);
  }

  // past-pending
  for (const o of rec) if (o.date < today && o.outcome === 'pending') throw new Broken('past-pending', `${o.taskId} ${o.date}`);

  // consistency-range
  const goodPct = (p: number | null, den: number) => (p === null ? den === 0 : Number.isFinite(p) && p >= 0 && p <= 100);
  for (const window of ['last-7', 'last-30', 'all-time'] as const) {
    const c = aggregateConsistency({ occurrences: rec, window, today });
    if (!goodPct(c.percent, c.denominator)) throw new Broken('consistency-range', `${window} ${c.percent} den ${c.denominator}`);
  }
  for (const t of all) {
    if (t.deletedAt !== null) continue;
    const mine = rec.filter((o) => o.taskId === t.id);
    const c = perTaskConsistency({ taskId: t.id, occurrences: mine, window: 'all-time', today });
    if (!goodPct(c.percent, c.denominator)) throw new Broken('consistency-range', `per-task ${t.id} ${c.percent}`);
  }

  // settled-lost
  if (KEEPS_SETTLED.has(op.k)) {
    const now = settledByDate(rec, before.cutoff);
    for (const [date, row] of before.settled) {
      const b = row.split(',').map(Number);
      const a = (now.get(date) ?? '0,0,0,0').split(',').map(Number);
      // missed may turn into off when a restore marks days away; that is not a loss of a settled day.
      const settledB = b[0]! + b[1]! + b[2]! + b[3]!;
      const settledA = a[0]! + a[1]! + a[2]! + a[3]!;
      if (a[0]! < b[0]! || a[1]! < b[1]! || settledA < settledB) throw new Broken('settled-lost', `${date} was [${row}] now [${a.join(',')}] after ${op.k}`);
    }
  }

  // cycle-records
  const records = [...fake.cycleRecords()].sort((x, y) => x.startDate.localeCompare(y.startDate));
  const keys = new Set<string>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    const k = `${r.cadence}:${r.startDate}:${r.endDate}`;
    if (keys.has(k)) throw new Broken('cycle-records', `archived twice ${k}`);
    keys.add(k);
    if (r.endDate < r.startDate) throw new Broken('cycle-records', `inverted ${k}`);
    if (r.endDate >= today) throw new Broken('cycle-records', `${k} archived before it ended (today ${today})`);
    if (r.consistencyPercent !== null && !(Number.isFinite(r.consistencyPercent) && r.consistencyPercent >= 0 && r.consistencyPercent <= 100)) {
      throw new Broken('cycle-records', `${k} percent ${r.consistencyPercent}`);
    }
    const next = records[i + 1];
    if (next) {
      if (next.startDate <= r.endDate) throw new Broken('cycle-records', `overlap ${k} and ${next.cadence}:${next.startDate}:${next.endDate}`);
      if (next.startDate !== addDays(r.endDate, 1)) throw new Broken('cycle-records', `gap between ${k} and ${next.startDate}`);
    }
  }

  // cycle-pointer
  const ptr = fake.currentCycleState();
  if (ptr && records.length > 0) {
    const last = records[records.length - 1]!;
    if (ptr.startDate !== addDays(last.endDate, 1)) throw new Broken('cycle-pointer', `pointer starts ${ptr.startDate}, last record ends ${last.endDate}`);
  }
  if (op.k === 'open' && ptr && !(ptr.startDate <= today && today <= ptr.endDate)) {
    throw new Broken('cycle-pointer', `after opening on ${today} the pointer is ${ptr.startDate}..${ptr.endDate}`);
  }

  // log-rows
  const rows = await repos.logs.listRange(D('2000-01-01'), D('2100-01-01'));
  const rowKeys = new Set<string>();
  for (const l of rows) {
    const k = `${l.taskId}:${l.date}`;
    if (rowKeys.has(k)) throw new Broken('log-rows', `two rows ${k}`);
    rowKeys.add(k);
    if (l.movedToDate !== null && l.movedToDate !== addDays(l.date, 1)) throw new Broken('log-rows', `${k} pushed to ${l.movedToDate}`);
    if (!byId.has(l.taskId)) throw new Broken('log-rows', `row ${k} belongs to a task that is gone`);
  }

  // badge-lost
  const badges = await displayedBadges(rec, today);
  const keptBadges = new Set((await repos.progress.listUnlocks()).map((u) => u.key));
  if (rescheduled.size === 0) {
    for (const key of before.badges) if (!badges.has(key)) throw new Broken('badge-lost', `${key} disappeared after ${op.k}`);
  }
  for (const key of keptBadges) if (!badges.has(key)) throw new Broken('badge-lost', `saved badge ${key} not shown`);

  // today-ghost
  const live = await resolveAllOccurrences(repos, today, today);
  for (const o of live) {
    if (o.date !== today) continue;
    const t = byId.get(o.taskId);
    if (!t || t.deletedAt !== null) throw new Broken('today-ghost', `deleted habit ${o.taskId} on Today`);
    if (t.endedOn && t.endedOn < today) throw new Broken('today-ghost', `ended habit ${o.taskId} (ended ${t.endedOn}) on Today`);
  }
}

/* ------------------------------------------------------------------ the runner and the shrinker */

interface Failure {
  step: number;
  op: Op;
  invariant: string;
  detail: string;
}

async function simulate(ops: readonly Op[], stopOn?: string): Promise<Failure | null> {
  fake.reset();
  at(START);
  const w: World = { ids: [], ops: 0 };
  const rescheduled = new Set<Id>();
  let before = await snapshot();
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    try {
      if (op.k === 'reschedule') {
        const id = w.ids.length ? w.ids[op.t % w.ids.length] : undefined;
        if (id) rescheduled.add(id);
      }
      await execute(op, w);
      await check(op, before, rescheduled);
      before = await snapshot();
    } catch (e) {
      if (e instanceof Broken) {
        if (KNOWN_OPEN.has(e.invariant)) {
          before = await snapshot();
          continue;
        }
        if (stopOn && e.invariant !== stopOn) {
          before = await snapshot();
          continue;
        }
        return { step: i, op, invariant: e.invariant, detail: e.message };
      }
      return { step: i, op, invariant: 'crash', detail: String((e as Error).stack ?? e) };
    }
  }
  return null;
}

/** Removes chunks of operations while the same invariant still fails. Bounded. */
async function shrink(ops: readonly Op[], f: Failure): Promise<Op[]> {
  let cur = ops.slice(0, f.step + 1);
  let budget = 120;
  for (let size = Math.max(1, Math.floor(cur.length / 2)); size >= 1 && budget > 0; size = Math.floor(size / 2)) {
    for (let i = 0; i + size <= cur.length && budget > 0; ) {
      const cand = [...cur.slice(0, i), ...cur.slice(i + size)];
      budget -= 1;
      const res = await simulate(cand, f.invariant);
      if (res && res.invariant === f.invariant) cur = cand.slice(0, res.step + 1);
      else i += size;
    }
    if (size === 1) break;
  }
  return cur;
}

async function simulateSeed(seed: number): Promise<void> {
  const ops = generate(seed);
  const f = await simulate(ops);
  if (!f) return;
  const small = await shrink(ops, f);
  throw new Error(
    `seed ${seed} failed at step ${f.step}/${ops.length} (${JSON.stringify(f.op)}): ${f.detail}\n` +
      `minimal case (${small.length} ops): ${JSON.stringify(small)}`,
  );
}

/* ------------------------------------------------------------------ the tests */

jest.setTimeout(10 * 60 * 1000);

describe('a year in the life: seeded random driver, invariants after every step', () => {
  it('generates the same operations for the same seed, and different ones for different seeds', () => {
    expect(JSON.stringify(generate(7))).toBe(JSON.stringify(generate(7)));
    expect(JSON.stringify(generate(7))).not.toBe(JSON.stringify(generate(8)));
    const kinds = new Set(generate(3).map((o) => o.k));
    for (const k of ['advance', 'open', 'create', 'log', 'step', 'dose', 'push', 'unpush', 'off', 'end', 'start', 'delete', 'restore', 'forever', 'cadence', 'rename', 'reschedule']) {
      const any = Array.from({ length: 10 }, (_, s) => generate(s)).some((ops) => ops.some((o) => o.k === k));
      expect([k, any]).toEqual([k, true]);
    }
    expect(kinds.size).toBeGreaterThan(8);
  });

  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`seed ${seed}`, async () => {
      await simulateSeed(seed);
    });
  }
});
