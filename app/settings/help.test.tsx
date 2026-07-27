/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

import S49HelpAndAbout from './help';
import { S49_COPY } from '@/features/settings/copy';

describe('S49 — Help & About', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders every support/legal row, the privacy promise and the footer verbatim', async () => {
    await render(<S49HelpAndAbout />);
    for (const row of [...S49_COPY.supportSection, ...S49_COPY.legalSection]) {
      expect(screen.getByText(row.label)).toBeTruthy();
    }
    expect(screen.getByText(S49_COPY.privacy)).toBeTruthy();
    expect(screen.getByText(S49_COPY.version)).toBeTruthy();
    expect(screen.getByText(S49_COPY.tagline)).toBeTruthy();
  });

  it('tapping "Contact support" shows the calm neutral "Opening…" toast', async () => {
    const user = userEvent.setup();
    await render(<S49HelpAndAbout />);
    await user.press(screen.getByText('Contact support'));
    expect(mockShowToast).toHaveBeenCalledWith('Opening your email app…', 'neutral');
  });

  it('tapping "Privacy policy" shows the calm neutral toast', async () => {
    const user = userEvent.setup();
    await render(<S49HelpAndAbout />);
    await user.press(screen.getByText('Privacy policy'));
    expect(mockShowToast).toHaveBeenCalledWith('Opening…', 'neutral');
  });

  it('tap back chevron navigates to S41', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S49HelpAndAbout />);
    await user.press(screen.getByLabelText('Back'));
    expect(push).toHaveBeenCalledWith('/settings');
    push.mockRestore();
  });
});
