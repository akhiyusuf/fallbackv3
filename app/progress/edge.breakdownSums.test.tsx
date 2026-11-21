/**
 * Round 4: every place that shows the aggregate breakdown shows counts that add up to the days
 * counted. Data is the real domain output for 3 days that each have one ideal and one fallback task
 * (the case that used to read "1 ideal, 1 fallback" out of 1 day).
 */
import { render, screen, userEvent } from '@testing-library/react-native';
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library';

import { aggregateConsistency } from '@/domain';
import { M5_ROUTER_CONTEXT } from '@/features/progress/testSupport/routerHarness';
import type { LocalDate, Occurrence } from '@/types';

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  return { ...actual, today: () => '2026-07-16' };
});

const occ = (n: number, date: string, outcome: Occurrence['outcome']): Occurrence => ({
  taskId: `t${n}` as Occurrence['taskId'],
  date: date as LocalDate,
  outcome,
  dueIdealStepIds: [],
  completedStepIds: [],
  chipState: null,
  dosesRequired: 1,
  dosesCompleted: 0,
});
const SPLIT = ['2026-06-10', '2026-06-11', '2026-06-12'].flatMap((d) => [occ(1, d, 'ideal'), occ(2, d, 'fallback')]);
const agg = aggregateConsistency({ occurrences: SPLIT, window: 'last-30', today: '2026-07-16' as LocalDate });

const mockQ = { consistency: agg as unknown, trend: [] as unknown[], record: undefined as unknown, records: [] as unknown[] };
jest.mock('@/queries', () => ({
  useConsistency: () => ({ data: mockQ.consistency, isLoading: false, isError: false, refetch: jest.fn() }),
  useTasks: () => ({ data: [{ id: 'a', name: 'Walk', type: 'routine', isAsNeeded: false, icon: 'Repeat', color: 'forge-orange' }], isLoading: false }),
  useTrend: () => ({ data: mockQ.trend, isLoading: false, isError: false, refetch: jest.fn() }),
  useCycleRecord: () => ({ data: mockQ.record, isLoading: false, isError: false, refetch: jest.fn() }),
  useCycleRecords: () => ({ data: mockQ.records, isLoading: false, isError: false, refetch: jest.fn() }),
  useProgress: () => ({
    data: { lifetimeXp: 1, level: { level: 1, title: 'x', xpIntoLevel: 1, xpForLevel: 10 }, cyclingXp: 1, cycleCadence: 'monthly', currentCycle: { id: 'c', cadence: 'monthly', startDate: '2026-07-01', endDate: '2026-07-31' } },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

import Progress from './index';
import Trend from './trend';
import Records from '../records/index';

const record = {
  id: 'r1',
  cadence: 'monthly',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  consistencyPercent: agg.percent,
  breakdown: agg.breakdown,
  cyclingXpFinal: 10,
  badgeKeysUnlocked: [],
  isShortCycle: false,
  finalizedAt: '2026-07-01T00:00:00.000Z',
};

describe('aggregate breakdown, 3 days each with one ideal and one fallback', () => {
  it('the domain gives counts that add up to the 3 days counted', () => {
    expect(agg.denominator).toBe(3);
    expect(agg.breakdown.ideal + agg.breakdown.fallback + agg.breakdown.missed).toBe(3);
  });

  it('S25: all habits counts whole days (twenty-ninth pass): 3 full days, tiles add up, no decimals', async () => {
    await render(<Progress />);
    await userEvent.press(screen.getAllByRole('radio')[0]!); // Everything
    expect(screen.getByText('Last 30 days: 3 full days')).toBeTruthy();
    const tile = (l: string) => Number(/: (\d+)/.exec(String(screen.getByLabelText(new RegExp(`^${l}: `)).props.accessibilityLabel))![1]);
    expect(tile('Full days') + tile('Partial') + tile('Missed')).toBe(3);
    expect(screen.queryByText(/\d\.\d/)).toBeNull();
  });

  it('S26 trend table: the row for the bucket adds up to its counted days', async () => {
    mockQ.trend = [{ bucketKey: '2026-06-01', label: '2026-06-01', range: { from: '2026-06-01', to: '2026-06-30' }, percent: agg.percent, breakdown: agg.breakdown }];
    await render(<Trend />);
    await userEvent.press(screen.getByLabelText('Table'));
    const row = screen.getByLabelText(/^June 2026: .*ideal \d+, fallback \d+/).props.accessibilityLabel as string;
    const n = (k: string) => Number(new RegExp(`${k} (\\d+)`).exec(row)![1]);
    expect(n('ideal') + n('fallback') + n('missed')).toBe(3);
  });

  it('S29 record card and S30 detail: counted days equal the sum, and S30 says "of 3 counted days"', async () => {
    mockQ.records = [record];
    await render(<Records />);
    expect(screen.getByLabelText('Breakdown for June 2026')).toBeTruthy();
    mockQ.record = record;
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    expect(await routerScreen.findByText(/of 3 counted days/)).toBeTruthy();
    expect(routerScreen.getByText(/About 3 of 3 counted days/)).toBeTruthy();
  });
});
