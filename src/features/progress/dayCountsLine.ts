/**
 * Twenty-ninth pass (the human's call): under the consistency percent, say how the counted days
 * actually went, in whole days, instead of "x of y days". The old count was the weighted total
 * rounded to whole days, so it could read "2 of 2 days" beside 83%, and a month with no missed day
 * could read "27 of 30 days". Full, partial and missed are real days a person can check.
 */
import type { DayCounts } from '@/types';

/** "17 full days, 13 partial, 2 missed". The first part names the unit; parts at zero are left out. */
export function dayCountsPhrase(days: DayCounts): string {
  return countsPhrase([
    [days.full, 'full'],
    [days.partial, 'partial'],
    [days.missed, 'missed'],
  ]);
}

/** One habit: "1 ideal day, 2 missed" (thirtieth pass), the same shape as the all-habits line. */
export function habitDaysLine(counts: { ideal: number; fallback: number; missed: number }, period: string): string {
  return `${period}: ${countsPhrase([
    [counts.ideal, 'ideal'],
    [counts.fallback, 'fallback'],
    [counts.missed, 'missed'],
  ])}`;
}

function countsPhrase(parts: readonly [number, string][]): string {
  const shown = parts.filter(([n]) => n > 0);
  if (shown.length === 0) return 'no counted days';
  return shown.map(([n, word], i) => (i === 0 ? `${n} ${word} ${n === 1 ? 'day' : 'days'}` : `${n} ${word}`)).join(', ');
}

/** "Last 30 days: 17 full days, 13 partial". */
export function dayCountsLine(days: DayCounts, period: string): string {
  return `${period}: ${dayCountsPhrase(days)}`;
}
