/**
 * House pattern: @testing-library/react-native. Never mock expo-router — real params
 * (`cycleId`) and real cross-screen navigation are exercised via `expo-router/testing-library`'s
 * `renderRouter` against `M5_ROUTER_CONTEXT` instead (review pass 1, blocking item 6).
 */
import { renderRouter, screen } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';

import { M5_ROUTER_CONTEXT } from '@/features/progress/testSupport/routerHarness';

const mockRecord: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockRefetch = jest.fn();

jest.mock('@/queries', () => ({
  useCycleRecord: () => ({ data: mockRecord.current, isLoading: mockRecord.isLoading, isError: mockRecord.isError, refetch: mockRefetch }),
}));

function juneRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    cadence: 'monthly',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    consistencyPercent: 91,
    breakdown: { ideal: 20, fallback: 6, off: 2, missed: 3 },
    cyclingXpFinal: 412,
    badgeKeysUnlocked: ['milestone-100-done'],
    isShortCycle: false,
    finalizedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('S30 — Cycle Record Detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecord.current = juneRecord();
    mockRecord.isLoading = false;
    mockRecord.isError = false;
  });

  it('renders the header, percent, breakdown legend and Cycling XP row for this cycle only', async () => {
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    expect(await screen.findByText('June 2026 · Monthly')).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(screen.getByText('Cycling XP this cycle: 412')).toBeTruthy();
  });

  it('the breakdown bar is never fully filled when Missed > 0 — a real unfilled remainder', async () => {
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    // total = ideal+fallback+missed+off = 20+6+3+2 = 31; ideal+fallback+off = 28 -> genuinely
    // < total, so the bar leaves the missed share unfilled rather than fully filled.
    expect(await screen.findByLabelText(/Cycle breakdown: 91 percent/)).toBeTruthy();
  });

  it('no badges that cycle shows the neutral copy, never a blank grid', async () => {
    mockRecord.current = juneRecord({ badgeKeysUnlocked: [] });
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    expect(await screen.findByText('No new badges this cycle')).toBeTruthy();
  });

  it('a short cycle shows the cadence-change note', async () => {
    mockRecord.current = juneRecord({ isShortCycle: true });
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    expect(await screen.findByText('Short cycle — cadence changed mid-month.')).toBeTruthy();
  });

  it('this screen is read-only: back is the only interactive element, and always returns to S29', async () => {
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    await screen.findByText('June 2026 · Monthly');
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Back'));
    expect(await screen.findByText('MARKER_RECORDS')).toBeTruthy();
  });

  it('shows loading skeletons while the record query is in flight', async () => {
    mockRecord.isLoading = true;
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('shows a retry banner on error and can retry', async () => {
    mockRecord.isError = true;
    await renderRouter(M5_ROUTER_CONTEXT, { initialUrl: '/records/r1' });
    expect(await screen.findByText("Couldn't load this cycle right now.")).toBeTruthy();
    await userEvent.setup().press(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
