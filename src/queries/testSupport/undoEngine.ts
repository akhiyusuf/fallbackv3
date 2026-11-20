/**
 * Edge-case round 4 ("undo everywhere"): the shared engine both undo suites use. A scenario is run
 * TWICE on the same seeded store, from the same start, following the same clock path:
 *
 *   control   = seed + setup + (midnight) + (other habit) + follow-up        (no action, no undo)
 *   treatment = seed + setup + ACTION + (midnight) + (other habit) + UNDO (+ again) + follow-up
 *
 * Then every raw table and every derived read (the record, Today's list, consistency, lifetime and
 * cycling XP) is compared between the two. Ids are replaced by stable labels (H1, H2, H3, C for a
 * copy; steps as H1/s0 ...), and `id` / `updated_at` fields are ignored, so only real differences
 * remain. The control is what "exactly as before" means at the same clock: a day that has passed
 * reads the same whether or not the person tapped anything on it.
 *
 * The suites provide an `UndoEnv` (fake repositories through the real hooks, or real SQLite through
 * the same hooks). Nothing here is imported by production code.
 */
import { addDays } from '@/lib/date';
import { aggregateConsistency } from '@/domain';
import type { Id, LocalDate, Repositories, Step, TaskDraft } from '@/types';

import { recordStartDate, resolveAllOccurrences, resolveRecordOccurrences } from '../internal';

export type Action =
  | 'createTask'
  | 'logState'
  | 'toggleStep'
  | 'logDose'
  | 'markOffDay'
  | 'snooze'
  | 'undoSnooze'
  | 'endTask'
  | 'startAgain'
  | 'deleteTask'
  | 'restoreTask'
  | 'deleteForever'
  | 'duplicate'
  | 'updateTask';

export interface UndoEnv {
  readonly repos: Repositories;
  /** Runs one mutation through its real hook and returns what it resolved to (a Result), or `{ thrown }`. */
  call(action: Action, arg: unknown): Promise<unknown>;
  /** The clock: `today` is the calendar day, `now` noon UTC on that day. */
  setClock(day: LocalDate): void;
  /** Every table, as raw rows. Ids may be present; the engine normalises them. */
  tables(): Promise<Record<string, readonly Record<string, unknown>[]>>;
  /** Empties the store between runs (settings may stay: they are never written by these scenarios). */
  reset(): Promise<void>;
}

export const START_DAY = '2024-06-10' as LocalDate;
const SEED_FROM = '2024-06-01' as LocalDate;
const SEED_TO = '2024-06-09' as LocalDate;

/** Which habit a scenario is about (H1 has steps, H2 is a plain habit, H3 has two doses a day). */
export type Subject = 'H1' | 'H2' | 'H3';

export interface Variant {
  readonly name: string;
  /** The day rolls over between the action and the undo. */
  readonly midnight: boolean;
  /** Another habit is logged between the action and the undo. */
  readonly otherHabit: boolean;
  /** The undo is pressed a second time. */
  readonly twice: boolean;
}

export const VARIANTS: readonly Variant[] = [
  { name: 'same day', midnight: false, otherHabit: false, twice: false },
  { name: 'after midnight', midnight: true, otherHabit: false, twice: false },
  { name: 'another habit logged in between', midnight: false, otherHabit: true, twice: false },
  { name: 'undo pressed twice', midnight: false, otherHabit: false, twice: true },
  { name: 'after midnight, another habit in between, undo twice', midnight: true, otherHabit: true, twice: true },
];

export interface Ctx {
  readonly env: UndoEnv;
  day: LocalDate;
  /** label -> real id (tasks, copies). */
  readonly ids: Map<string, string>;
  /** real id -> label (tasks and steps), used to normalise snapshots. */
  readonly labels: Map<string, string>;
  /** Last result of each action, keyed by action, for scenarios that need what an earlier call returned. */
  readonly last: Map<string, unknown>;
}

export interface Scenario {
  readonly name: string;
  readonly subject: Subject;
  /** Same in the control and the treatment run, before the action. */
  setup?(c: Ctx): Promise<void>;
  /** Treatment only. */
  act(c: Ctx): Promise<void>;
  /** The undo, as the screen would send it. Treatment only, unless `undoInBoth`. */
  undo?(c: Ctx): Promise<void>;
  /** Irreversible scenarios: the undo attempt runs in both runs (it must do nothing). */
  undoInBoth?: boolean;
  /** Same in both runs, after the undo: what the person does next. */
  after?(c: Ctx): Promise<void>;
  /** Records the reason a difference is expected, shown in the report. */
  readonly note?: string;
}

/* ------------------------------------------------------------------ helpers */

function dayOf(c: Ctx): LocalDate {
  return c.day;
}

export function setDay(c: Ctx, day: LocalDate): void {
  c.day = day;
  c.env.setClock(day);
}

export function id(c: Ctx, label: string): Id {
  const real = c.ids.get(label);
  if (!real) throw new Error(`no task labelled ${label}`);
  return real as Id;
}

async function stepIdOf(c: Ctx, label: string, role: 'ideal' | 'fallback', index: number): Promise<Id> {
  const task = await c.env.repos.tasks.get(id(c, label));
  if (!task) throw new Error(`no task ${label}`);
  const steps: readonly Step[] = role === 'ideal' ? task.idealSteps : task.fallbackSteps;
  const step = steps[index];
  if (!step) throw new Error(`no ${role} step ${index} on ${label}`);
  return step.id;
}

function must<T>(result: unknown): T {
  const r = result as { ok?: boolean; thrown?: string; error?: unknown };
  if (r && typeof r === 'object' && 'thrown' in r) throw new Error(`mutation threw: ${r.thrown}`);
  return result as T;
}

/** A mutation that the person can see fail is recorded, not thrown: a rejected undo is a valid outcome. */
export async function attempt(c: Ctx, action: Action, arg: unknown): Promise<unknown> {
  return c.env.call(action, arg);
}

async function createTask(c: Ctx, label: string, draft: TaskDraft): Promise<void> {
  const result = must<{ ok: boolean; value: Id }>(await c.env.call('createTask', draft));
  if (!result.ok) throw new Error(`create ${label} failed`);
  c.ids.set(label, result.value);
  c.labels.set(result.value, label);
  const task = await c.env.repos.tasks.get(result.value);
  task?.idealSteps.forEach((s, i) => c.labels.set(s.id, `${label}/s${i}`));
  task?.fallbackSteps.forEach((s, i) => c.labels.set(s.id, `${label}/f${i}`));
}

const DAILY = { kind: 'daily' } as const;

/**
 * The shared store every scenario starts from: three habits created on 1 June, and a week of history
 * (H1 done each day, H2 done on some days and missed on others, so the record has real misses).
 */
export async function seed(c: Ctx): Promise<void> {
  setDay(c, '2024-06-01' as LocalDate);
  await createTask(c, 'H1', {
    type: 'routine',
    name: 'Walk',
    cadence: DAILY,
    dosesPerDay: 1,
    idealSteps: [{ text: 'Walk 20 minutes', dueWeekdays: null }, { text: 'Stretch', dueWeekdays: null }],
    fallbackSteps: [{ text: 'Two minutes', dueWeekdays: null }],
  });
  await createTask(c, 'H2', {
    type: 'routine',
    name: 'Water',
    cadence: DAILY,
    dosesPerDay: 1,
    idealSteps: [{ text: 'Drink a glass', dueWeekdays: null }],
    fallbackSteps: [{ text: 'Sip water', dueWeekdays: null }],
  });
  await createTask(c, 'H3', {
    type: 'routine',
    name: 'Vitamins',
    cadence: DAILY,
    dosesPerDay: 2,
    idealSteps: [{ text: 'Take vitamins', dueWeekdays: null }],
    fallbackSteps: [{ text: 'One tablet', dueWeekdays: null }],
  });
  const h1Days: string[] = [];
  for (let d = SEED_FROM; d <= SEED_TO; d = addDays(d, 1)) h1Days.push(d);
  const h2Done = new Set(['2024-06-02', '2024-06-05', '2024-06-06', '2024-06-09']);
  for (const day of h1Days) {
    setDay(c, day as LocalDate);
    await logState(c, 'H1', day as LocalDate, 'done');
    if (h2Done.has(day)) await logState(c, 'H2', day as LocalDate, 'done');
  }
  setDay(c, START_DAY);
}

export async function logState(c: Ctx, label: string, date: LocalDate, chip: 'todo' | 'done' | 'fallback' | 'skip'): Promise<unknown> {
  return attempt(c, 'logState', { taskId: id(c, label), date, chip });
}

/** Rolls the clock to the next calendar day, a little after midnight. */
export function advanceDay(c: Ctx): void {
  setDay(c, addDays(c.day, 1));
}

/* ------------------------------------------------------------------ snapshots */

const DROP = new Set(['id', 'updatedAt', 'updated_at']);

/** Replaces ids with labels, drops id and updated_at fields, at any depth. Table rows are sorted. */
export function normalise(value: unknown, labels: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((v) => normalise(v, labels));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DROP.has(k)) continue;
      out[k] = normalise(v, labels);
    }
    return out;
  }
  if (typeof value === 'string') return labels.get(value) ?? value;
  return value;
}

function sortRows(rows: readonly unknown[]): unknown[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export interface Snapshot {
  readonly tables: Record<string, unknown>;
  readonly derived: Record<string, unknown>;
}

export async function snapshot(c: Ctx): Promise<Snapshot> {
  const raw = await c.env.tables();
  const tables: Record<string, unknown> = {};
  for (const [name, rows] of Object.entries(raw)) tables[name] = sortRows(rows.map((r) => normalise(r, c.labels)));

  const repos = c.env.repos;
  const today = dayOf(c);
  const record = await resolveRecordOccurrences(repos, today, today);
  const todayList = await resolveAllOccurrences(repos, today, today);
  const start = (await recordStartDate(repos)) ?? today;
  const consistency = aggregateConsistency({ occurrences: record, window: { from: start, to: today }, today });
  const cycle = await repos.cycleState.get();
  const derived = {
    record: sortRows(record.map((o) => normalise(o, c.labels))),
    today: sortRows(todayList.map((o) => normalise(o, c.labels))),
    consistencyPercent: consistency.percent,
    consistencyBreakdown: normalise(consistency.breakdown, c.labels),
    lifetimeXp: await repos.progress.lifetimeXp(),
    cyclingXp: cycle ? await repos.progress.cyclingXp(cycle.currentCycleId) : null,
    badges: sortRows((await repos.progress.listUnlocks()).map((u) => u.key)),
  };
  return { tables, derived };
}

/* ------------------------------------------------------------------ diffs */

/** Every difference between two values, as readable paths. Arrays compare by index. */
export function diff(a: unknown, b: unknown, path = ''): string[] {
  if (Object.is(a, b)) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = [];
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (i >= a.length) out.push(`${path}[${i}] added ${JSON.stringify(b[i])}`);
      else if (i >= b.length) out.push(`${path}[${i}] removed ${JSON.stringify(a[i])}`);
      else out.push(...diff(a[i], b[i], `${path}[${i}]`));
    }
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: string[] = [];
    for (const k of keys) {
      const av = (a as Record<string, unknown>)[k];
      const bv = (b as Record<string, unknown>)[k];
      if (av === undefined && bv === undefined) continue;
      if (av === undefined) out.push(`${path}.${k} added ${JSON.stringify(bv)}`);
      else if (bv === undefined) out.push(`${path}.${k} removed ${JSON.stringify(av)}`);
      else out.push(...diff(av, bv, `${path}.${k}`));
    }
    return out;
  }
  return [`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`];
}

/* ------------------------------------------------------------------ running */

/**
 * Runs one side of a scenario on a fresh store. `treatment` does the action and undo; `control` does
 * neither. Both follow the same clock path and the same other-habit log.
 */
export async function runSide(env: UndoEnv, scenario: Scenario, variant: Variant, side: 'control' | 'treatment'): Promise<Snapshot> {
  await env.reset();
  const c: Ctx = { env, day: START_DAY, ids: new Map(), labels: new Map(), last: new Map() };
  await seed(c);
  if (scenario.setup) await scenario.setup(c);
  const treat = side === 'treatment';
  if (treat) await scenario.act(c);
  if (variant.midnight) advanceDay(c);
  if (variant.otherHabit) {
    const other: Subject = scenario.subject === 'H2' ? 'H3' : 'H2';
    await logState(c, other, c.day, 'done');
  }
  if (scenario.undo && (treat || scenario.undoInBoth)) {
    await scenario.undo(c);
    if (variant.twice) await scenario.undo(c);
  }
  if (scenario.after) await scenario.after(c);
  return snapshot(c);
}

/** Runs a scenario under one variant and returns every difference between the control and treatment. */
export async function compareScenario(env: UndoEnv, scenario: Scenario, variant: Variant): Promise<{ control: Snapshot; treatment: Snapshot; diffs: string[] }> {
  const control = await runSide(env, scenario, variant, 'control');
  const treatment = await runSide(env, scenario, variant, 'treatment');
  return { control, treatment, diffs: diff(control, treatment) };
}

