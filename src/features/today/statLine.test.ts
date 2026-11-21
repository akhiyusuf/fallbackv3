import { dayCountsPhrase } from '@/features/progress/dayCountsLine';
import { S25_COPY } from '@/features/progress/copy';
import { aggregateConsistency } from '@/domain/consistency';
import type { Id, LocalDate, Occurrence } from '@/types';

import { reentryStatLine, statLine } from './copy';

// Twenty-ninth pass (the human's call): the line under the percent counts real, whole days.
describe('the Today stat line counts full, partial and missed days', () => {
  it('names the period and each kind of day, leaving out kinds at zero', () => {
    expect(statLine({ full: 17, partial: 13, missed: 0 }, 30)).toBe('Last 30 days: 17 full days, 13 partial');
    expect(statLine({ full: 17, partial: 11, missed: 2 }, 30)).toBe('Last 30 days: 17 full days, 11 partial, 2 missed');
    expect(statLine({ full: 1, partial: 0, missed: 0 }, 30)).toBe('Last 30 days: 1 full day');
  });
  it('the first kind shown carries the word "days"', () => {
    expect(dayCountsPhrase({ full: 0, partial: 2, missed: 1 })).toBe('2 partial days, 1 missed');
    expect(dayCountsPhrase({ full: 0, partial: 0, missed: 1 })).toBe('1 missed day');
  });
  it('the re-entry line uses the same words', () => {
    expect(reentryStatLine(83, { full: 17, partial: 4, missed: 0 }, 30)).toBe('Your consistency is intact: 83%. Last 30 days: 17 full days, 4 partial.');
  });
  it('Progress (all habits) uses the same line for each period', () => {
    expect(S25_COPY.aggregateSubcopy({ full: 300, partial: 40, missed: 25 }, 'All time')).toBe('All time: 300 full days, 40 partial, 25 missed');
  });
});

describe('the day counts come from real days and add up to the counted days', () => {
  const occ = (taskId: string, date: string, outcome: Occurrence['outcome']) => ({ taskId: taskId as Id, date: date as LocalDate, outcome }) as unknown as Occurrence;
  it('two habits on two days, one day half done: 1 full, 1 partial, beside 75%', () => {
    const r = aggregateConsistency({
      occurrences: [occ('a', '2026-07-01', 'ideal'), occ('b', '2026-07-01', 'fallback'), occ('a', '2026-07-02', 'ideal'), occ('b', '2026-07-02', 'missed')],
      window: 'last-30',
      today: '2026-07-03' as LocalDate,
    });
    expect(r.percent).toBe(75);
    expect(r.days).toEqual({ full: 1, partial: 1, missed: 0 });
  });
  it('an off habit does not make a day partial; a day with everything missed is missed; today pending is not counted', () => {
    const r = aggregateConsistency({
      occurrences: [
        occ('a', '2026-07-01', 'ideal'), occ('b', '2026-07-01', 'off'),
        occ('a', '2026-07-02', 'missed'), occ('b', '2026-07-02', 'missed'),
        occ('a', '2026-07-03', 'off'), occ('b', '2026-07-03', 'off'),
        occ('a', '2026-07-04', 'pending'),
      ],
      window: 'all-time',
      today: '2026-07-04' as LocalDate,
    });
    expect(r.days).toEqual({ full: 1, partial: 0, missed: 1 });
    expect(r.denominator).toBe(2);
    expect(r.breakdown.off).toBe(1);
  });
  it('full + partial + missed always equals the counted days, over a long random history', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const outcomes: Occurrence['outcome'][] = ['ideal', 'fallback', 'missed', 'off'];
    const list: Occurrence[] = [];
    for (let d = 0; d < 400; d++) {
      const date = new Date(Date.UTC(2025, 0, 1 + d)).toISOString().slice(0, 10);
      for (const t of ['a', 'b', 'c']) if (rand() < 0.8) list.push(occ(t, date, outcomes[Math.floor(rand() * 4)]!));
    }
    for (const window of ['last-7', 'last-30', 'all-time'] as const) {
      const r = aggregateConsistency({ occurrences: list, window, today: '2026-03-01' as LocalDate });
      expect(r.days!.full + r.days!.partial + r.days!.missed).toBe(r.denominator);
    }
  });
});
