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
import { addDays, today as clockToday, toLocalDate } from '@/lib/date';
import { designateCarrier, isDue, occurrencesBetween, resolveOccurrence } from '@/domain';
import type { Carrier } from '@/domain';
import type { DayLog, Occurrence, Repositories, TaskWithSteps } from '@/types';
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

  return [...allDates]
    .sort()
    .map((date) => {
      const log = logByDate.get(date) ?? null;
      const priorLog = logByDate.get(addDays(date, -1)) ?? null;
      const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
      return resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog });
    });
}

/**
 * Resolves exactly ONE `(task, date)` occurrence — the SAME lookup `resolveTaskOccurrences`
 * uses, so a mutation's reconciliation and every read resolve through one construction, not
 * two parallel implementations (review pass 2, blocking item N1). `mutations.ts`'s
 * `reconcileOccurrence` calls this instead of resolving inline.
 */
export async function resolveOneOccurrence(repos: Repositories, task: TaskWithSteps, date: LocalDate, today: LocalDate): Promise<Occurrence> {
  const notBefore = creationLocalDate(task);
  const priorDate = addDays(date, -1);
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, priorDate, date), repos.offDays.listRange(date, date)]);
  const log = logs.find((l) => l.date === date) ?? null;
  const priorLog = logs.find((l) => l.date === priorDate) ?? null;
  const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
  return resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog });
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
export async function resolveWriteTarget(repos: Repositories, task: TaskWithSteps, date: LocalDate, today: LocalDate): Promise<WriteTarget> {
  const notBefore = creationLocalDate(task);
  const priorDate = addDays(date, -1);
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, priorDate, date), repos.offDays.listRange(date, date)]);
  const log = logs.find((l) => l.date === date) ?? null;
  const priorLog = logs.find((l) => l.date === priorDate) ?? null;
  const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
  const natural = isDue(task, date, notBefore);
  const carrier = designateCarrier({ log, movedInLog, natural });
  const occurrence = resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog });

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
