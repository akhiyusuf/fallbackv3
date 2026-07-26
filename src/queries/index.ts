/**
 * M2. React Query hooks — the ONLY way a feature module reads or writes app data.
 * Reads compose repositories (M1) with the pure domain (M2); writes go through the
 * mutations below, which own XP/achievement/cycle reconciliation and event emission.
 */
export * from './reads';
export * from './mutations';

/**
 * ARCHITECTURE.md §11: "Query keys come from `QUERY_KEYS` only." Review pass 1, blocking
 * item 9 added `taskOccurrences` and `achievements` here — they previously lived as
 * ad-hoc literals in `reads.ts`, invisible to the invalidation map.
 */
export const QUERY_KEYS = {
  /** The canonical, UNFILTERED, non-deleted task list. `useTasks`'s `type` filter is applied
   *  client-side via react-query `select`, never folded into the key (review pass 1, blocking
   *  item 5) — a second, single `includeDeleted` variant covers the one dimension that
   *  genuinely changes the underlying fetch. */
  tasks: ['tasks'] as const,
  tasksIncludingDeleted: ['tasks', 'includeDeleted'] as const,
  task: (id: string) => ['tasks', id] as const,
  today: (date: string) => ['today', date] as const,
  consistency: (scope: string, window: string, taskId?: string) => ['consistency', scope, window, taskId ?? null] as const,
  taskOccurrences: (taskId: string, from: string, to: string) => ['taskOccurrences', taskId, from, to] as const,
  trend: ['trend'] as const,
  progress: ['progress'] as const,
  achievements: ['achievements'] as const,
  records: ['records'] as const,
  settings: ['settings'] as const,
  conversations: ['conversations'] as const,
};
