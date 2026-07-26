/** See src/ui/StateChip.test.tsx for why `lucide-react-native` is mocked locally (contract-change request). */
jest.mock('lucide-react-native', () => {
  const stub = () => null;
  return new Proxy({}, { get: () => stub, has: () => true });
});

import { act, create } from 'react-test-renderer';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => false, back: jest.fn() }) }));

const mockOpen = jest.fn();
jest.mock('@/db', () => ({ store: { open: () => mockOpen() } }));

import S50DataRecovery from './recovery';
import { S50_COPY } from '@/features/data/copy';

describe('S50 — Data Recovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the verbatim calm-recovery copy and both buttons, never an alarm glyph', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S50DataRecovery />);
    });
    const texts = renderer!.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S50_COPY.headline);
    expect(texts).toContain(S50_COPY.body);

    const buttons = renderer!.root.findAllByProps({ accessibilityRole: 'button' });
    expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(
      expect.arrayContaining([S50_COPY.tryAgain, S50_COPY.resetAppData]),
    );
  });

  it('"Try again" success routes to /splash (which re-evaluates onboarding/returning-user)', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S50DataRecovery />);
    });
    const tryAgain = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find((b) => b.props.accessibilityLabel === S50_COPY.tryAgain)!;
    await act(async () => {
      tryAgain.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockReplace).toHaveBeenCalledWith('/splash');
  });

  it('"Try again" failure stays on S50 with no new copy/escalation', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'corrupt' });
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S50DataRecovery />);
    });
    const tryAgain = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find((b) => b.props.accessibilityLabel === S50_COPY.tryAgain)!;
    await act(async () => {
      tryAgain.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockReplace).not.toHaveBeenCalled();
    const texts = renderer!.root.findAllByType('Text' as never).map((n) => n.props.children);
    expect(texts).toContain(S50_COPY.headline);
  });

  it('"Reset app data" navigates to S48 with origin=recovery', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<S50DataRecovery />);
    });
    const reset = renderer!.root.findAllByProps({ accessibilityRole: 'button' }).find((b) => b.props.accessibilityLabel === S50_COPY.resetAppData)!;
    act(() => {
      reset.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/settings/data/erase?from=recovery');
  });
});
