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
import { addDays, now as clockNow, today as clockToday, toLocalDate } from '@/lib/date';
import { newId } from '@/lib/id';
import { designateCarrier, isDue, occurrencesBetween, purgeCutoff, resolveOccurrence, resolvePushedOccurrence } from '@/domain';
import type { Carrier } from '@/domain';
import { ok } from '@/types';
import type { DayLog, Instant, Occurrence, Repositories, Result, RetiredDay, TaskWithSteps } from '@/types';
import type { LocalDate } from '@/types';

export function todayLocal(): LocalDate {
  return clockToday();
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

/**
 * Every due occurrence of ONE task between its own earliest possible date and `to`, resolved.
 * Fetches `[from − 1, to]` — the single extra leading day is exactly enough to see every
 * possible inbound pointer into the window (one-hop: only `D − 1` can ever point at `D`).
 */
export async function resolveTaskOccurrences(
  repos: Repositories,
  task: TaskWithSteps,
  to: LocalDate,
  today: LocalDate,
): Promise<Occurrence[]> {
  const notBefore = creationLocalDate(task);
  const from = iterationFrom(task, notBefore);
  // An ended habit has nothing after its last day, not even a day pushed onto the next one.
  if (task.endedOn !== null && task.endedOn < to) to = task.endedOn;
  if (from > to) return [];

  const dueDates = occurrencesBetween(task, from, to, notBefore);

  const searchFrom = addDays(from, -1);
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, searchFrom, to), repos.offDays.listRange(from, to)]);
  const logByDate = new Map(logs.map((l) => [l.date, l]));

  const allDates = new Set<LocalDate>(dueDates);
  for (const l of logs) {
    // A row just outside [from, to] (at `from − 1`) can still point INTO the window.
    if (l.movedToDate !== null && l.movedToDate >= from && l.movedToDate <= to) allDates.add(l.movedToDate);
  }

  return [...allDates].sort().flatMap((date) => {
    const log = logByDate.get(date) ?? null;
    const priorLog = logByDate.get(addDays(date, -1)) ?? null;
    const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
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

/** Every due occurrence of EVERY live (non-deleted) task, for the aggregate scope. */
export async function resolveAllOccurrences(repos: Repositories, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const tasks = await repos.tasks.list();
  const perTask = await Promise.all(tasks.map((t) => resolveTaskOccurrences(repos, t, to, today)));
  return perTask.flat();
}

/**
 * The day a deleted task was deleted, on the device's calendar. Its record runs up to the day
 * before; the deletion day itself counts only if it was already logged (deleting a habit you
 * have not done yet today never counts that day as missed).
 */
export function deletionDay(task: TaskWithSteps): LocalDate | null {
  return task.deletedAt ? toLocalDate(new Date(task.deletedAt)) : null;
}

/** A deleted task's past occurrences, as they stood when it was deleted. */
export async function resolveDeletedTaskRecord(repos: Repositories, task: TaskWithSteps, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const day = deletionDay(task);
  if (!day) return [];
  const upTo = day < to ? day : to;
  const occs = await resolveTaskOccurrences(repos, task, upTo, today);
  return occs.filter((o) => o.date < day || (o.date === day && (o.outcome === 'ideal' || o.outcome === 'fallback')));
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
export async function resolveRecordOccurrences(repos: Repositories, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const [live, deleted, retired] = await Promise.all([resolveAllOccurrences(repos, to, today), repos.tasks.listDeleted(), repos.retiredDays.list()]);
  const fromDeleted = (await Promise.all(deleted.map((t) => resolveDeletedTaskRecord(repos, t, to, today)))).flat();
  const fromRetired = retired.filter((d) => d.date <= to).map(retiredAsOccurrence);
  return [...live, ...fromDeleted, ...fromRetired];
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
 * Deletes for good what is in Recently deleted: everything (`all`), or only what has been there
 * past its time. Each item keeps its past days in the record. Stops at the first failure.
 */
export async function retireDeleted(repos: Repositories, which: 'all' | 'expired', nowIso: Instant = clockNow()): Promise<Result<number>> {
  const cutoff = purgeCutoff(nowIso);
  const deleted = await repos.tasks.listDeleted();
  const due = which === 'all' ? deleted : deleted.filter((t) => t.deletedAt !== null && t.deletedAt < cutoff);
  const today = todayLocal();
  let n = 0;
  for (const task of due) {
    const result = await retireForGood(repos, task, today);
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
