/**
 * M2 — private helpers shared by `reads.ts` and `mutations.ts`. Not part of the public
 * `@/queries` surface (not re-exported from `index.ts`); every feature module keeps using
 * the documented hooks only.
 */
import { today as clockToday } from '@/lib/date';
import { occurrencesBetween } from '@/domain';
import { resolveOccurrence } from '@/domain';
import { instantToLocalDate } from '../domain/dateMath';
import type { LocalDate, Occurrence, Repositories, TaskWithSteps } from '@/types';

export function todayLocal(): LocalDate {
  return clockToday();
}

/** Every due occurrence of ONE task between its own creation and `to` (inclusive), resolved. */
export async function resolveTaskOccurrences(
  repos: Repositories,
  task: TaskWithSteps,
  to: LocalDate,
  today: LocalDate,
): Promise<Occurrence[]> {
  const from = instantToLocalDate(task.createdAt);
  if (from > to) return [];
  const dueDates = occurrencesBetween(task, from, to);
  if (dueDates.length === 0) return [];
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, from, to), repos.offDays.listRange(from, to)]);
  const logByDate = new Map(logs.map((l) => [l.date, l]));
  return dueDates.map((date) => resolveOccurrence({ task, date, today, log: logByDate.get(date) ?? null, offMarks }));
}

/** Every due occurrence of EVERY live (non-deleted) task, for the aggregate scope. */
export async function resolveAllOccurrences(repos: Repositories, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const tasks = await repos.tasks.list();
  const perTask = await Promise.all(tasks.map((t) => resolveTaskOccurrences(repos, t, to, today)));
  return perTask.flat();
}
