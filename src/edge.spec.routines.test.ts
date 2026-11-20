/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). PRD F2 (ideal and fallback both required; fallback
 * identical to ideal is allowed), F11/F23 (a one-off Event has no cadence and is valid), and F23's
 * no-empty-run-occurrence rule at its edges. The validator is shared by S16, S17, S18 and S20.
 */
import type { TaskDraft } from '@/types';
import { emptyRunOccurrences, validateTaskDraft } from '@/domain/validation';

function draft(overrides: Partial<TaskDraft>): TaskDraft {
  return {
    type: 'routine',
    name: 'Studying',
    isAsNeeded: false,
    isTracked: true,
    cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] },
    idealSteps: [{ text: 'Read', dueWeekdays: null }],
    fallbackSteps: [{ text: 'Read one page', dueWeekdays: null }],
    ...overrides,
  };
}

describe('F2 / F23 — save-time rules at their edges (spec coverage)', () => {
  test('a fallback identical to the ideal is allowed: the spec does not forbid it, so it saves', () => {
    const same = [{ text: 'Walk 10 minutes', dueWeekdays: null }];
    const r = validateTaskDraft(draft({ idealSteps: same, fallbackSteps: [{ ...same[0]! }] }));
    expect(r.ok).toBe(true);
  });

  test('a one-off Event with a date and no cadence saves, e.g. "Dentist visit" (the F13 anchor example)', () => {
    const r = validateTaskDraft(draft({ type: 'event', name: 'Dentist visit', isTracked: false, cadence: null, idealSteps: [], fallbackSteps: [], eventDate: '2026-08-04' as TaskDraft['eventDate'] }));
    expect(r.ok).toBe(true);
  });

  test('a repeating course whose day list is empty is rejected on the cadence field, not saved as "never due"', () => {
    const r = validateTaskDraft(draft({ type: 'course', startDate: '2026-08-01' as TaskDraft['startDate'], endDate: '2026-08-31' as TaskDraft['endDate'], cadence: { kind: 'specific-weekdays', weekdays: [] } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.cadence).toBeDefined();
  });

  test('a course with zero doses a day is rejected on the doses field', () => {
    const r = validateTaskDraft(draft({ type: 'course', startDate: '2026-08-01', endDate: '2026-08-31', dosesPerDay: 0, cadence: { kind: 'daily' } } as Partial<TaskDraft>));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.dosesPerDay).toBeDefined();
  });

  test('a step whose due days are an empty list counts as covering no day: every scheduled weekday is reported', () => {
    const d = draft({ idealSteps: [{ text: 'Never', dueWeekdays: [] }] });
    expect(emptyRunOccurrences(d)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  });

  test('a daily routine whose only ideal step is due on the weekend leaves every weekday empty and is rejected', () => {
    const d = draft({ cadence: { kind: 'daily' }, idealSteps: [{ text: 'Long run', dueWeekdays: [6, 7] }] });
    expect(emptyRunOccurrences(d)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(validateTaskDraft(d).ok).toBe(false);
  });

  test('Studying Mon to Fri: a Friday-only step plus a Mon-Thu step leaves no day empty, so it saves', () => {
    const d = draft({
      idealSteps: [
        { text: 'Read', dueWeekdays: [1, 2, 3, 4] },
        { text: 'Finish weekly assignments', dueWeekdays: [5] },
      ],
    });
    expect(emptyRunOccurrences(d)).toEqual([]);
    expect(validateTaskDraft(d).ok).toBe(true);
  });

  test('a fallback-only routine with no ideal steps is rejected on the ideal field (no vacuous ideal day)', () => {
    const r = validateTaskDraft(draft({ idealSteps: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.fields?.idealSteps).toBeDefined();
  });
});
