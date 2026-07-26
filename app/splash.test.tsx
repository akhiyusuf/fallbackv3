/**
 * `react-test-renderer` (not `@testing-library/react-native`) — see the note atop
 * `src/ui/Button.test.tsx` for why (a peer-dependency gap in the frozen `package.json`).
 */
import { act, create } from 'react-test-renderer';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), canGoBack: () => false, back: jest.fn() }) }));

const mockOpen = jest.fn();
const mockGetSettings = jest.fn();
jest.mock('@/db', () => ({ store: { open: () => mockOpen() }, repos: { settings: { get: () => mockGetSettings() } } }));

import S01Splash from './splash';
import { S01_COPY } from '@/features/data/copy';

async function flush() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(500);
  });
}

describe('S01 — Splash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the verbatim wordmark, tagline and status copy', async () => {
    mockOpen.mockReturnValue(new Promise(() => {})); // never resolves — freezes on the loading state
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S01Splash />);
    });
    const texts = renderer!.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S01_COPY.wordmark);
    expect(texts).toContain(S01_COPY.tagline);
    expect(texts).toContain(S01_COPY.status);
  });

  it('routes to /today when the store opens ready and onboarding is complete', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: '2026-01-01T00:00:00.000Z' });
    act(() => {
      create(<S01Splash />);
    });
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/today');
  });

  it('routes to /onboarding/hook when onboarding is not complete', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    mockGetSettings.mockResolvedValue({ onboardingCompletedAt: null });
    act(() => {
      create(<S01Splash />);
    });
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/hook');
  });

  it('routes to /recovery on a corrupt store — never a crash', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'corrupt' });
    act(() => {
      create(<S01Splash />);
    });
    await flush();
    expect(mockReplace).toHaveBeenCalledWith('/recovery');
    expect(mockGetSettings).not.toHaveBeenCalled();
  });
});
