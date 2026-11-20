/** Round 2 edge pass: the recovery screen when the store keeps failing, throws, or is tapped twice. */
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockDismissAll = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), dismissAll: mockDismissAll, canGoBack: () => false, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const mockOpen = jest.fn();
const mockEraseAll = jest.fn();
jest.mock('@/db', () => ({ store: { open: () => mockOpen() } }));
jest.mock('@/services/data', () => ({ eraseAllData: () => mockEraseAll() }));

import S50DataRecovery from './recovery';
import { S48_COPY, S50_COPY } from '@/features/data/copy';

describe('S50 recovery, edge cases', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockDismissAll.mockReset();
    mockOpen.mockReset();
    mockEraseAll.mockReset();
  });

  it('Try again that fails twice and then works: the buttons come back each time and the third try goes to the splash', async () => {
    mockOpen.mockResolvedValueOnce({ ok: true, value: 'corrupt' }).mockResolvedValueOnce({ ok: false, error: { code: 'STORE_CORRUPT', message: 'x' } }).mockResolvedValueOnce({ ok: true, value: 'ready' });
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.tryAgain));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText(S50_COPY.tryAgain).props.accessibilityState?.disabled).not.toBe(true));
    await user.press(screen.getByLabelText(S50_COPY.tryAgain));
    await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText(S50_COPY.tryAgain).props.accessibilityState?.disabled).not.toBe(true));
    expect(mockReplace).not.toHaveBeenCalled();
    await user.press(screen.getByLabelText(S50_COPY.tryAgain));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
  });

  it('a store that throws is the same calm state: still on the screen, button usable again', async () => {
    mockOpen.mockRejectedValue(new Error('disk I/O error'));
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.tryAgain));
    await waitFor(() => expect(mockOpen).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText(S50_COPY.tryAgain).props.accessibilityState?.disabled).not.toBe(true));
    expect(screen.getByText(S50_COPY.headline)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('a double tap on Try again opens the store once', async () => {
    mockOpen.mockImplementation(() => new Promise((r) => setTimeout(() => r({ ok: true, value: 'ready' }), 30)));
    await render(<S50DataRecovery />);
    const button = screen.getByLabelText(S50_COPY.tryAgain);
    await fireEvent.press(button);
    await fireEvent.press(button);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('Reset app data then Cancel: nothing is erased and the sheet closes', async () => {
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.resetAppData));
    await user.press(await screen.findByText(S48_COPY.cancelButton));
    expect(mockEraseAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Reset app data then confirm: erases and starts again from the splash', async () => {
    mockEraseAll.mockResolvedValue({ ok: true, value: undefined });
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.resetAppData));
    await user.press(await screen.findByText(S48_COPY.eraseButton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
    expect(mockEraseAll).toHaveBeenCalledTimes(1);
  });

  it('a reset that fails shows the calm banner on this screen and goes nowhere', async () => {
    mockEraseAll.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'x' } });
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.resetAppData));
    await user.press(await screen.findByText(S48_COPY.eraseButton));
    expect(await screen.findByText(S48_COPY.midWipeFailure)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
