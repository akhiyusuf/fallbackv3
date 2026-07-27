/** House pattern: @testing-library/react-native, `await render`. Never mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockTrend: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockRefetch = jest.fn();

jest.mock('@/queries', () => ({
  useTrend: () => ({ data: mockTrend.current, isLoading: mockTrend.isLoading, isError: mockTrend.isError, refetch: mockRefetch }),
}));

import S26AllTimeTrendGraph from './trend';

function monthlyPoints() {
  return [
    { bucketKey: '2026-05-01', label: '2026-05-01', range: { from: '2026-05-01', to: '2026-05-31' }, percent: 80, breakdown: { ideal: 20, fallback: 4, off: 2, missed: 5 } },
    { bucketKey: '2026-06-01', label: '2026-06-01', range: { from: '2026-06-01', to: '2026-06-30' }, percent: null, breakdown: { ideal: 0, fallback: 0, off: 0, missed: 0 } },
    { bucketKey: '2026-07-01', label: '2026-07-01', range: { from: '2026-07-01', to: '2026-07-15' }, percent: 90, breakdown: { ideal: 12, fallback: 1, off: 1, missed: 1 } },
  ];
}

describe('S26 — All-time Trend Graph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTrend.current = undefined;
    mockTrend.isLoading = false;
    mockTrend.isError = false;
  });

  it('is additive: never shows a percent as the sole surface — the a11y summary is present at all times', async () => {
    mockTrend.current = monthlyPoints();
    await render(<S26AllTimeTrendGraph />);
    // TrendGraph's screen-reader-only summary text mentions "no data" for the null bucket, a
    // break in the line rather than a fabricated 0% — present without touching the toggle.
    expect(screen.getByText(/no data/i)).toBeTruthy();
  });

  it('carries a real "View as table" alternative — a chart is never the only representation', async () => {
    mockTrend.current = monthlyPoints();
    const user = userEvent.setup();
    await render(<S26AllTimeTrendGraph />);
    await user.press(screen.getByText('View as table'));
    expect(screen.getByLabelText('Trend data table')).toBeTruthy();
    expect(screen.getByText('View as chart')).toBeTruthy();
  });

  it('states the data-gap note verbatim', async () => {
    mockTrend.current = monthlyPoints();
    await render(<S26AllTimeTrendGraph />);
    expect(screen.getByText('Long gaps with nothing due show as a break in the line, not a fabricated 0%.')).toBeTruthy();
  });

  it('empty state (history too short) never renders an empty axis or "0%"', async () => {
    mockTrend.current = [];
    await render(<S26AllTimeTrendGraph />);
    expect(screen.getByText('No data yet')).toBeTruthy();
    expect(screen.getByText('Your trend will appear as history builds.')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('loading and error states', async () => {
    mockTrend.isLoading = true;
    const { rerender } = await render(<S26AllTimeTrendGraph />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);

    mockTrend.isLoading = false;
    mockTrend.isError = true;
    await rerender(<S26AllTimeTrendGraph />);
    expect(screen.getByText("Couldn't load your trend right now.")).toBeTruthy();
  });

  it('back always returns to S25 (single fixed origin, no from-param logic on this screen)', async () => {
    const replaceSpy = jest.spyOn(router, 'replace').mockImplementation(() => undefined as never);
    const canGoBackSpy = jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    mockTrend.current = monthlyPoints();
    const user = userEvent.setup();
    await render(<S26AllTimeTrendGraph />);
    await user.press(screen.getByLabelText('Back'));
    expect(replaceSpy).toHaveBeenCalledWith('/progress');
    replaceSpy.mockRestore();
    canGoBackSpy.mockRestore();
  });
});
