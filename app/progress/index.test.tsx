/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Never mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockConsistency: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockTasks: { current: unknown; isLoading: boolean } = { current: [], isLoading: false };
const mockRefetch = jest.fn();

jest.mock('@/queries', () => ({
  useConsistency: () => ({ data: mockConsistency.current, isLoading: mockConsistency.isLoading, isError: mockConsistency.isError, refetch: mockRefetch }),
  useTasks: () => ({ data: mockTasks.current, isLoading: mockTasks.isLoading }),
}));

import S25ConsistencyDashboard from './index';

function id(s: string) {
  return s as never;
}

const MOVEMENT_TASK = { id: id('t1'), name: 'Movement', type: 'routine', isAsNeeded: false };

function breakdown(ideal: number, fallback: number, off: number, missed: number) {
  return { ideal, fallback, off, missed };
}

/** Sums `ConsistencyBreakdownBar`'s three filled-segment widths (ideal/fallback/off), read
 *  straight off the rendered tree — the exact pixels shown, not a re-derivation of the `total`
 *  prop's arithmetic. */
function filledPercent(bar: ReturnType<typeof screen.getByLabelText>): number {
  return bar.children.reduce((sum: number, child) => {
    const style = (child as { props?: { style?: { width?: string } } }).props?.style;
    const width = style?.width;
    return sum + (typeof width === 'string' ? parseFloat(width) : 0);
  }, 0);
}

describe('S25 — Consistency Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsistency.current = undefined;
    mockConsistency.isLoading = false;
    mockConsistency.isError = false;
    mockTasks.current = [MOVEMENT_TASK];
    mockTasks.isLoading = false;
  });

  it('renders the per-task headline, subcopy, off-note and breakdown legend from the result only', async () => {
    mockConsistency.current = {
      scope: 'per-task',
      percent: 87,
      numerator: 26,
      denominator: 30,
      breakdown: breakdown(22, 4, 4, 4),
      countedDates: [],
    };
    await render(<S25ConsistencyDashboard />);
    expect(screen.getByText('87%')).toBeTruthy();
    expect(screen.getByText('22 ideal + 4 fallback = 26 of 30 counted days')).toBeTruthy();
    expect(screen.getByText('4 days were off — not counted either way')).toBeTruthy();
  });

  it('never renders "0%" on the no-data empty state, and shows the calm empty copy instead', async () => {
    mockConsistency.current = { scope: 'per-task', percent: null, numerator: 0, denominator: 0, breakdown: breakdown(0, 0, 0, 0), countedDates: [] };
    await render(<S25ConsistencyDashboard />);
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('a truncated 30-day window (whole history shorter than the preset) appends the truncation clause', async () => {
    mockConsistency.current = { scope: 'per-task', percent: 100, numerator: 26, denominator: 26, breakdown: breakdown(22, 4, 4, 0), countedDates: [] };
    await render(<S25ConsistencyDashboard />);
    await userEvent.setup().press(screen.getByLabelText('30 days'));
    expect(
      screen.getByText("22 ideal + 4 fallback = 26 of 26 counted days — this task's whole history so far is shorter than 30 days"),
    ).toBeTruthy();
  });

  it('a brand-new user (zero trackable tasks) sees the empty state, never the error banner, even though the underlying doomed per-task query errors', async () => {
    mockTasks.current = [];
    mockConsistency.isError = true; // the doomed `taskId: undefined` per-task query, per reads.ts
    await render(<S25ConsistencyDashboard />);
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.queryByText("Couldn't load your consistency right now.")).toBeNull();
  });

  it('aggregate scope states the differing units explicitly in the caption', async () => {
    mockConsistency.current = { scope: 'aggregate', percent: 92, numerator: 27.5, denominator: 30, breakdown: breakdown(24, 4, 3, 3), countedDates: [] };
    const user = userEvent.setup();
    await render(<S25ConsistencyDashboard />);
    await user.press(screen.getByLabelText('Aggregate'));
    expect(screen.getByText('Ideal/Fallback are rounded credit sums; Off is a day count; Missed is the rounded remainder.')).toBeTruthy();
    expect(screen.getByText('≈27.5 of 30 counted days (weighted by that day\'s tasks)')).toBeTruthy();
  });

  it('the breakdown bar total leaves room for the missed remainder unfilled (never fully filled when missed > 0)', async () => {
    mockConsistency.current = { scope: 'per-task', percent: 87, numerator: 26, denominator: 30, breakdown: breakdown(22, 4, 4, 4), countedDates: [] };
    await render(<S25ConsistencyDashboard />);
    // total = denominator(30) + off(4) = 34; ideal+fallback+off = 30 -> 30/34 < 100%, leaving the
    // remaining ~11.8% (missed=4/34) genuinely unfilled, never a fully-filled bar.
    const bar = screen.getByLabelText(/Consistency breakdown: 87 percent/);
    expect(filledPercent(bar)).toBeLessThan(100);
  });

  it('aggregate breakdown bar total is the rounded-category sum, not denominator+off — the design\'s own aggregate|7 fixture (Ideal 6/Fallback 1/Off 0/Missed 1, denominator 7) must never render fully filled', async () => {
    // ALLSCREENS 2020-2023: "7 days: 93% — legend Ideal 6 · Fallback 1 · Off 0 · Missed 1".
    // Bug (review pass 1, blocking item 1): total = denominator(7) + off(0) = 7, and
    // ideal+fallback+off = 7 -> a WRONGLY fully-filled bar despite Missed = 1. Fixed total =
    // ideal+fallback+missed+off = 6+1+1+0 = 8, so ideal+fallback+off (7) / 8 < 100%.
    mockConsistency.current = { scope: 'aggregate', percent: 93, numerator: 6.5, denominator: 7, breakdown: breakdown(6, 1, 0, 1), countedDates: [] };
    const user = userEvent.setup();
    await render(<S25ConsistencyDashboard />);
    await user.press(screen.getByLabelText('Aggregate'));
    const bar = screen.getByLabelText(/Consistency breakdown: 93 percent/);
    expect(filledPercent(bar)).toBeLessThan(100);
  });

  it('the aggregate disclosure renders the pinned 3-day illustrative fixture verbatim, never the live history', async () => {
    mockConsistency.current = { scope: 'aggregate', percent: 92, numerator: 27.5, denominator: 30, breakdown: breakdown(24, 4, 3, 3), countedDates: [] };
    const user = userEvent.setup();
    await render(<S25ConsistencyDashboard />);
    await user.press(screen.getByLabelText('Aggregate'));
    await user.press(screen.getByLabelText('How the aggregate is calculated'));
    expect(screen.getByText('Wed — 2 of 2 tasks shown up → counts as 1.0')).toBeTruthy();
    expect(screen.getByText('Thu — 1 of 3 tasks shown up (2 missed) → counts as 0.33')).toBeTruthy();
    expect(screen.getByText('Fri — every due task was off → not counted')).toBeTruthy();
    expect(screen.getByText('Total: 1.33 ÷ 2 counted days = 67%')).toBeTruthy();
    // No live-history ISO date (e.g. "2026-07-16") ever appears in the disclosure.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('shows a retry banner on error and can retry', async () => {
    mockConsistency.isError = true;
    const user = userEvent.setup();
    await render(<S25ConsistencyDashboard />);
    expect(screen.getByText("Couldn't load your consistency right now.")).toBeTruthy();
    await user.press(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows loading skeletons while the consistency query is in flight', async () => {
    mockConsistency.isLoading = true;
    await render(<S25ConsistencyDashboard />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('origin-aware back falls back to Today outside a navigator (no from param, no back-stack)', async () => {
    const replaceSpy = jest.spyOn(router, 'replace').mockImplementation(() => undefined as never);
    // `router.canGoBack()` throws when no navigator has mounted (a bare-component render) —
    // spy it, per the house pattern's "spy, don't mock the module" rule.
    const canGoBackSpy = jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    mockConsistency.current = { scope: 'per-task', percent: 87, numerator: 26, denominator: 30, breakdown: breakdown(22, 4, 4, 4), countedDates: [] };
    const user = userEvent.setup();
    await render(<S25ConsistencyDashboard />);
    await user.press(screen.getByLabelText('Back'));
    expect(replaceSpy).toHaveBeenCalledWith('/today');
    replaceSpy.mockRestore();
    canGoBackSpy.mockRestore();
  });

  it('"See full history" navigates to S26', async () => {
    mockConsistency.current = { scope: 'per-task', percent: 87, numerator: 26, denominator: 30, breakdown: breakdown(22, 4, 4, 4), countedDates: [] };
    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => undefined as never);
    const user = userEvent.setup();
    await render(<S25ConsistencyDashboard />);
    await user.press(screen.getByText('See full history →'));
    expect(pushSpy).toHaveBeenCalledWith('/progress/trend');
    pushSpy.mockRestore();
  });
});
