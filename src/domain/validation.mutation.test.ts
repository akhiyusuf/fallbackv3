/**
 * Mutation-testing survivors for `validation.ts` (review/sonnet/32-mutation-testing.md).
 */
import type { LocalDate, TaskDraft } from '@/types';
import { validateTaskDraft } from './validation';

const d = (s: string) => s as LocalDate;

function draft(overrides: Partial<TaskDraft>): TaskDraft {
  return {
    type: 'routine',
    name: 'Studying',
    isAsNeeded: false,
    isTracked: true,
    cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] },
    idealSteps: [{ text: 'Read', dueWeekdays: null }],
    fallbackSteps: [{ text: 'Skim', dueWeekdays: null }],
    ...overrides,
  };
}

function course(overrides: Partial<TaskDraft>): TaskDraft {
  return draft({
    type: 'course',
    cadence: { kind: 'daily' },
    startDate: d('2024-06-01'),
    endDate: d('2024-06-10'),
    dosesPerDay: 1,
    ...overrides,
  });
}

describe('validation mutation survivors', () => {
  test('V02: a one-day Course (end date equal to start date) is valid', () => {
    expect(validateTaskDraft(course({ startDate: d('2024-06-05'), endDate: d('2024-06-05') })).ok).toBe(true);
    const r = validateTaskDraft(course({ startDate: d('2024-06-05'), endDate: d('2024-06-04') }));
    expect(r.ok).toBe(false);
  });

  test('V03: zero doses a day is rejected, one is fine', () => {
    const zero = validateTaskDraft(course({ dosesPerDay: 0 }));
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error.fields?.dosesPerDay).toBeDefined();
    expect(validateTaskDraft(course({ dosesPerDay: 1 })).ok).toBe(true);
    expect(validateTaskDraft(course({ dosesPerDay: -2 })).ok).toBe(false);
  });

  test('V04: a Routine whose isTracked was never set is tracked, so it needs ideal and fallback steps', () => {
    const base = draft({ idealSteps: [], fallbackSteps: [] });
    const { isTracked: _drop, ...noFlag } = base;
    const r = validateTaskDraft(noFlag as TaskDraft);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.fields?.idealSteps).toBeDefined();
      expect(r.error.fields?.fallbackSteps).toBeDefined();
    }
  });

  test('V04b: an explicitly untracked Routine needs no steps', () => {
    expect(validateTaskDraft(draft({ isTracked: false, idealSteps: [], fallbackSteps: [] })).ok).toBe(true);
  });

  test('V05: a Course always needs ideal and fallback steps', () => {
    const r = validateTaskDraft(course({ idealSteps: [], fallbackSteps: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.fields?.idealSteps).toBeDefined();
      expect(r.error.fields?.fallbackSteps).toBeDefined();
    }
  });

  test('V07: a one-off Event with a date needs no cadence, a repeating Event does', () => {
    const oneOff = validateTaskDraft(draft({ type: 'event', eventDate: d('2024-06-05'), cadence: null, idealSteps: [], fallbackSteps: [] }));
    expect(oneOff.ok).toBe(true);
    const repeating = validateTaskDraft(draft({ type: 'event', eventDate: null, cadence: null, idealSteps: [], fallbackSteps: [] }));
    expect(repeating.ok).toBe(false);
    if (!repeating.ok) expect(repeating.error.fields?.cadence).toBeDefined();
  });

  test('V10: a daily habit whose only step skips Sunday is rejected, naming Sunday', () => {
    const r = validateTaskDraft(draft({ cadence: { kind: 'daily' }, idealSteps: [{ text: 'Run', dueWeekdays: [1, 2, 3, 4, 5, 6] }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.idealSteps).toContain('Sunday');
  });

  test('V11: a weekly Routine with no ideal step is rejected (no weekday grid applies to it)', () => {
    const r = validateTaskDraft(draft({ cadence: { kind: 'weekly', weekday: 3, anchorDate: d('2024-06-05') }, idealSteps: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.idealSteps).toBe('Add at least one ideal step.');
  });
});
