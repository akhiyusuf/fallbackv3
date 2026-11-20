/**
 * M3. Joins `useTasks()` + `useToday(date)` into S09's row list — sorted, due-today only.
 *
 * `useToday(date)` resolves through M2's `resolveAllOccurrences`, which (by its own
 * documented construction) walks every live task's occurrence set from its own creation day
 * through `date` — i.e. it returns each task's full history up to and including `date`, not
 * only `date`'s own occurrences. This hook selects the `date === today` slice client-side
 * (never re-deriving due-ness itself — that stays M2's) to get exactly "today's due
 * occurrences". See this module's build report for the upstream contract note.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { today as clockToday } from '@/lib/date';
import { useTasks, useToday } from '@/queries';
import type { LocalDate, Occurrence, TaskWithSteps } from '@/types';

export interface TodayRow {
  readonly task: TaskWithSteps;
  readonly occurrence: Occurrence;
}

/** How often an open Today checks whether midnight has passed. */
const DAY_CHECK_MS = 30_000;

/**
 * Keeps a screen that reads the day on every render rendering across midnight, even when no query
 * result changes (every habit already logged): a timer, and a check on coming back to the app.
 */
export function useDayTick(): void {
  const [, setSeen] = useState<LocalDate>(() => clockToday());
  useEffect(() => {
    const check = () => setSeen(clockToday());
    const id = setInterval(check, DAY_CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearInterval(id);
      sub?.remove();
    };
  }, []);
}

export function useTodayRows() {
  useDayTick();
  const date: LocalDate = clockToday();
  const tasksQuery = useTasks();
  const todayQuery = useToday(date);

  const rows = useMemo<readonly TodayRow[]>(() => {
    const tasks = tasksQuery.data;
    const occurrences = todayQuery.data;
    if (!tasks || !occurrences) return [];
    const taskById = new Map(tasks.map((t) => [t.id, t] as const));
    const due = occurrences.filter((o) => o.date === date && o.outcome !== 'not-due');
    const withTask = due
      .map((occurrence) => ({ occurrence, task: taskById.get(occurrence.taskId) }))
      .filter((r): r is TodayRow => r.task !== undefined);
    return [...withTask].sort((a, b) => {
      const at = a.task.timeOfDay;
      const bt = b.task.timeOfDay;
      if (at === bt) return a.task.name.localeCompare(b.task.name);
      if (at === null) return -1;
      if (bt === null) return 1;
      return at.localeCompare(bt);
    });
  }, [tasksQuery.data, todayQuery.data, date]);

  return {
    date,
    rows,
    isLoading: tasksQuery.isLoading || todayQuery.isLoading,
    isError: tasksQuery.isError || todayQuery.isError,
    hasAnyTaskEver: (tasksQuery.data?.length ?? 0) > 0,
    refetch: () => {
      void tasksQuery.refetch();
      void todayQuery.refetch();
    },
  };
}
