/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => false, back: jest.fn() }) }));

const mockOpen = jest.fn();
jest.mock('@/db', () => ({ store: { open: () => mockOpen() } }));

import S50DataRecovery from './recovery';
import { S50_COPY } from '@/features/data/copy';

describe('S50 — Data Recovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the verbatim calm-recovery copy and both buttons, never an alarm glyph', async () => {
    await render(<S50DataRecovery />);
    expect(screen.getByText(S50_COPY.headline)).toBeTruthy();
    expect(screen.getByText(S50_COPY.body)).toBeTruthy();
    expect(screen.getByLabelText(S50_COPY.tryAgain)).toBeTruthy();
    expect(screen.getByLabelText(S50_COPY.resetAppData)).toBeTruthy();
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

  it('"Reset app data" navigates to S48 with origin=recovery', async () => {
    const user = userEvent.setup();
    await render(<S50DataRecovery />);
    await user.press(screen.getByLabelText(S50_COPY.resetAppData));
    expect(mockPush).toHaveBeenCalledWith('/settings/data/erase?from=recovery');
  });
});
