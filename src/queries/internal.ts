/**
 * M2 — private helpers shared by `reads.ts` and `mutations.ts`. Not part of the public
 * `@/queries` surface (not re-exported from `index.ts`); every feature module keeps using
 * the documented hooks only.
 */
import { addDays, today as clockToday, toLocalDate } from '@/lib/date';
import { occurrencesBetween, resolveOccurrence } from '@/domain';
import type { DayLog, LocalDate, Occurrence, Repositories, TaskWithSteps } from '@/types';

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
 * Only single-hop chains are resolved: if two DIFFERENT source dates both moved into the
 * same target date (a rare double-move), the entry with the LATER source `date` wins,
 * deterministically — sorting ascending before inserting means the last `.set()` for a given
 * target key is always the most-recently-dated source (review pass 2 non-blocking note; was
 * previously whatever order the repository happened to return, i.e. undefined).
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

/** Every due occurrence of EVERY live (non-deleted) task, for the aggregate scope. */
export async function resolveAllOccurrences(repos: Repositories, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const tasks = await repos.tasks.list();
  const perTask = await Promise.all(tasks.map((t) => resolveTaskOccurrences(repos, t, to, today)));
  return perTask.flat();
}
