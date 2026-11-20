/**
 * M2 — private helpers shared by `reads.ts` and `mutations.ts`. Not part of the public
 * `@/queries` surface (not re-exported from `index.ts`); every feature module keeps using
 * the documented hooks only.
 *
 * F7 rescope (`docs/SCHEMA.md` §4.2, `docs/PRD.md` §3.7): a `day_log.moved_to_date` pointer is
 * now constrained to exactly `date + 1` — one hop, once. The only date that can ever be
 * "inbound" for a given `D` is `D − 1`, so every lookup below is a fixed one-day window, never
 * a padded search. The old ±60-day `MOVE_SEARCH_PAD_DAYS` scan and its display-side tie-break
 * (`buildMovedInIndex`) are dead: `|inbound(D)| ≤ 1` is now a storage-level invariant
 * (`UNIQUE(task_id, date)` + the one-hop `CHECK`), so there is never more than one candidate to
 * choose between.
 */
import { now as clockNow, today as clockToday, toLocalDate } from '@/lib/date';
import { emit } from '@/lib/events';
import { newId } from '@/lib/id';
import { designateCarrier, isDue, occurrencesBetween, purgeCutoff, reconcileAchievements, resolveOccurrence, resolvePushedOccurrence } from '@/domain';
import type { Carrier } from '@/domain';
import { ok } from '@/types';
import type { DayLog, Instant, LocalDate, Occurrence, OffDayMark, Repositories, Result, RetiredDay, TaskWithSteps } from '@/types';

export function todayLocal(): LocalDate {
  return clockToday();
}

const DAY_MS = 86_400_000;

/** Plain UTC arithmetic; the slow path, for dates outside the table below. */
function addDaysArithmetic(date: LocalDate, n: number): LocalDate {
  const ms = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + n * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10) as LocalDate;
}

/**
 * Every calendar date from 1990 to 2070, in order, built once (it is pure calendar data: it can
 * never go stale). A read shifts dates by a day tens of thousands of times (every day of every
 * habit's history); a table lookup beats both `@/lib/date`'s `addDays` (a local `Date` through
 * date-fns each time) and arithmetic with a `Date` per step.
 */
const TABLE_FIRST_YEAR = 1990;
const TABLE_LAST_YEAR = 2070;
let calendar: { readonly dates: LocalDate[]; readonly index: Map<LocalDate, number> } | null = null;

function calendarTable() {
  if (calendar) return calendar;
  const dates: LocalDate[] = [];
  const index = new Map<LocalDate, number>();
  for (let y = TABLE_FIRST_YEAR; y <= TABLE_LAST_YEAR; y++) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    for (let m = 1; m <= 12; m++) {
      const dim = m === 2 ? (leap ? 29 : 28) : m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
      const prefix = `${y}-${m < 10 ? '0' : ''}${m}-`;
      for (let d = 1; d <= dim; d++) {
        const date = `${prefix}${d < 10 ? '0' : ''}${d}` as LocalDate;
        index.set(date, dates.length);
        dates.push(date);
      }
    }
  }
  calendar = { dates, index };
  return calendar;
}

/** `date + n` calendar days. The same answer as `@/lib/date`'s `addDays`, much faster. */
function addDays(date: LocalDate, n: number): LocalDate {
  const { dates, index } = calendarTable();
  const i = index.get(date);
  if (i === undefined) return addDaysArithmetic(date, n);
  return dates[i + n] ?? addDaysArithmetic(date, n);
}

/**
 * Every date in `[from, to]` the task is due on: the domain's `occurrencesBetween`, with the same
 * `isDue` per day but a cheap day step (the domain's own step re-parses the date every time).
 */
function dueDatesBetween(task: TaskWithSteps, from: LocalDate, to: LocalDate, notBefore: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  if (from > to) return out;
  const { dates, index } = calendarTable();
  const start = index.get(from);
  const end = index.get(to);
  if (start === undefined || end === undefined) {
    // Outside the table (never in real use): the domain's own walk.
    return occurrencesBetween(task, from, to, notBefore);
  }
  for (let i = start; i <= end; i++) {
    const cur = dates[i] as LocalDate;
    if (isDue(task, cur, notBefore)) out.push(cur);
  }
  return out;
}

/**
 * The device-local creation-day bound, as plain `LocalDate` data (review pass 1, blocking
 * item 4). `task.createdAt` is a UTC `Instant`; `src/domain` must not (and cannot) do this
 * conversion itself — see `src/domain/occurrence.ts`'s `isDue` doc comment for why. This is
 * the ONE place in the query layer that does it, via `@/lib/date`'s `toLocalDate`, which
 * reads the `Date` object's LOCAL getters.
 */
function creationLocalDate(task: TaskWithSteps): LocalDate {
  return toLocalDate(new Date(task.createdAt));
}

/**
 * Where to start scanning for due dates, per type — NOT always the creation-day bound
 * (review pass 1 non-blocking note): a one-off Event's occurrence set is exactly its own
 * `eventDate` and a Course's is bounded by its own `startDate`, both of which may legitimately
 * predate the task row's `createdAt` (a backdated, user-chosen date) without that being a
 * fabricated pre-existence occurrence — only a Routine/repeating-Event's cadence-driven set
 * needs the creation-day floor.
 */
function iterationFrom(task: TaskWithSteps, notBefore: LocalDate): LocalDate {
  if (task.type === 'event' && task.eventDate !== null) return task.eventDate;
  if (task.type === 'course' && task.startDate !== null) return task.startDate;
  return notBefore;
}

/** The span one task is resolved over: its own start (or `floor`, when later) to `to`, or null for none. */
interface TaskSpan {
  readonly notBefore: LocalDate;
  readonly from: LocalDate;
  readonly to: LocalDate;
}

function spanFor(task: TaskWithSteps, to: LocalDate, floor?: LocalDate): TaskSpan | null {
  const notBefore = creationLocalDate(task);
  let from = iterationFrom(task, notBefore);
  // An ended habit has nothing after its last day, not even a day pushed onto the next one.
  if (task.endedOn && task.endedOn < to) to = task.endedOn;
  // A later `floor` only trims the days at the start: every date from `floor` on resolves exactly
  // as it would over the whole history (a date's outcome reads its own row, the row before it
  // and its off marks, never anything older).
  if (floor !== undefined && floor > from) from = floor;
  if (from > to) return null;
  return { notBefore, from, to };
}

const NO_MARKS: readonly OffDayMark[] = [];

function groupOffMarks(marks: readonly OffDayMark[]): Map<LocalDate, OffDayMark[]> {
  const byDate = new Map<LocalDate, OffDayMark[]>();
  for (const m of marks) {
    const bucket = byDate.get(m.date);
    if (bucket) bucket.push(m);
    else byDate.set(m.date, [m]);
  }
  return byDate;
}

/**
 * Resolves one task over a span from rows ALREADY read. `offByDate` holds only the marks of one
 * date per key, so each date sees exactly the marks that can matter to it (the domain looks at
 * `mark.date === date` and nothing else), without scanning every mark for every date.
 */
function resolveSpan(
  task: TaskWithSteps,
  span: TaskSpan,
  today: LocalDate,
  logs: readonly DayLog[],
  offByDate: ReadonlyMap<LocalDate, readonly OffDayMark[]>,
): Occurrence[] {
  const { notBefore, from, to } = span;
  const dueDates = dueDatesBetween(task, from, to, notBefore);
  const logByDate = new Map(logs.map((l) => [l.date, l]));

  const allDates = new Set<LocalDate>(dueDates);
  for (const l of logs) {
    // A row just outside [from, to] (at `from - 1`) can still point INTO the window.
    if (l.movedToDate !== null && l.movedToDate >= from && l.movedToDate <= to) allDates.add(l.movedToDate);
  }

  return [...allDates].sort().flatMap((date) => {
    const log = logByDate.get(date) ?? null;
    const priorLog = logByDate.get(addDays(date, -1)) ?? null;
    const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
    const offMarks = offByDate.get(date) ?? NO_MARKS;
    const own = resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog });
    // Additive push: when the day keeps its own occurrence, the one pushed into it is a second
    // occurrence that day, never merged into the first.
    if (movedInLog && own.pushedFrom === undefined) {
      return [own, resolvePushedOccurrence({ task, date, today, sourceLog: movedInLog, offMarks, notBefore })];
    }
    return [own];
  });
}

/**
 * Every due occurrence of ONE task between its own earliest possible date (or `floor`, when
 * later) and `to`, resolved. Fetches `[from - 1, to]` — the single extra leading day is exactly
 * enough to see every possible inbound pointer into the window (one-hop: only `D - 1` can ever
 * point at `D`).
 */
export async function resolveTaskOccurrences(
  repos: Repositories,
  task: TaskWithSteps,
  to: LocalDate,
  today: LocalDate,
  floor?: LocalDate,
): Promise<Occurrence[]> {
  const span = spanFor(task, to, floor);
  if (!span) return [];
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, addDays(span.from, -1), span.to), repos.offDays.listRange(span.from, span.to)]);
  return resolveSpan(task, span, today, logs, groupOffMarks(offMarks));
}

/**
 * Resolves many tasks with TWO reads in all (one range of logs, one of off marks) instead of two
 * per task. Each task is handed exactly the rows its own per-task read would have returned
 * (its own logs from `from - 1` to its `to`), so the result is identical, task by task.
 */
async function resolveMany(
  repos: Repositories,
  items: readonly { readonly task: TaskWithSteps; readonly to: LocalDate }[],
  today: LocalDate,
  floor?: LocalDate,
): Promise<Occurrence[][]> {
  const spans = items.map((i) => spanFor(i.task, i.to, floor));
  let lo: LocalDate | null = null;
  let hi: LocalDate | null = null;
  for (const s of spans) {
    if (!s) continue;
    if (lo === null || s.from < lo) lo = s.from;
    if (hi === null || s.to > hi) hi = s.to;
  }
  if (lo === null || hi === null) return items.map(() => []);

  const [logs, offMarks] = await Promise.all([repos.logs.listRange(addDays(lo, -1), hi), repos.offDays.listRange(lo, hi)]);
  const logsByTask = new Map<string, DayLog[]>();
  for (const l of logs) {
    const bucket = logsByTask.get(l.taskId);
    if (bucket) bucket.push(l);
    else logsByTask.set(l.taskId, [l]);
  }
  const offByDate = groupOffMarks(offMarks);

  return items.map((item, i) => {
    const span = spans[i];
    if (!span) return [];
    const floorDate = addDays(span.from, -1);
    const mine = (logsByTask.get(item.task.id) ?? []).filter((l) => l.date >= floorDate && l.date <= span.to);
    return resolveSpan(item.task, span, today, mine, offByDate);
  });
}

/**
 * Resolves exactly ONE `(task, date)` occurrence — the SAME lookup `resolveTaskOccurrences`
 * uses, so a mutation's reconciliation and every read resolve through one construction, not
 * two parallel implementations (review pass 2, blocking item N1). `mutations.ts`'s
 * `reconcileOccurrence` calls this instead of resolving inline.
 */
export async function resolveOneOccurrence(
  repos: Repositories,
  task: TaskWithSteps,
  date: LocalDate,
  today: LocalDate,
  pushedFrom?: LocalDate,
): Promise<Occurrence> {
  const notBefore = creationLocalDate(task);
  const priorDate = addDays(date, -1);
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, priorDate, date), repos.offDays.listRange(date, date)]);
  const log = logs.find((l) => l.date === date) ?? null;
  const priorLog = logs.find((l) => l.date === priorDate) ?? null;
  const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
  const own = resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog });
  // The pushed occurrence that sits beside the day's own one (additive push), when asked for.
  if (pushedFrom !== undefined && pushedFrom === priorDate && movedInLog && own.pushedFrom === undefined) {
    return resolvePushedOccurrence({ task, date, today, sourceLog: movedInLog, offMarks, notBefore });
  }
  return own;
}

export interface WriteTarget {
  /** The resolved occurrence AT the tapped date `D` — reused so callers don't re-resolve. */
  readonly occurrence: Occurrence;
  readonly carrier: Carrier;
  /**
   * The date whose ROW must actually be written: `D` itself for `own-live`/`own-create`, or
   * the winning visitor's own SOURCE date for `visitor` (always `D − 1` now, never `D`, per
   * T-2 — a residue row at `D` is never touched by a write).
   */
  readonly targetDate: LocalDate;
  /** The existing row at `targetDate`, if any (own row or the visitor's own row). */
  readonly existing: DayLog | null;
}

/**
 * SCHEMA.md §4.2, "Write-side carrier selection" (T-1/T-2) — the write-side twin of
 * `resolveOneOccurrence`. Resolves `D` through the exact same `designateCarrier` decision
 * `resolveOccurrence` (the read path) uses — see that function's doc comment: **no second
 * implementation of the clause selection may exist**. Every occurrence-data mutation
 * (`logState`, `toggleStep`, `useLogDose`) calls this FIRST: `carrier.kind === 'none'` is
 * T-1's rejection (nothing resolves at `D` — a vacated source, or a plainly not-due date);
 * otherwise `targetDate`/`existing` tell the caller exactly which row to upsert (T-2), never
 * the raw tapped-date row when a visitor is the occurrence.
 */
export async function resolveWriteTarget(
  repos: Repositories,
  task: TaskWithSteps,
  date: LocalDate,
  today: LocalDate,
  pushedFrom?: LocalDate,
): Promise<WriteTarget> {
  const notBefore = creationLocalDate(task);
  const priorDate = addDays(date, -1);
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, priorDate, date), repos.offDays.listRange(date, date)]);
  const log = logs.find((l) => l.date === date) ?? null;
  const priorLog = logs.find((l) => l.date === priorDate) ?? null;
  const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
  const natural = isDue(task, date, notBefore);
  const carrier = designateCarrier({ log, movedInLog, natural });
  const occurrence = resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog });

  // Additive push: a write addressed to the pushed occurrence (the one beside the day's own)
  // goes to its source row. Anything else asked of a pushed date that has no such occurrence
  // resolves to nothing, so no write can land on the wrong row.
  if (pushedFrom !== undefined) {
    if (pushedFrom === priorDate && movedInLog) {
      if (carrier.kind === 'visitor') return { occurrence, carrier, targetDate: carrier.row.date, existing: carrier.row };
      const pushed = resolvePushedOccurrence({ task, date, today, sourceLog: movedInLog, offMarks, notBefore });
      return { occurrence: pushed, carrier: { kind: 'visitor', row: movedInLog }, targetDate: movedInLog.date, existing: movedInLog };
    }
    return { occurrence, carrier: { kind: 'none' }, targetDate: date, existing: log };
  }

  if (carrier.kind === 'visitor') return { occurrence, carrier, targetDate: carrier.row.date, existing: carrier.row };
  // 'own-live', 'own-create', and 'none' all address D's own row (T-1 rejects 'none' before
  // any write is attempted — the caller never actually upserts in that case).
  return { occurrence, carrier, targetDate: date, existing: log };
}

/**
 * Every due occurrence of EVERY live (non-deleted) task, for the aggregate scope. With `floor`,
 * only the dates from `floor` on (the same occurrences the whole history would give for them).
 */
export async function resolveAllOccurrences(repos: Repositories, to: LocalDate, today: LocalDate, floor?: LocalDate): Promise<Occurrence[]> {
  const tasks = await repos.tasks.list();
  return (await resolveMany(repos, tasks.map((task) => ({ task, to })), today, floor)).flat();
}

/**
 * The day a deleted task was deleted, on the device's calendar. Its record runs up to the day
 * before; the deletion day itself counts only if it was already logged (deleting a habit you
 * have not done yet today never counts that day as missed).
 */
export function deletionDay(task: TaskWithSteps): LocalDate | null {
  return task.deletedAt ? toLocalDate(new Date(task.deletedAt)) : null;
}

/** Keeps what a deleted task's record shows: days before its deletion day, and that day only if logged. */
function deletedRecordOf(task: TaskWithSteps, occs: readonly Occurrence[]): Occurrence[] {
  const day = deletionDay(task);
  if (!day) return [];
  return occs.filter((o) => o.date < day || (o.date === day && (o.outcome === 'ideal' || o.outcome === 'fallback')));
}

/** A deleted task's past occurrences, as they stood when it was deleted. */
export async function resolveDeletedTaskRecord(repos: Repositories, task: TaskWithSteps, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const day = deletionDay(task);
  if (!day) return [];
  const upTo = day < to ? day : to;
  return deletedRecordOf(task, await resolveTaskOccurrences(repos, task, upTo, today));
}

/** A retired day as an occurrence, for the record only (it belongs to no task anywhere). */
function retiredAsOccurrence(day: RetiredDay, index: number): Occurrence {
  return {
    taskId: `retired:${index}` as Occurrence['taskId'],
    date: day.date,
    outcome: day.outcome,
    dueIdealStepIds: [],
    completedStepIds: [],
    chipState: day.outcome === 'ideal' ? 'done' : day.outcome === 'fallback' ? 'fallback' : null,
    dosesRequired: 1,
    dosesCompleted: 0,
  };
}

/**
 * The person's RECORD: everything that ever counted, up to `to`. Live tasks (ended ones up to
 * their last day), deleted ones up to the day they were deleted, and the anonymous days of those
 * deleted for good. Consistency, trend, records and badges read this; Today and the lists read
 * `resolveAllOccurrences` (live tasks only).
 */
export async function resolveRecordOccurrences(repos: Repositories, to: LocalDate, today: LocalDate, floor?: LocalDate): Promise<Occurrence[]> {
  const [live, deleted, retired] = await Promise.all([repos.tasks.list(), repos.tasks.listDeleted(), repos.retiredDays.list()]);
  const items = [
    ...live.map((task) => ({ task, to })),
    ...deleted.map((task) => {
      const day = deletionDay(task);
      return { task, to: day && day < to ? day : to };
    }),
  ];
  // One pair of range reads for every habit, live and deleted.
  const resolved = await resolveMany(repos, items, today, floor);
  const fromLive = resolved.slice(0, live.length).flat();
  const fromDeleted = deleted.flatMap((task, i) => deletedRecordOf(task, resolved[live.length + i] ?? []));
  // Ids are the position among the days up to `to` (not among the trimmed ones), so a trimmed
  // read gives each retired day the id it would have had in the whole record.
  const fromRetired = retired
    .filter((d) => d.date <= to)
    .map(retiredAsOccurrence)
    .filter((o) => floor === undefined || o.date >= floor);
  return [...fromLive, ...fromDeleted, ...fromRetired];
}

/**
 * The first day the record covers: the earliest creation day of any habit, live or deleted, or
 * the earliest retired day. Null when there is nothing at all.
 */
export async function recordStartDate(repos: Repositories): Promise<LocalDate | null> {
  const [live, deleted, retired] = await Promise.all([repos.tasks.list(), repos.tasks.listDeleted(), repos.retiredDays.list()]);
  let earliest: LocalDate | null = null;
  for (const t of [...live, ...deleted]) {
    const created = toLocalDate(new Date(t.createdAt));
    if (earliest === null || created < earliest) earliest = created;
  }
  for (const d of retired) if (earliest === null || d.date < earliest) earliest = d.date;
  return earliest;
}

const KEPT_OUTCOMES = new Set<Occurrence['outcome']>(['ideal', 'fallback', 'missed', 'off']);

/** The days a deleted task leaves in the record when it goes for good: settled days only. */
export async function recordToKeep(repos: Repositories, task: TaskWithSteps, today: LocalDate, retiredAt: Instant): Promise<RetiredDay[]> {
  const occs = await resolveDeletedTaskRecord(repos, task, today, today);
  return occs.filter((o) => KEPT_OUTCOMES.has(o.outcome)).map((o) => ({ date: o.date, outcome: o.outcome as RetiredDay['outcome'], retiredAt }));
}

/** Deletes one item in Recently deleted for good, keeping its past days in the record. */
export async function retireForGood(repos: Repositories, task: TaskWithSteps, today: LocalDate = todayLocal()): Promise<Result<void>> {
  const keep = await recordToKeep(repos, task, today, clockNow());
  return repos.tasks.deleteForever(task.id, keep);
}

/**
 * Persists `fallback-comeback` BEFORE any habit's days are removed. Its condition is per habit (a
 * missed day then a showed-up day on the SAME habit), but retired days are anonymous (no task id),
 * so once a habit's days are retired no later read can see that comeback. Every other badge is
 * read from dates and totals that retirement keeps, so it is left to the usual reconcile.
 * Upsert-only, as with every unlock.
 */
export async function keepBadgesBeforeRetiring(repos: Repositories, today: LocalDate, now: Instant): Promise<void> {
  const [unlocks, settings, occs] = await Promise.all([
    repos.progress.listUnlocks(),
    repos.settings.get(),
    resolveRecordOccurrences(repos, today, today),
  ]);
  const fresh = reconcileAchievements({ occurrences: occs, tenureAnchor: settings.tenureAnchorDate, today, alreadyUnlocked: unlocks, now });
  for (const u of fresh) {
    if (u.key !== 'fallback-comeback') continue;
    const result = await repos.progress.upsertUnlock(u);
    if (result.ok) emit({ type: 'badge:unlocked', key: u.key });
  }
}

/**
 * Deletes for good what is in Recently deleted: everything (`all`), or only what has been there
 * past its time. Each item keeps its past days in the record. Stops at the first failure.
 */
export async function retireDeleted(repos: Repositories, which: 'all' | 'expired', nowIso: Instant = clockNow()): Promise<Result<number>> {
  const cutoff = purgeCutoff(nowIso);
  const deleted = await repos.tasks.listDeleted();
  const due = which === 'all' ? deleted : deleted.filter((t) => t.deletedAt !== null && t.deletedAt < cutoff);
  const today = todayLocal();
  if (due.length > 0) await keepBadgesBeforeRetiring(repos, today, nowIso);
  let n = 0;
  for (const task of due) {
    const result = await retireForGood(repos, task, today);
    // Restored (or already removed) since the list was read: not ours to remove any more.
    if (!result.ok && result.error.code === 'NOT_FOUND') continue;
    if (!result.ok) return result;
    n += 1;
  }
  return ok(n);
}

/**
 * Marks a task off on each day it was due in `[from, to]`: the days it was away (deleted, or
 * ended) are then neither missed nor done when it comes back.
 */
export async function markAwayDaysOff(repos: Repositories, task: TaskWithSteps, from: LocalDate, to: LocalDate): Promise<Result<void>> {
  if (from > to) return ok(undefined);
  const notBefore = creationLocalDate(task);
  const createdAt = clockNow();
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (!isDue(task, date, notBefore)) continue;
    const result = await repos.offDays.mark({ id: newId(), date, taskId: task.id, priorChipState: null, createdAt });
    if (!result.ok) return result;
  }
  return ok(undefined);
}
