/** See src/ui/StateChip.test.tsx for why `lucide-react-native` is mocked locally (contract-change request). */
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub, has: () => true });
});

import { act, create } from 'react-test-renderer';
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
  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <QueryClientProvider client={client}>
        <S47Data />
      </QueryClientProvider>,
    );
  });
  return renderer!;
}

function findButton(root: ReturnType<typeof create>['root'], label: string) {
  return root.findAllByProps({ accessibilityRole: 'button' }).find((b) => (b.props.accessibilityLabel as string) === label)!;
}

describe('S47 — Data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = undefined;
  });

  it('default, no backup yet: shows "No backup yet."', () => {
    mockSettingsData.current = { lastBackupAt: null };
    const renderer = renderScreen();
    const texts = renderer.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts.flat()).toContain(S47_COPY.noBackupYet);
  });

  it('default, has a backup: shows the "Last backup: <formatted>" subcopy', () => {
    mockSettingsData.current = { lastBackupAt: '2026-07-14T13:12:00.000Z' };
    const renderer = renderScreen();
    const texts = renderer.root.findAllByType('Text' as never).map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children));
    expect(texts.some((t: string) => typeof t === 'string' && t.startsWith(S47_COPY.lastBackupPrefix))).toBe(true);
  });

  it('the erase-all row navigates to S48 with origin=data', () => {
    mockSettingsData.current = { lastBackupAt: null };
    const renderer = renderScreen();
    const eraseRow = renderer.root.findByProps({ accessibilityLabel: `${S47_COPY.eraseRow}. ${S47_COPY.eraseSubcopy}` });
    act(() => {
      eraseRow.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/settings/data/erase?from=data');
  });

  it('a successful backup shows the success toast', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockCreateBackup.mockResolvedValue({ ok: true, value: { uri: 'file:///x.fallbackbak', createdAt: '2026-07-16T08:03:00.000Z' } });
    const renderer = renderScreen();
    const backUpButton = findButton(renderer.root, S47_COPY.backUpNow);
    await act(async () => {
      backUpButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockShowToast.mock.calls.some((c) => (c[0] as string).startsWith(S47_COPY.backupSuccessPrefix) && c[1] === 'success')).toBe(true);
  });

  it('a failed backup shows the calm retry toast, never a partial-success toast', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockCreateBackup.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const renderer = renderScreen();
    const backUpButton = findButton(renderer.root, S47_COPY.backUpNow);
    await act(async () => {
      backUpButton.props.onPress();
      await Promise.resolve();
    });
    expect(mockShowToast).toHaveBeenCalledWith(S47_COPY.backupFailureToast, 'warning');
  });

  it('a failed restore renders the inline failure banner, stating existing data is untouched', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockGetDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///bad.fallbackbak' }] });
    mockRestoreBackup.mockResolvedValue({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'bad file' } });
    const renderer = renderScreen();
    const restoreButton = findButton(renderer.root, S47_COPY.restoreFromBackup);
    await act(async () => {
      restoreButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const texts = renderer.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S47_COPY.restoreFailure);
  });

  it('cancelling the file picker leaves the screen in its default state', async () => {
    mockSettingsData.current = { lastBackupAt: null };
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    const renderer = renderScreen();
    const restoreButton = findButton(renderer.root, S47_COPY.restoreFromBackup);
    await act(async () => {
      restoreButton.props.onPress();
      await Promise.resolve();
    });
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });
});
