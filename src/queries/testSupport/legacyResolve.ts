/**
 * Test-only. A frozen copy of the read resolvers as they were BEFORE the round-2 scale pass
 * (one logs query and one off-day query per task, every habit's whole history on every read).
 * The scale tests compare the live resolvers against these on random data, and time both.
 * Never imported by production code. Do not "improve" this file: it is the reference.
 */
import { addDays, toLocalDate } from '@/lib/date';
import { occurrencesBetween, resolveOccurrence, resolvePushedOccurrence } from '@/domain';
import type { LocalDate, Occurrence, Repositories, RetiredDay, TaskWithSteps } from '@/types';

function creationLocalDate(task: TaskWithSteps): LocalDate {
  return toLocalDate(new Date(task.createdAt));
}

function iterationFrom(task: TaskWithSteps, notBefore: LocalDate): LocalDate {
  if (task.type === 'event' && task.eventDate !== null) return task.eventDate;
  if (task.type === 'course' && task.startDate !== null) return task.startDate;
  return notBefore;
}

export async function legacyResolveTaskOccurrences(repos: Repositories, task: TaskWithSteps, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const notBefore = creationLocalDate(task);
  const from = iterationFrom(task, notBefore);
  if (task.endedOn && task.endedOn < to) to = task.endedOn;
  if (from > to) return [];

  const dueDates = occurrencesBetween(task, from, to, notBefore);

  const searchFrom = addDays(from, -1);
  const [logs, offMarks] = await Promise.all([repos.logs.listForTask(task.id, searchFrom, to), repos.offDays.listRange(from, to)]);
  const logByDate = new Map(logs.map((l) => [l.date, l]));

  const allDates = new Set<LocalDate>(dueDates);
  for (const l of logs) {
    if (l.movedToDate !== null && l.movedToDate >= from && l.movedToDate <= to) allDates.add(l.movedToDate);
  }

  return [...allDates].sort().flatMap((date) => {
    const log = logByDate.get(date) ?? null;
    const priorLog = logByDate.get(addDays(date, -1)) ?? null;
    const movedInLog = priorLog && priorLog.movedToDate === date ? priorLog : null;
    const own = resolveOccurrence({ task, date, today, log, offMarks, notBefore, movedInLog });
    if (movedInLog && own.pushedFrom === undefined) {
      return [own, resolvePushedOccurrence({ task, date, today, sourceLog: movedInLog, offMarks, notBefore })];
    }
    return [own];
  });
}

export async function legacyResolveAllOccurrences(repos: Repositories, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const tasks = await repos.tasks.list();
  const perTask = await Promise.all(tasks.map((t) => legacyResolveTaskOccurrences(repos, t, to, today)));
  return perTask.flat();
}

function deletionDay(task: TaskWithSteps): LocalDate | null {
  return task.deletedAt ? toLocalDate(new Date(task.deletedAt)) : null;
}

async function legacyDeletedRecord(repos: Repositories, task: TaskWithSteps, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const day = deletionDay(task);
  if (!day) return [];
  const upTo = day < to ? day : to;
  const occs = await legacyResolveTaskOccurrences(repos, task, upTo, today);
  return occs.filter((o) => o.date < day || (o.date === day && (o.outcome === 'ideal' || o.outcome === 'fallback')));
}

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

export async function legacyResolveRecordOccurrences(repos: Repositories, to: LocalDate, today: LocalDate): Promise<Occurrence[]> {
  const [live, deleted, retired] = await Promise.all([legacyResolveAllOccurrences(repos, to, today), repos.tasks.listDeleted(), repos.retiredDays.list()]);
  const fromDeleted = (await Promise.all(deleted.map((t) => legacyDeletedRecord(repos, t, to, today)))).flat();
  const fromRetired = retired.filter((d) => d.date <= to).map(retiredAsOccurrence);
  return [...live, ...fromDeleted, ...fromRetired];
}
