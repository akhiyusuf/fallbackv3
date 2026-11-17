/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockRedirect = jest.fn();
let mockFrom: string | undefined;
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  useLocalSearchParams: () => ({ from: mockFrom }),
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), canGoBack: () => false, back: jest.fn() }),
}));

const mockEraseAllData = jest.fn();
jest.mock('@/services/data', () => ({ eraseAllData: () => mockEraseAllData() }));

import S48EraseAllConfirmation from './erase';
import { EraseDataSheet } from '@/features/data/EraseDataSheet';
import { S48_COPY } from '@/features/data/copy';

describe('S48 — Erase-All route (forwards to the confirmation sheet)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = undefined;
  });

  it('from=data forwards to Settings > Data with the sheet opened', async () => {
    mockFrom = 'data';
    await render(<S48EraseAllConfirmation />);
    expect(mockRedirect).toHaveBeenLastCalledWith('/settings/data?confirmErase=1');
  });

  it('from=recovery forwards to the recovery screen with the sheet opened', async () => {
    mockFrom = 'recovery';
    await render(<S48EraseAllConfirmation />);
    expect(mockRedirect).toHaveBeenLastCalledWith('/recovery?confirmErase=1');
  });

  it('with no origin it falls back to Settings > Data', async () => {
    await render(<S48EraseAllConfirmation />);
    expect(mockRedirect).toHaveBeenLastCalledWith('/settings/data?confirmErase=1');
  });
});

describe('S48 — Erase confirmation sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Data-origin copy by default', async () => {
    await render(<EraseDataSheet visible onClose={jest.fn()} />);
    expect(screen.getByText(S48_COPY.headlineFromData)).toBeTruthy();
    expect(screen.getByText(S48_COPY.bodyFromData)).toBeTruthy();
  });

  it('renders the recovery-origin copy when fromRecovery is set', async () => {
    await render(<EraseDataSheet visible onClose={jest.fn()} fromRecovery />);
    expect(screen.getByText(S48_COPY.headlineFromRecovery)).toBeTruthy();
    expect(screen.getByText(S48_COPY.bodyFromRecovery)).toBeTruthy();
  });

  it('Cancel closes the sheet and erases nothing', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    await render(<EraseDataSheet visible onClose={onClose} />);
    await user.press(screen.getByText(S48_COPY.cancelButton));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockEraseAllData).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('confirming erases, closes, and goes to S01 (/splash) regardless of origin', async () => {
    const onClose = jest.fn();
    mockEraseAllData.mockResolvedValue({ ok: true, value: undefined });
    const user = userEvent.setup();
    await render(<EraseDataSheet visible onClose={onClose} fromRecovery />);
    await user.press(screen.getByText(S48_COPY.eraseButton));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/splash'));
    expect(mockEraseAllData).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('a failed erase shows the calm mid-wipe retry banner and re-enables the button — nothing was lost', async () => {
    const onClose = jest.fn();
    mockEraseAllData.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<EraseDataSheet visible onClose={onClose} />);
    await user.press(screen.getByText(S48_COPY.eraseButton));
    await waitFor(() => expect(screen.getByText(S48_COPY.midWipeFailure)).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(S48_COPY.eraseButton).props.accessibilityState.disabled).toBe(false);
  });
});
