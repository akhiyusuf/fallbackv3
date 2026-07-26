/** See src/ui/StateChip.test.tsx for why `lucide-react-native` is mocked locally (contract-change request). */
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub, has: () => true });
});

import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn(), canGoBack: () => false, back: jest.fn() }) }));

const mockSettingsData: { current: unknown } = { current: undefined };
const mockUpdateSettingsMutateAsync = jest.fn();
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

const mockPush = jest.fn();
jest.mock('@/services/sync', () => ({ getSyncProvider: () => ({ id: 'icloud-documents', isAvailable: async () => false, push: mockPush, pull: jest.fn() }) }));

import S45AccountAndSync from './sync';
import { S45_COPY } from '@/features/data/copy';

let activeRenderer: ReturnType<typeof create> | undefined;

function renderScreen() {
  const client = new QueryClient();
  act(() => {
    activeRenderer = create(
      <QueryClientProvider client={client}>
        <S45AccountAndSync />
      </QueryClientProvider>,
    );
  });
  return activeRenderer!;
}

const baseSettings = {
  theme: 'auto',
  accent: 'forge-orange',
  sync: { enabled: false, lastSyncedAt: null, lastError: null },
};

describe('S45 — Account & Sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = undefined;
  });

  afterEach(() => {
    // Switch.tsx's Animated.timing keeps a pending timer alive until unmount.
    act(() => activeRenderer?.unmount());
    activeRenderer = undefined;
  });

  it('sync-off (default): renders the no-login explainer and the off-state helper copy', () => {
    mockSettingsData.current = baseSettings;
    const renderer = renderScreen();
    const texts = renderer.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S45_COPY.noLoginHeadline);
    expect(texts).toContain(S45_COPY.noLoginBody);
    expect(texts).toContain(S45_COPY.onDeviceLabel);
    expect(texts).toContain(S45_COPY.offHelper);
  });

  it('sync-on, failed: renders the InlineRetryBanner failure copy instead of "Last synced"', () => {
    mockSettingsData.current = { ...baseSettings, sync: { enabled: true, lastSyncedAt: null, lastError: 'offline' } };
    const renderer = renderScreen();
    const texts = renderer.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S45_COPY.failure);
    expect(texts).not.toContain(S45_COPY.offHelper);
  });

  it('toggling the Switch on persists sync.enabled and attempts a push', async () => {
    mockSettingsData.current = baseSettings;
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
    mockPush.mockResolvedValue({ ok: true, value: '2026-01-01T00:00:00.000Z' });
    const renderer = renderScreen();
    const toggle = renderer.root.findByProps({ accessibilityRole: 'switch' });
    await act(async () => {
      toggle.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ sync: { enabled: true, lastSyncedAt: null, lastError: null } });
    expect(mockPush).toHaveBeenCalled();
  });

  it('tap back chevron navigates to /settings (S41)', () => {
    mockSettingsData.current = baseSettings;
    const renderer = renderScreen();
    const back = renderer.root.findByProps({ accessibilityLabel: 'Back' });
    act(() => {
      back.props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });
});
