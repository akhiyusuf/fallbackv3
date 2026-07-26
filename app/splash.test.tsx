/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), canGoBack: () => false, back: jest.fn() }) }));

const mockOpen = jest.fn();
const mockGetSettings = jest.fn();
jest.mock('@/db', () => ({ store: { open: () => mockOpen() }, repos: { settings: { get: () => mockGetSettings() } } }));

import S01Splash from './splash';
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

  it('routes to /onboarding/hook when onboarding is not complete', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: null });
    await render(<S01Splash />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/hook'));
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
