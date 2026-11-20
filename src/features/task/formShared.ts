import { useRef } from 'react';

import type { Cadence, StepDraft, Weekday } from '@/types';

export const IMPORTANCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const NECESSITY_OPTIONS = [
  { value: 'must-do', label: 'Must-do' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'optional', label: 'Optional' },
];

export function parentDaysFor(cadence: Cadence): readonly Weekday[] {
  if (cadence.kind === 'daily') return [1, 2, 3, 4, 5, 6, 7];
  if (cadence.kind === 'specific-weekdays') return cadence.weekdays;
  return [];
}

export const SAVE_FAILED = "Couldn't save that. Try again.";

/**
 * Save-button guard shared by every create form. A second tap in the same moment (before the first
 * press has re-rendered the button as busy) must not start a second save and a second task, and a
 * save that throws must end in the calm "couldn't save" toast rather than an unhandled rejection.
 */
export function useSingleFlightSave(save: () => Promise<void>, onError: () => void): () => Promise<void> {
  const busy = useRef(false);
  return async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await save();
    } catch {
      onError();
    } finally {
      busy.current = false;
    }
  };
}

/** Steps with nothing typed in them are not steps: a blank row must not count as an ideal or a fallback. */
export function withoutBlankSteps(steps: readonly StepDraft[]): readonly StepDraft[] {
  return steps.filter((s) => s.text.trim().length > 0).map((s) => ({ ...s, text: s.text.trim() }));
}
