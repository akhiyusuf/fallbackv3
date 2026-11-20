/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), canGoBack: () => false, back: jest.fn() }) }));

const mockOpen = jest.fn();
const mockGetSettings = jest.fn();
jest.mock('@/db', () => ({ store: { open: () => mockOpen() }, repos: { settings: { get: () => mockGetSettings() } } }));
const mockBillingInit = jest.fn(async () => ({ ok: true }));
const mockRefreshEntitlement = jest.fn(async () => ({ ok: true }));
jest.mock('@/services/billing', () => ({ billing: { init: () => mockBillingInit(), refreshEntitlement: () => mockRefreshEntitlement() } }));
const mockPendingTap: { current: string | null } = { current: null };
jest.mock('@/services/notifications', () => ({
  takePendingTapRoute: () => {
    const r = mockPendingTap.current;
    mockPendingTap.current = null;
    return r;
  },
}));

import S01Splash from './splash';
import { useThemeStore } from '@/app-shell';
import { S01_COPY } from '@/features/data/copy';

describe('S01 — Splash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the verbatim wordmark, tagline and status copy', async () => {
    mockOpen.mockReturnValue(new Promise(() => {})); // never resolves — freezes on the loading state
    await render(<S01Splash />);
    expect(screen.getByText(S01_COPY.wordmark)).toBeTruthy();
    expect(screen.getByText(S01_COPY.tagline)).toBeTruthy();
    expect(screen.getByText(S01_COPY.status)).toBeTruthy();
  });

  it('routes to /today when the store opens ready and onboarding is complete', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: '2026-01-01T00:00:00.000Z' });
    await render(<S01Splash />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today'));
  });

  it('connects to the app store and checks the plan once the data is open', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: '2026-01-01T00:00:00.000Z', theme: 'auto', accent: 'forge-orange' });
    await render(<S01Splash />);
    await waitFor(() => expect(mockRefreshEntitlement).toHaveBeenCalledTimes(1));
    expect(mockBillingInit).toHaveBeenCalledTimes(1);
  });

  it('a reminder tap that opened the app lands on the screen it pointed to', async () => {
    mockPendingTap.current = '/today?reentry=1&taskId=abc';
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: '2026-01-01T00:00:00.000Z', theme: 'auto', accent: 'forge-orange' });
    await render(<S01Splash />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today?reentry=1&taskId=abc'));
  });

  it('puts the saved look (theme and color) back before the first screen', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: '2026-01-01T00:00:00.000Z', theme: 'dark', accent: 'ocean' });
    await render(<S01Splash />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/today'));
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().accent).toBe('ocean');
  });

  it('routes to /onboarding/concept (the first onboarding step) when onboarding is not complete', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: null });
    await render(<S01Splash />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/concept'));
  });

  it('routes to /recovery on a corrupt store — never a crash', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'corrupt' });
    await render(<S01Splash />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/recovery'));
    expect(mockGetSettings).not.toHaveBeenCalled();
  });

  // Review pass 1, non-blocking item 7: an unhandled rejection here used to hang the
  // splash forever instead of degrading to the recovery surface.
  it('routes to /recovery when repos.settings.get() throws after a ready open, instead of hanging', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockRejectedValue(new Error('settings singleton missing'));
    await render(<S01Splash />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/recovery'));
  });
});
