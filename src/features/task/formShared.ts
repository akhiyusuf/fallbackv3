import type { Cadence, Weekday } from '@/types';

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

export const SAVE_FAILED = "Couldn't save that — try again.";
