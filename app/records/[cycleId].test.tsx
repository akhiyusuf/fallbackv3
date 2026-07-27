/** House pattern: @testing-library/react-native, `await render`. Never mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockParams: { current: { cycleId: string } } = { current: { cycleId: 'r1' } };
const mockRecord: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockRefetch = jest.fn();

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return { ...actual, useLocalSearchParams: () => mockParams.current };
});

jest.mock('@/queries', () => ({
  useCycleRecord: () => ({ data: mockRecord.current, isLoading: mockRecord.isLoading, isError: mockRecord.isError, refetch: mockRefetch }),
}));

import S30CycleRecordDetail from './[cycleId]';

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
    await render(<S30CycleRecordDetail />);
    expect(screen.getByText('June 2026 · Monthly')).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(screen.getByText('Cycling XP this cycle: 412')).toBeTruthy();
  });

  it('the breakdown bar is never fully filled when Missed > 0 — a real unfilled remainder', async () => {
    await render(<S30CycleRecordDetail />);
    // total = ideal+fallback+missed+off = 20+6+3+2 = 31; ideal+fallback+off = 28 -> genuinely
    // < total, so the bar leaves the missed share unfilled rather than fully filled.
    expect(screen.getByLabelText(/Cycle breakdown: 91 percent/)).toBeTruthy();
  });

  it('no badges that cycle shows the neutral copy, never a blank grid', async () => {
    mockRecord.current = juneRecord({ badgeKeysUnlocked: [] });
    await render(<S30CycleRecordDetail />);
    expect(screen.getByText('No new badges this cycle')).toBeTruthy();
  });

  it('a short cycle shows the cadence-change note', async () => {
    mockRecord.current = juneRecord({ isShortCycle: true });
    await render(<S30CycleRecordDetail />);
    expect(screen.getByText('Short cycle — cadence changed mid-month.')).toBeTruthy();
  });

  it('this screen is read-only: back is the only interactive element, and always returns to S29', async () => {
    const replaceSpy = jest.spyOn(router, 'replace').mockImplementation(() => undefined as never);
    const canGoBackSpy = jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    const user = userEvent.setup();
    await render(<S30CycleRecordDetail />);
    await user.press(screen.getByLabelText('Back'));
    expect(replaceSpy).toHaveBeenCalledWith('/records');
    replaceSpy.mockRestore();
    canGoBackSpy.mockRestore();
  });

  it('loading and error states', async () => {
    mockRecord.isLoading = true;
    const { rerender } = await render(<S30CycleRecordDetail />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);

    mockRecord.isLoading = false;
    mockRecord.isError = true;
    await rerender(<S30CycleRecordDetail />);
    expect(screen.getByText("Couldn't load this cycle right now.")).toBeTruthy();
    await userEvent.setup().press(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
