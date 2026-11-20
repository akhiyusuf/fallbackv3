/**
 * Mutation-testing survivors for `occurrence.ts` (review/sonnet/32-mutation-testing.md).
 */
import type { Instant, LocalDate, TaskWithSteps } from '@/types';
import { isDue } from './occurrence';

const d = (s: string) => s as LocalDate;

function makeTask(overrides: Partial<TaskWithSteps>): TaskWithSteps {
  return {
    id: 't1' as TaskWithSteps['id'],
    type: 'routine',
    name: 'Test',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: null,
    necessity: null,
    todoDoneAt: null,
    priorityRank: null,
    isNote: false,
    snoozable: true,
    createdAt: '2024-01-01T00:00:00.000Z' as Instant,
    updatedAt: '2024-01-01T00:00:00.000Z' as Instant,
    deletedAt: null,
    endedOn: null,
    idealSteps: [],
    fallbackSteps: [],
    ...overrides,
  };
}

describe('occurrence mutation survivors', () => {
  test('O03: a weekly habit is not due on its weekday BEFORE its anchor date', () => {
    // Anchor Monday 2024-06-10. Mondays before it must not be due; the anchor and later Mondays are.
    const task = makeTask({ cadence: { kind: 'weekly', weekday: 1, anchorDate: d('2024-06-10') } });
    expect(isDue(task, d('2024-06-03'))).toBe(false);
    expect(isDue(task, d('2024-05-27'))).toBe(false);
    expect(isDue(task, d('2024-06-10'))).toBe(true);
    expect(isDue(task, d('2024-06-17'))).toBe(true);
    expect(isDue(task, d('2024-06-11'))).toBe(false);
  });
});
