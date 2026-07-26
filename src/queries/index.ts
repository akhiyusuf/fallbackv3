/**
 * M2. React Query hooks — the ONLY way a feature module reads or writes app data.
 * Reads compose repositories (M1) with the pure domain (M2); writes go through the
 * mutations below, which own XP/achievement/cycle reconciliation and event emission.
 * STUB — M2 implements.
 */
export * from './reads';
export * from './mutations';
export const QUERY_KEYS = {
  tasks: ['tasks'] as const,
  task: (id: string) => ['tasks', id] as const,
  today: (date: string) => ['today', date] as const,
  consistency: (scope: string, window: string, taskId?: string) => ['consistency', scope, window, taskId ?? null] as const,
  trend: ['trend'] as const,
  progress: ['progress'] as const,
  records: ['records'] as const,
  settings: ['settings'] as const,
  conversations: ['conversations'] as const,
};
