/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

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

describe('S48 — Erase-All Confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = undefined;
  });

  it('renders the S47 ("data") origin copy by default', async () => {
    mockFrom = 'data';
    await render(<S48EraseAllConfirmation />);
    expect(screen.getByText(S48_COPY.headlineFromData)).toBeTruthy();
    expect(screen.getByText(S48_COPY.bodyFromData)).toBeTruthy();
  });

  it('renders the S50 ("recovery") origin copy when from=recovery', async () => {
    mockFrom = 'recovery';
    await render(<S48EraseAllConfirmation />);
    expect(screen.getByText(S48_COPY.headlineFromRecovery)).toBeTruthy();
    expect(screen.getByText(S48_COPY.bodyFromRecovery)).toBeTruthy();
  });

  it('Cancel from S47 ("data") origin returns to /settings/data', async () => {
    mockFrom = 'data';
    const user = userEvent.setup();
    await render(<S48EraseAllConfirmation />);
    await user.press(screen.getByText(S48_COPY.cancelButton));
    expect(mockReplace).toHaveBeenCalledWith('/settings/data');
  });

  it('Cancel from S50 ("recovery") origin returns to /recovery', async () => {
    mockFrom = 'recovery';
    const user = userEvent.setup();
    await render(<S48EraseAllConfirmation />);
    await user.press(screen.getByText(S48_COPY.cancelButton));
    expect(mockReplace).toHaveBeenCalledWith('/recovery');
  });

  it('a successful erase navigates to S01 (/splash) regardless of origin', async () => {
    mockFrom = 'data';
    mockEraseAllData.mockResolvedValue({ ok: true, value: undefined });
    const user = userEvent.setup();
    await render(<S48EraseAllConfirmation />);
    await user.press(screen.getByText(S48_COPY.eraseButton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
  });

  it('a failed erase shows the calm mid-wipe retry banner and re-enables the button — nothing was lost', async () => {
    mockFrom = 'data';
    mockEraseAllData.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<S48EraseAllConfirmation />);
    await user.press(screen.getByText(S48_COPY.eraseButton));
    await waitFor(() => expect(screen.getByText(S48_COPY.midWipeFailure)).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(`${S48_COPY.eraseButton}, destructive action`).props.accessibilityState.disabled).toBe(false);
  });
});
