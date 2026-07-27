import type { LocalDate, Task } from '@/types';
import { cadenceSummary } from './cadenceLabel';

function baseTask(patch: Partial<Task>): Pick<Task, 'type' | 'cadence' | 'isAsNeeded' | 'eventDate'> {
  return { type: 'routine', cadence: null, isAsNeeded: false, eventDate: null, ...patch } as Task;
}

describe('cadenceSummary', () => {
  it('matches the S20 fixture verbatim: "Routine · Mon–Sat"', () => {
    const t = baseTask({ type: 'routine', cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5, 6] } });
    expect(cadenceSummary(t)).toBe('Routine · Mon–Sat');
  });

  it('a to-do carries no cadence text', () => {
    expect(cadenceSummary(baseTask({ type: 'todo' }))).toBe('To-do');
  });

  it('an as-needed routine reads "Routine · As-needed"', () => {
    expect(cadenceSummary(baseTask({ type: 'routine', isAsNeeded: true }))).toBe('Routine · As-needed');
  });

  it('a one-off event reads "Event · One-time"', () => {
    expect(cadenceSummary(baseTask({ type: 'event', cadence: null, eventDate: '2026-08-04' as LocalDate }))).toBe('Event · One-time');
  });

  it('a daily course reads "Course · Daily"', () => {
    expect(cadenceSummary(baseTask({ type: 'course', cadence: { kind: 'daily' } }))).toBe('Course · Daily');
  });

  it('non-contiguous weekdays join with slashes', () => {
    const t = baseTask({ cadence: { kind: 'specific-weekdays', weekdays: [1, 3, 5] } });
    expect(cadenceSummary(t)).toBe('Routine · Mon/Wed/Fri');
  });
});
