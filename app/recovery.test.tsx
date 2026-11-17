/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockParams: { confirmErase: string | undefined } = { confirmErase: undefined };
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => false, back: jest.fn() }),
  useLocalSearchParams: () => ({ confirmErase: mockParams.confirmErase }),
}));

const mockOpen = jest.fn();
jest.mock('@/db', () => ({ store: { open: () => mockOpen() } }));

import S50DataRecovery from './recovery';
import { S50_COPY, S48_COPY } from '@/features/data/copy';

describe('S50 — Data Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.confirmErase = undefined;
  });

  it('renders the verbatim calm-recovery copy and both buttons, never an alarm glyph', async () => {
    await render(<S50DataRecovery />);
    expect(screen.getByText(S50_COPY.headline)).toBeTruthy();
    expect(screen.getByText(S50_COPY.body)).toBeTruthy();
    expect(screen.getByLabelText(S50_COPY.tryAgain)).toBeTruthy();
    expect(screen.getByLabelText(S50_COPY.resetAppData)).toBeTruthy();
    expect(screen.queryByText(S48_COPY.headlineFromRecovery)).toBeNull();
  });

  it('"Try again" success routes to /splash (which re-evaluates onboarding/returning-user)', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'ready' });
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.tryAgain));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
  });

  it('"Try again" failure stays on S50 with no new copy/escalation', async () => {
    mockOpen.mockResolvedValue({ ok: true, value: 'corrupt' });
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.tryAgain));
    await waitFor(() => expect(mockOpen).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText(S50_COPY.headline)).toBeTruthy();
  });

  // D3: every destructive confirmation is a bottom sheet, so "Reset app data" opens the sheet over
  // this screen rather than navigating to a separate erase route.
  it('"Reset app data" opens the erase confirmation sheet over this screen (origin: recovery), without navigating', async () => {
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.resetAppData));
    expect(screen.getByText(S48_COPY.headlineFromRecovery)).toBeTruthy();
    expect(screen.getByText(S48_COPY.bodyFromRecovery)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('arriving with ?confirmErase=1 opens the same sheet straight away', async () => {
    mockParams.confirmErase = '1';
    await render(<S50DataRecovery />);
    expect(screen.getByText(S48_COPY.headlineFromRecovery)).toBeTruthy();
  });
});
