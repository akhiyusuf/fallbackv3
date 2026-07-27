/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Never mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockConsistency: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockDisclosure: { current: unknown } = { current: [] };
const mockTasks: { current: unknown; isLoading: boolean } = { current: [], isLoading: false };
const mockRefetch = jest.fn();

jest.mock('@/queries', () => ({
  useConsistency: () => ({ data: mockConsistency.current, isLoading: mockConsistency.isLoading, isError: mockConsistency.isError, refetch: mockRefetch }),
  useConsistencyDisclosure: () => ({ data: mockDisclosure.current }),
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

describe('S25 — Consistency Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConsistency.current = undefined;
    mockConsistency.isLoading = false;
    mockConsistency.isError = false;
    mockDisclosure.current = [];
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
    expect(screen.getByLabelText(/Consistency breakdown: 87 percent/)).toBeTruthy();
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
