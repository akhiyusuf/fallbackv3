/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

import S49HelpAndAbout from './help';
import { S49_COPY } from '@/features/settings/copy';

describe('S49 — Help & About', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });

  it('renders every support/legal row, the privacy promise and the footer verbatim', async () => {
    await render(<S49HelpAndAbout />);
    for (const row of [...S49_COPY.supportSection, ...S49_COPY.legalSection]) {
      expect(screen.getByText(row.label)).toBeTruthy();
    }
    expect(screen.getByText(S49_COPY.privacy)).toBeTruthy();
    expect(screen.getByText(S49_COPY.version)).toBeTruthy();
    expect(screen.getByText(S49_COPY.tagline)).toBeTruthy();
  });

  it('each Support row announces its OWN destination type, not a blanket "opens email" (review pass 1, blocking item 7)', async () => {
    await render(<S49HelpAndAbout />);
    expect(screen.getByLabelText('Contact support, opens email')).toBeTruthy();
    expect(screen.getByLabelText('FAQ & guides, opens an external help center')).toBeTruthy();
    expect(screen.getByLabelText('Rate Fallback, opens the app store')).toBeTruthy();
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

  it('on Android, "Rate Fallback" attempts a real Play Store hand-off instead of only a toast', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    await render(<S49HelpAndAbout />);
    await user.press(screen.getByText('Rate Fallback'));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('market://details?id=com.fallback.app'));
    expect(mockShowToast).not.toHaveBeenCalled();
    canOpenURL.mockRestore();
    openURL.mockRestore();
  });

  it('on iOS, "Rate Fallback" has no real target (no app-store id pinned anywhere) and keeps the disclosed toast interim', async () => {
    const openURL = jest.spyOn(Linking, 'openURL');
    const user = userEvent.setup();
    await render(<S49HelpAndAbout />);
    await user.press(screen.getByText('Rate Fallback'));
    expect(openURL).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Opening the App Store…', 'neutral');
    openURL.mockRestore();
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
