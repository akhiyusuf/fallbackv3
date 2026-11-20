/**
 * Priorities — every live task that has an importance, grouped by level, in the person's own
 * order. Placed tasks come first (lowest rank first); tasks not placed yet follow, oldest first.
 */
import { useMemo } from 'react';

import { today } from '@/lib/date';
import { useTasks } from '@/queries';
import type { Importance, LocalDate, TaskWithSteps } from '@/types';

export const PRIORITY_LEVELS: readonly { readonly value: Importance; readonly label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Med' },
  { value: 'low', label: 'Low' },
];

export type PriorityGroups = Record<Importance, readonly TaskWithSteps[]>;

/** Finished things drop out: a done to-do, a note, a course that has ended, a one-off event that has passed, anything ended. */
function isLive(task: TaskWithSteps, date: LocalDate): boolean {
  if (task.endedOn) return false;
  if (task.type === 'todo') return !task.isNote && !task.todoDoneAt;
  if (task.type === 'course') return task.endDate === null || task.endDate >= date;
  if (task.type === 'event' && task.eventDate !== null) return task.eventDate >= date;
  return true;
}

export function groupByImportance(tasks: readonly TaskWithSteps[], date: LocalDate): PriorityGroups {
  const groups: Record<Importance, TaskWithSteps[]> = { high: [], med: [], low: [] };
  for (const task of tasks) {
    if (task.importance && isLive(task, date)) groups[task.importance].push(task);
  }
  for (const level of Object.keys(groups) as Importance[]) {
    groups[level].sort((a, b) => {
      if (a.priorityRank !== null && b.priorityRank !== null) return a.priorityRank - b.priorityRank;
      if (a.priorityRank !== null) return -1;
      if (b.priorityRank !== null) return 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
  }
  return groups;
}

export function usePriorityGroups() {
  const tasksQuery = useTasks();
  const date = today();
  const groups = useMemo(() => groupByImportance(tasksQuery.data ?? [], date), [tasksQuery.data, date]);
  return { groups, isLoading: tasksQuery.isLoading, isError: tasksQuery.isError, refetch: tasksQuery.refetch };
}
