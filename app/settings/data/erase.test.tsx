/** See src/ui/StateChip.test.tsx for why `lucide-react-native` is mocked locally (contract-change request). */
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub, has: () => true });
});

import { act, create } from 'react-test-renderer';

const mockReplace = jest.fn();
let mockFrom: string | undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), canGoBack: () => false, back: jest.fn() }),
  useLocalSearchParams: () => ({ from: mockFrom }),
}));

const mockEraseAllData = jest.fn();
jest.mock('@/services/data', () => ({ eraseAllData: () => mockEraseAllData() }));

import S48EraseAllConfirmation from './erase';
import { S48_COPY } from '@/features/data/copy';

function findButton(root: ReturnType<typeof create>['root'], label: string) {
  return root.findAllByProps({ accessibilityRole: 'button' }).find((b) => (b.props.accessibilityLabel as string).startsWith(label))!;
}

describe('S48 — Erase-All Confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = undefined;
  });

  it('renders the S47 ("data") origin copy by default', () => {
    mockFrom = 'data';
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S48EraseAllConfirmation />);
    });
    const texts = renderer!.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S48_COPY.headlineFromData);
    expect(texts).toContain(S48_COPY.bodyFromData);
  });

  it('renders the S50 ("recovery") origin copy when from=recovery', () => {
    mockFrom = 'recovery';
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S48EraseAllConfirmation />);
    });
    const texts = renderer!.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S48_COPY.headlineFromRecovery);
    expect(texts).toContain(S48_COPY.bodyFromRecovery);
  });

  it('Cancel from S47 origin returns to /settings/data; from S50 origin returns to /recovery', () => {
    mockFrom = 'data';
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S48EraseAllConfirmation />);
    });
    act(() => {
      findButton(renderer!.root, S48_COPY.cancelButton).props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith('/settings/data');

    mockReplace.mockClear();
    mockFrom = 'recovery';
    act(() => {
      renderer = create(<S48EraseAllConfirmation />);
    });
    act(() => {
      findButton(renderer!.root, S48_COPY.cancelButton).props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith('/recovery');
  });

  it('a successful erase navigates to S01 (/splash) regardless of origin', async () => {
    mockFrom = 'data';
    mockEraseAllData.mockResolvedValue({ ok: true, value: undefined });
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S48EraseAllConfirmation />);
    });
    await act(async () => {
      findButton(renderer!.root, S48_COPY.eraseButton).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockReplace).toHaveBeenCalledWith('/splash');
  });

  it('a failed erase shows the calm mid-wipe retry banner and re-enables the button — nothing was lost', async () => {
    mockFrom = 'data';
    mockEraseAllData.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S48EraseAllConfirmation />);
    });
    await act(async () => {
      findButton(renderer!.root, S48_COPY.eraseButton).props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    const texts = renderer!.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S48_COPY.midWipeFailure);
    const eraseButton = findButton(renderer!.root, S48_COPY.eraseButton);
    expect(eraseButton.props.disabled).toBe(false);
  });
});
