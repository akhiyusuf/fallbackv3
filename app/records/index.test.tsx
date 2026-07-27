/** House pattern: @testing-library/react-native, `await render`. Never mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockProgress: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockRecords: { current: unknown; isLoading: boolean; isError: boolean } = { current: [], isLoading: false, isError: false };

jest.mock('@/queries', () => ({
  useProgress: () => ({ data: mockProgress.current, isLoading: mockProgress.isLoading, isError: mockProgress.isError, refetch: jest.fn() }),
  useCycleRecords: () => ({ data: mockRecords.current, isLoading: mockRecords.isLoading, isError: mockRecords.isError, refetch: jest.fn() }),
}));

import S29CycleRecords from './index';

function progressState() {
  return {
    lifetimeXp: 620,
    level: { level: 7, title: 'Consistent', xpIntoLevel: 620, xpForLevel: 1000 },
    cyclingXp: 128,
    cycleCadence: 'monthly',
    currentCycle: { id: 'c-current', cadence: 'monthly', startDate: '2026-07-01', endDate: '2026-07-31' },
  };
}

function record(overrides: Partial<Record<string, unknown>> = {}) {
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

describe('S29 — Cycle Records', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProgress.current = progressState();
    mockProgress.isLoading = false;
    mockProgress.isError = false;
    mockRecords.current = [record()];
    mockRecords.isLoading = false;
    mockRecords.isError = false;
  });

  it('shows the in-progress strip (not tappable — not a finalized record) and the archived list', async () => {
    await render(<S29CycleRecords />);
    expect(screen.getByText('In progress — July 2026')).toBeTruthy();
    expect(screen.getByText('91%')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
  });

  it('a short cycle carries the cadence-change note', async () => {
    mockRecords.current = [record({ isShortCycle: true, startDate: '2026-04-13', endDate: '2026-04-30' })];
    await render(<S29CycleRecords />);
    expect(screen.getByText(/Short cycle — cadence changed mid-month\./)).toBeTruthy();
  });

  it('empty state (no finalized cycles yet) reads the monthly-cadence copy', async () => {
    mockRecords.current = [];
    await render(<S29CycleRecords />);
    expect(screen.getByText('No recaps yet')).toBeTruthy();
    expect(screen.getByText('Your first recap arrives at the end of this month.')).toBeTruthy();
  });

  it('empty state reads the weekly-cadence copy when weekly is active', async () => {
    mockProgress.current = { ...progressState(), cycleCadence: 'weekly' };
    mockRecords.current = [];
    await render(<S29CycleRecords />);
    expect(screen.getByText('Your first recap arrives at the end of this week.')).toBeTruthy();
  });

  it('tapping an archived record navigates to S30 with its own id', async () => {
    const pushSpy = jest.spyOn(router, 'push').mockImplementation(() => undefined as never);
    const user = userEvent.setup();
    await render(<S29CycleRecords />);
    await user.press(screen.getByText(/June 2026/));
    expect(pushSpy).toHaveBeenCalledWith('/records/r1');
    pushSpy.mockRestore();
  });

  it('loading and error states', async () => {
    mockProgress.isLoading = true;
    const { rerender } = await render(<S29CycleRecords />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);

    mockProgress.isLoading = false;
    mockProgress.isError = true;
    await rerender(<S29CycleRecords />);
    expect(screen.getByText("Couldn't load your cycle records right now.")).toBeTruthy();
  });

  it('origin-aware back falls back to Achievements outside a navigator', async () => {
    const replaceSpy = jest.spyOn(router, 'replace').mockImplementation(() => undefined as never);
    const canGoBackSpy = jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    const user = userEvent.setup();
    await render(<S29CycleRecords />);
    await user.press(screen.getByLabelText('Back'));
    expect(replaceSpy).toHaveBeenCalledWith('/achievements');
    replaceSpy.mockRestore();
    canGoBackSpy.mockRestore();
  });
});
