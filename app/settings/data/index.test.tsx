/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => false, back: jest.fn() }) }));

const mockSettingsData: { current: unknown } = { current: undefined };
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  QUERY_KEYS: { settings: ['settings'] },
}));

const mockCreateBackup = jest.fn();
const mockRestoreBackup = jest.fn();
jest.mock('@/services/data', () => ({
  createBackup: () => mockCreateBackup(),
  restoreBackup: (uri: string) => mockRestoreBackup(uri),
}));

const mockGetDocumentAsync = jest.fn();
jest.mock('expo-document-picker', () => ({ getDocumentAsync: () => mockGetDocumentAsync() }));

jest.mock('react-native/Libraries/Share/Share', () => ({ share: jest.fn().mockResolvedValue({}) }));

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

import S47Data from './index';
import { S47_COPY } from '@/features/data/copy';

function renderScreen() {
  const client = new QueryClient();
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
  });

  it('default, no backup yet: shows "No backup yet."', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    await renderScreen();
    expect(screen.getByText(S47_COPY.noBackupYet)).toBeTruthy();
  });

  it('default, has a backup: shows the "Last backup: <formatted>" subcopy', async () => {
    mockSettingsData.current = { lastBackupAt: '2026-07-14T13:12:00.000Z' };
    await renderScreen();
    expect(screen.getByText(new RegExp(`^${S47_COPY.lastBackupPrefix}`))).toBeTruthy();
  });

  it('the erase-all row navigates to S48 with origin=data', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByLabelText(`${S47_COPY.eraseRow}. ${S47_COPY.eraseSubcopy}`));
    expect(mockPush).toHaveBeenCalledWith('/settings/data/erase?from=data');
  });

  it('a successful backup shows the success toast', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockCreateBackup.mockResolvedValue({ ok: true, value: { uri: 'file:///x.fallbackbak', createdAt: '2026-07-16T08:03:00.000Z' } });
    const user = userEvent.setup();
    await renderScreen();
    await user.press(screen.getByText(S47_COPY.backUpNow));
    await waitFor(() =>
      expect(mockShowToast.mock.calls.some((c) => (c[0] as string).startsWith(S47_COPY.backupSuccessPrefix) && c[1] === 'success')).toBe(true),
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
});
