/**
 * M2 — private helpers shared by `reads.ts` and `mutations.ts`. Not part of the public
 * `@/queries` surface (not re-exported from `index.ts`); every feature module keeps using
 * the documented hooks only.
 */
import { addDays, today as clockToday, toLocalDate } from '@/lib/date';
import { designateCarrier, isDue, occurrencesBetween, resolveOccurrence } from '@/domain';
import type { Carrier } from '@/domain';
import type { DayLog, Id, LocalDate, Occurrence, Repositories, TaskWithSteps } from '@/types';

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
 * How far outside [from, to] to search for an F7 move landing inside it (review pass 1,
 * blocking item 6). Bounded rather than unbounded — a snooze/move realistically lands within
 * weeks, not years, of its source date; this keeps the query O(bounded range) instead of
 * O(whole history) on every resolve. Exported so `useMoveOccurrence` (mutations.ts) can
 * reject a move past this bound up front (review pass 2 non-blocking note) rather than
 * silently dropping the occurrence from every future read while leaving the source vacated.
 */
export const MOVE_SEARCH_PAD_DAYS = 60;

/**
 * The READ-side tie-break for `movedInLog` (ADVICE-M2.md Ruling 1's `inbound(D)`, display
 * form): if two DIFFERENT source dates both point at the same target date (C8's double
 * inbound), the entry with the LATER source `date` wins, deterministically — sorting
 * ascending before inserting means the last `.set()` for a given target key is always the
 * most-recently-dated source (review pass 2 non-blocking note; was previously whatever order
 * the repository happened to return, i.e. undefined). The WRITE side (`findInboundLogs`
 * below) does not tie-break — it returns every matching row, because redirecting a visiting
 * occurrence away must move every inbound pointer aimed at it, not just the displayed one.
 */
function buildMovedInIndex(logs: readonly DayLog[], from: LocalDate, to: LocalDate): Map<LocalDate, DayLog> {
  const candidates = logs
    .filter((l) => l.movedToDate !== null && l.movedToDate >= from && l.movedToDate <= to)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const map = new Map<LocalDate, DayLog>();
  for (const l of candidates) map.set(l.movedToDate as LocalDate, l);
  return map;
}

async function fetchMoveWindowLogs(repos: Repositories, taskId: TaskWithSteps['id'], from: LocalDate, to: LocalDate): Promise<readonly DayLog[]> {
  const searchFrom = addDays(from, -MOVE_SEARCH_PAD_DAYS);
  const searchTo = addDays(to, MOVE_SEARCH_PAD_DAYS);
  return repos.logs.listForTask(taskId, searchFrom, searchTo);
}

/**
 * ADVICE-M2.md Ruling 1 — `inbound(D)`: EVERY row whose `movedToDate === D`, within the
 * bounded search window, sorted ascending by source date. This is deliberately NOT the same
 * as the read side's `buildMovedInIndex` (which tie-breaks down to one winner for display):
 * `useMoveOccurrence`'s write-side branch selection ("the branch is chosen by inbound(F),
 * nothing else", W-3) needs every matching row so a double-inbound date (C8) redirects all
 * of them, not just the one the read side currently shows.
 */
export async function findInboundLogs(repos: Repositories, taskId: Id, date: LocalDate): Promise<DayLog[]> {
  const logs = await fetchMoveWindowLogs(repos, taskId, date, date);
  return logs.filter((l) => l.movedToDate === date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Every due occurrence of ONE task between its own earliest possible date and `to`, resolved. */
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

  const [logs, offMarks] = await Promise.all([fetchMoveWindowLogs(repos, task.id, from, to), repos.offDays.listRange(from, to)]);

  const logByDate = new Map(logs.map((l) => [l.date, l]));
  const movedInByDate = buildMovedInIndex(logs, from, to);

  const allDates = new Set<LocalDate>(dueDates);
  for (const target of movedInByDate.keys()) allDates.add(target);

  return [...allDates]
    .sort()
    .map((date) =>
      resolveOccurrence({
        task,
        date,
        today,
        log: logByDate.get(date) ?? null,
        offMarks,
        notBefore,
        movedInLog: movedInByDate.get(date) ?? null,
      }),
    );
}

/**
 * Resolves exactly ONE `(task, date)` occurrence — the SAME move lookup and the SAME
 * precedence `resolveTaskOccurrences` uses, so a mutation's reconciliation and every read
 * resolve through one construction, not two parallel implementations (review pass 2,
 * blocking item N1: `reconcileOccurrence` in `mutations.ts` previously called
 * `resolveOccurrence` directly, without ever looking up `movedInLog`, so a moved-then-
 * completed occurrence diverged between what the mutation awarded XP for and what every read
 * displayed). `mutations.ts`'s `reconcileOccurrence` calls this instead of resolving inline.
 */
export async function resolveOneOccurrence(repos: Repositories, task: TaskWithSteps, date: LocalDate, today: LocalDate): Promise<Occurrence> {
  const notBefore = creationLocalDate(task);
  const [logs, offMarks] = await Promise.all([fetchMoveWindowLogs(repos, task.id, date, date), repos.offDays.listRange(date, date)]);
  const log = logs.find((l) => l.date === date) ?? null;
  const movedInByDate = buildMovedInIndex(logs, date, date);
  return resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog: movedInByDate.get(date) ?? null });
}

export interface WriteTarget {
  /** The resolved occurrence AT the tapped date `D` — reused so callers don't re-resolve. */
  readonly occurrence: Occurrence;
  readonly carrier: Carrier;
  /**
   * The date whose ROW must actually be written: `D` itself for `own-live`/`own-create`, or
   * the winning visitor's own SOURCE date for `visitor` (never `D`, per T-2 — a residue row at
   * `D` is never touched by a write).
   */
  readonly targetDate: LocalDate;
  /** The existing row at `targetDate`, if any (own row or the visitor's own row). */
  readonly existing: DayLog | null;
}

/**
 * ADVICE-M2.md Supplement B, B1/T-1/T-2 — the write-side twin of `resolveOneOccurrence`.
 * Resolves `D` through the exact same `designateCarrier` decision `resolveOccurrence` (the
 * read path) uses — see that function's doc comment: no second implementation of the clause
 * selection may exist. Every occurrence-data mutation (`logState`, `toggleStep`,
 * `useLogDose`) calls this FIRST: `carrier.kind === 'none'` is T-1's rejection (nothing
 * resolves at `D` — a vacated source, or a plainly not-due date); otherwise `targetDate` /
 * `existing` tell the caller exactly which row to upsert (T-2), never the raw tapped-date row
 * when a visitor is the occurrence.
 */
export async function resolveWriteTarget(repos: Repositories, task: TaskWithSteps, date: LocalDate, today: LocalDate): Promise<WriteTarget> {
  const notBefore = creationLocalDate(task);
  const [logs, offMarks] = await Promise.all([fetchMoveWindowLogs(repos, task.id, date, date), repos.offDays.listRange(date, date)]);
  const log = logs.find((l) => l.date === date) ?? null;
  const movedInLog = buildMovedInIndex(logs, date, date).get(date) ?? null;
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
