/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => false, back: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
}));

const mockSettingsData: { current: unknown } = { current: undefined };
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  QUERY_KEYS: { settings: ['settings'] },
}));

const mockCreateBackup = jest.fn();
const mockRestoreBackup = jest.fn();
const mockEraseAllData = jest.fn();
jest.mock('@/services/data', () => ({
  createBackup: () => mockCreateBackup(),
  restoreBackup: (uri: string) => mockRestoreBackup(uri),
  eraseAllData: () => mockEraseAllData(),
}));

const mockGetDocumentAsync = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: () => mockGetDocumentAsync() }));

jest.mock('react-native/Libraries/Share/Share', () => ({ share: jest.fn().mockResolvedValue({}) }));

const mockShowToast = jest.fn();
const mockHydrateTheme = jest.fn();
jest.mock('@/app-shell', () => ({
  useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }),
  useThemeStore: { getState: () => ({ hydrate: mockHydrateTheme }) },
}));

import S47Data from './index';
import { S47_COPY, S48_COPY } from '@/features/data/copy';

function renderScreen(client = new QueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <S47Data />
    </QueryClientProvider>,
  );
}

describe('S47 — Data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = undefined;
    mockParams.current = {};
  });

  it('default, no backup yet: shows "No backup yet."', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    await renderScreen();
    expect(screen.getByText(S47_COPY.noBackupYet)).toBeTruthy();
  });

  it('default, has a backup: shows the "Last backup <formatted>" subcopy', async () => {
    mockSettingsData.current = { lastBackupAt: '2026-07-14T13:12:00.000Z' };
    await renderScreen();
    expect(screen.getByText(/^Last backup \w{3} \d{1,2}, 2026 at /)).toBeTruthy();
  });

  it('the erase-all row opens the confirmation sheet and navigates nowhere', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.eraseRow));
    expect(screen.getByText(S48_COPY.headlineFromData)).toBeTruthy();
    expect(screen.getByText(S48_COPY.bodyFromData)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockEraseAllData).not.toHaveBeenCalled();
  });

  it('Cancel on the erase sheet erases nothing and leaves the screen unchanged', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.eraseRow));
    await user.press(screen.getByText(S48_COPY.cancelButton));
    expect(mockEraseAllData).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText(S48_COPY.bodyFromData)).toBeNull();
  });

  it('"Erase everything" erases, then goes to S01 (/splash)', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockEraseAllData.mockResolvedValue({ ok: true, value: undefined });
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.eraseRow));
    await user.press(screen.getByText(S48_COPY.eraseButton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
    expect(mockEraseAllData).toHaveBeenCalledTimes(1);
  });

  it('a failed erase shows the calm retry banner, stays on the sheet and does not navigate', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockEraseAllData.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.eraseRow));
    await user.press(screen.getByText(S48_COPY.eraseButton));
    await waitFor(() => expect(screen.getByText(S48_COPY.midWipeFailure)).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opening with confirmErase=1 (the erase route forwards here) shows the sheet straight away', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockParams.current = { confirmErase: '1' };
    await renderScreen();
    expect(screen.getByText(S48_COPY.headlineFromData)).toBeTruthy();
  });

  it('a successful backup shows the success toast', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockCreateBackup.mockResolvedValue({ ok: true, value: { uri: 'file:///x.fallbackbak', createdAt: '2026-07-16T08:03:00.000Z' } });
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.backUpNow));
    await waitFor(() =>
      expect(mockShowToast.mock.calls.some((c) => (c[0] as string).startsWith('Backed up ') && c[1] === 'success')).toBe(true),
    );
  });

  it('a failed backup shows the calm retry toast, never a partial-success toast', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockCreateBackup.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.backUpNow));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S47_COPY.backupFailureToast, 'warning'));
  });

  it('a failed restore renders the inline failure banner, stating existing data is untouched', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///bad.fallbackbak' }] });
    mockRestoreBackup.mockResolvedValue({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'bad file' } });
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.restoreFromBackup));
    await waitFor(() => expect(screen.getByText(S47_COPY.restoreFailure)).toBeTruthy());
  });

  it('cancelling the file picker leaves the screen in its default state', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.restoreFromBackup));
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });

  it('a restored backup brings its own look (theme and colour) back straight away', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///backup.json' }] });
    mockRestoreBackup.mockResolvedValue({ ok: true, value: undefined });
    const client = new QueryClient();
    client.setQueryData(['settings'], { theme: 'dark', accent: 'ocean' });
    const user = userEvent.setup();
    await renderScreen(client);
    await user.press(screen.getByText(S47_COPY.restoreFromBackup));
    await waitFor(() => expect(mockHydrateTheme).toHaveBeenCalledWith('dark', 'ocean'));
  });

  it('a file picker that fails to open shows the same restore failure banner and starts no restore', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockGetDocumentAsync.mockRejectedValue(new Error('picker unavailable'));
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.restoreFromBackup));
    await waitFor(() => expect(screen.getByText(S47_COPY.restoreFailure)).toBeTruthy());
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });
});
