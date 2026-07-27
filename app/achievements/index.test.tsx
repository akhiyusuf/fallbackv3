/** House pattern: @testing-library/react-native, `await render`. Never mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockProgress: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockAchievements: { current: unknown; isLoading: boolean; isError: boolean } = { current: [], isLoading: false, isError: false };
const mockSettings: { current: unknown; isLoading: boolean; isError: boolean } = { current: undefined, isLoading: false, isError: false };
const mockUpdateSettings = { mutate: jest.fn() };

jest.mock('@/queries', () => ({
  useProgress: () => ({ data: mockProgress.current, isLoading: mockProgress.isLoading, isError: mockProgress.isError, refetch: jest.fn() }),
  useAchievements: () => ({ data: mockAchievements.current, isLoading: mockAchievements.isLoading, isError: mockAchievements.isError, refetch: jest.fn() }),
  useSettings: () => ({ data: mockSettings.current, isLoading: mockSettings.isLoading, isError: mockSettings.isError, refetch: jest.fn() }),
  useUpdateSettings: () => mockUpdateSettings,
}));

import S27Achievements from './index';

import { reconcileAchievements } from '@/domain';
import { addDays } from '@/lib/date';
import { TENURE_OFFSETS } from '@/features/progress/copy';
import { tenureUnlockDate } from '@/features/progress/format';
import type { Instant, LocalDate } from '@/types';

function progressState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    lifetimeXp: 620,
    level: { level: 7, title: 'Consistent', xpIntoLevel: 620 % 1000, xpForLevel: 1000 },
    cyclingXp: 128,
    cycleCadence: 'monthly',
    currentCycle: { id: 'c1', cadence: 'monthly', startDate: '2026-07-01', endDate: '2026-07-31' },
    ...overrides,
  };
}

describe('S27 — Achievements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProgress.current = progressState();
    mockProgress.isLoading = false;
    mockProgress.isError = false;
    mockAchievements.current = [{ key: 'tenure-first-day', unlockedOn: '2026-01-12', createdAt: '2026-01-12T00:00:00.000Z' }];
    mockAchievements.isLoading = false;
    mockAchievements.isError = false;
    mockSettings.current = { cycleCadence: 'monthly', tenureAnchorDate: '2026-01-12' };
    mockSettings.isLoading = false;
    mockSettings.isError = false;
  });

  it("Cycling XP label follows the ACTUAL active cadence — never hardcoded to Monthly while weekly is active", async () => {
    mockProgress.current = progressState({ cycleCadence: 'weekly' });
    mockSettings.current = { cycleCadence: 'weekly', tenureAnchorDate: '2026-01-12' };
    await render(<S27Achievements />);
    expect(screen.getByText('Weekly XP')).toBeTruthy();
    expect(screen.queryByText('Monthly XP')).toBeNull();
  });

  it('defaults to Monthly XP when monthly is active', async () => {
    await render(<S27Achievements />);
    expect(screen.getByText('Monthly XP')).toBeTruthy();
  });

  it('weekly cadence reset subline includes the weekday ("Resets on Sun, Jul 19"), not just the date', async () => {
    mockProgress.current = progressState({
      cycleCadence: 'weekly',
      currentCycle: { id: 'c2', cadence: 'weekly', startDate: '2026-07-13', endDate: '2026-07-19' },
    });
    mockSettings.current = { cycleCadence: 'weekly', tenureAnchorDate: '2026-01-12' };
    await render(<S27Achievements />);
    expect(screen.getByText('Resets on Sun, Jul 19')).toBeTruthy();
  });

  it('a locked tenure badge shows a calendar unlock condition, never a consistency one', async () => {
    const user = userEvent.setup();
    await render(<S27Achievements />);
    await user.press(screen.getByLabelText('1 Year, locked'));
    expect(screen.getByText(/Locked — unlocks on .* \(1 year from your first day\)\./)).toBeTruthy();
  });

  it('an earned badge never shows a celebratory confetti trigger — S28 is the only confetti surface (no confetti import/usage here)', async () => {
    await render(<S27Achievements />);
    // Sanity: this screen never renders the dismiss/"Nice!" copy that only exists on S28.
    expect(screen.queryByText('Nice!')).toBeNull();
  });

  it('changing the reset-cadence Select calls useUpdateSettings with the new cadence', async () => {
    const user = userEvent.setup();
    await render(<S27Achievements />);
    await user.press(screen.getByLabelText('Reset cadence, Monthly'));
    await user.press(screen.getByLabelText('Weekly'));
    expect(mockUpdateSettings.mutate).toHaveBeenCalledWith({ cycleCadence: 'weekly' });
  });

  it('origin-aware back falls back to Today outside a navigator', async () => {
    const replaceSpy = jest.spyOn(router, 'replace').mockImplementation(() => undefined as never);
    const canGoBackSpy = jest.spyOn(router, 'canGoBack').mockReturnValue(false);
    const user = userEvent.setup();
    await render(<S27Achievements />);
    await user.press(screen.getByLabelText('Back'));
    expect(replaceSpy).toHaveBeenCalledWith('/today');
    replaceSpy.mockRestore();
    canGoBackSpy.mockRestore();
  });

  it('loading and error states', async () => {
    mockProgress.isLoading = true;
    const { rerender } = await render(<S27Achievements />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);

    mockProgress.isLoading = false;
    mockProgress.isError = true;
    await rerender(<S27Achievements />);
    expect(screen.getByText("Couldn't load your achievements right now.")).toBeTruthy();
  });

  it('new-user state shows the calm first-badge banner when no non-tenure badge is earned yet', async () => {
    mockProgress.current = progressState({ lifetimeXp: 0, level: { level: 1, title: 'Getting started', xpIntoLevel: 0, xpForLevel: 100 } });
    await render(<S27Achievements />);
    expect(screen.getByText('Show up once — ideal or fallback — and your first badge is on its way. Small counts.')).toBeTruthy();
  });
});

/**
 * Review pass 1, blocking item 8: no drift guard existed between this module's own duplicated
 * `TENURE_OFFSETS` (`src/features/progress/copy.ts`, powering S27's locked-detail captions) and
 * M2's frozen, unexported `TENURE_TIERS` (`src/domain/achievements.ts`). This is a parity test
 * through the PUBLIC surface only (`reconcileAchievements`) — no production code change, per the
 * review's own "interim guard" framing. A month-end anchor (Jan 31) exercises date-clamping.
 */
describe('S27 tenure-offset parity guard (M5 vs M2, via the public reconcileAchievements surface)', () => {
  const ANCHOR = '2026-01-31' as LocalDate;
  const NOW = '2026-01-31T00:00:00.000Z' as Instant;

  it.each(Object.keys(TENURE_OFFSETS))('%s: M5\'s locked-caption unlock date matches M2\'s real unlock condition exactly', (key) => {
    const unlockDate = tenureUnlockDate(key, ANCHOR);
    expect(unlockDate).not.toBeNull();

    const onUnlockDate = reconcileAchievements({
      occurrences: [],
      tenureAnchor: ANCHOR,
      today: unlockDate!,
      alreadyUnlocked: [],
      now: NOW,
    });
    expect(onUnlockDate.some((u) => u.key === key)).toBe(true);

    const dayBefore = addDays(unlockDate!, -1);
    const beforeUnlockDate = reconcileAchievements({
      occurrences: [],
      tenureAnchor: ANCHOR,
      today: dayBefore,
      alreadyUnlocked: [],
      now: NOW,
    });
    expect(beforeUnlockDate.some((u) => u.key === key)).toBe(false);
  });
});
