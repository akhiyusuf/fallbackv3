/** M4 test-only — a minimal, valid `TaskWithSteps` fixture, patchable per test. */
import type { Id, Instant, Step, TaskWithSteps } from '@/types';

export function makeTask(patch: Partial<TaskWithSteps> = {}): TaskWithSteps {
  const id = (patch.id ?? 'task-1') as Id;
  const idealSteps: readonly Step[] = patch.idealSteps ?? [
    { id: 'step-ideal-1' as Id, taskId: id, role: 'ideal', text: 'Warm-up', position: 0, dueWeekdays: null },
  ];
  const fallbackSteps: readonly Step[] = patch.fallbackSteps ?? [
    { id: 'step-fallback-1' as Id, taskId: id, role: 'fallback', text: '10 pushups', position: 0, dueWeekdays: null },
  ];
  return {
    id,
    type: 'routine',
    name: 'Morning workout',
    note: null,
    icon: 'Dumbbell',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: 'high',
    necessity: 'recommended',
    todoDoneAt: null,
    snoozable: true,
    createdAt: '2024-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    idealSteps,
    fallbackSteps,
    ...patch,
  };
}
