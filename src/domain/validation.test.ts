import type { TaskDraft } from '@/types';
import { emptyRunOccurrences, validateTaskDraft } from './validation';

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

describe('validateTaskDraft — name and basic presence rules', () => {
  test('an empty (or whitespace-only) name is rejected', () => {
    const r = validateTaskDraft(draft({ name: '   ' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.name).toBeDefined();
  });

  test('a tracked Routine with no ideal step is rejected', () => {
    const r = validateTaskDraft(draft({ idealSteps: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.idealSteps).toBeDefined();
  });

  test('a tracked Routine with no fallback step is rejected', () => {
    const r = validateTaskDraft(draft({ fallbackSteps: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.fallbackSteps).toBeDefined();
  });

  test('an as-needed Routine needs neither ideal nor fallback steps', () => {
    const r = validateTaskDraft(draft({ isAsNeeded: true, cadence: null, idealSteps: [], fallbackSteps: [] }));
    expect(r.ok).toBe(true);
  });

  test('a valid draft passes', () => {
    expect(validateTaskDraft(draft({})).ok).toBe(true);
  });

  test('specific-weekdays with zero selected weekdays is rejected', () => {
    const r = validateTaskDraft(draft({ cadence: { kind: 'specific-weekdays', weekdays: [] } }));
    expect(r.ok).toBe(false);
  });

  test('a Course without an end date is rejected', () => {
    const r = validateTaskDraft(
      draft({ type: 'course', cadence: { kind: 'daily' }, startDate: '2024-01-01' as never, endDate: null }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.endDate).toBeDefined();
  });
});

describe('emptyRunOccurrences — F23/F24 no-empty-run-occurrence invariant', () => {
  test('the Studying Mon-Fri fixture: toggling the assignments step OFF everywhere but Tuesday still covered by the always-on reading step', () => {
    const d = draft({
      idealSteps: [
        { text: 'Do the assigned reading', dueWeekdays: null },
        { text: 'Finish weekly assignments', dueWeekdays: [5] },
      ],
    });
    expect(emptyRunOccurrences(d)).toEqual([]);
  });

  test('toggling the ONLY ideal step off for Tuesday leaves Tuesday with zero due ideal steps — rejected, names the weekday', () => {
    const d = draft({
      idealSteps: [{ text: 'Only step', dueWeekdays: [1, 3, 4, 5] }], // every weekday except Tuesday
    });
    expect(emptyRunOccurrences(d)).toEqual(['Tuesday']);
    const r = validateTaskDraft(d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.idealSteps).toContain('Tuesday');
  });

  test('weekly...yearly cadences are degenerate — no empty-run check applies (grid replaced by the static note)', () => {
    const d = draft({
      cadence: { kind: 'weekly', weekday: 1, anchorDate: '2024-01-01' as never },
      idealSteps: [{ text: 'Step', dueWeekdays: null }],
    });
    expect(emptyRunOccurrences(d)).toEqual([]);
  });

  test('an untracked task has nothing to check', () => {
    const d = draft({ type: 'event', isTracked: false, cadence: null, eventDate: '2024-01-01' as never, idealSteps: [], fallbackSteps: [] });
    expect(emptyRunOccurrences(d)).toEqual([]);
  });
});
