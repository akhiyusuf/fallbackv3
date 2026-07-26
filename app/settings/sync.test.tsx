/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';

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

  it('sync-off (default): renders the no-login explainer and the off-state helper copy', async () => {
    mockSettingsData.current = baseSettings;
    await render(<S45AccountAndSync />);
    expect(screen.getByText(S45_COPY.noLoginHeadline)).toBeTruthy();
    expect(screen.getByText(S45_COPY.noLoginBody)).toBeTruthy();
    expect(screen.getByText(S45_COPY.onDeviceLabel)).toBeTruthy();
    expect(screen.getByText(S45_COPY.offHelper)).toBeTruthy();
  });

  it('sync-on, failed: renders the InlineRetryBanner failure copy instead of "Last synced"', async () => {
    mockSettingsData.current = { ...baseSettings, sync: { enabled: true, lastSyncedAt: null, lastError: 'offline' } };
    await render(<S45AccountAndSync />);
    expect(screen.getByText(S45_COPY.failure)).toBeTruthy();
    expect(screen.queryByText(S45_COPY.offHelper)).toBeNull();
  });

  // Review pass 1, non-blocking item 6: sync just turned on, no push has resolved yet (e.g.
  // the app died mid-first-push) — must render neither a dangling "Last synced" with no
  // time, nor the (now-false) off-device helper.
  it('sync-on, no push has resolved yet: renders neither a dangling "Last synced" prefix nor the off-helper', async () => {
    mockSettingsData.current = { ...baseSettings, sync: { enabled: true, lastSyncedAt: null, lastError: null } };
    await render(<S45AccountAndSync />);
    expect(screen.queryByText(S45_COPY.lastSyncedPrefix)).toBeNull();
    expect(screen.queryByText(S45_COPY.offHelper)).toBeNull();
    expect(screen.queryByText(S45_COPY.failure)).toBeNull();
  });

  it('toggling the Switch on persists sync.enabled and attempts a push', async () => {
    mockSettingsData.current = baseSettings;
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
    mockPush.mockResolvedValue({ ok: true, value: '2026-01-01T00:00:00.000Z' });
    const user = userEvent.setup();
    await render(<S45AccountAndSync />);
    await user.press(screen.getByRole('switch'));
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ sync: { enabled: true, lastSyncedAt: null, lastError: null } });
    expect(mockPush).toHaveBeenCalled();
  });

  it('tap back chevron navigates to /settings (S41)', async () => {
    mockSettingsData.current = baseSettings;
    const user = userEvent.setup();
    await render(<S45AccountAndSync />);
    await user.press(screen.getByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/settings');
  });
});
