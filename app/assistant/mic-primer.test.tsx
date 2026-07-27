/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library';
import { AppState, Text } from 'react-native';
import { router } from 'expo-router';

const mockRequestRecordingPermissionsAsync = jest.fn();
const mockGetRecordingPermissionsAsync = jest.fn(async () => ({ granted: false }));
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: () => mockRequestRecordingPermissionsAsync(),
  getRecordingPermissionsAsync: () => mockGetRecordingPermissionsAsync(),
}));

import S37MicrophonePermissionPrimer from './mic-primer';
import { S37_COPY } from '@/features/assistant/copy';

function ChatMarker() {
  return <Text>MARKER_ASSISTANT_CHAT</Text>;
}

describe('S37 — Microphone Permission Primer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('primer context: headline/body/actions match the primer framing', async () => {
    await render(<S37MicrophonePermissionPrimer />);
    expect(screen.getByText(S37_COPY.primer.headline)).toBeTruthy();
    expect(screen.getByText(S37_COPY.reassurance)).toBeTruthy();
    expect(screen.getByLabelText('Enable microphone access, button')).toBeTruthy();
  });

  it('primer — tap Enable, granted -> navigates to S32 in listening state', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S37MicrophonePermissionPrimer />);
    await userEvent.press(screen.getByLabelText('Enable microphone access, button'));
    expect(replace).toHaveBeenCalledWith('/assistant/chat?listen=1');
    replace.mockRestore();
  });

  it('primer — tap Enable, denied -> navigates to S32 in text-input state (never blocks the app)', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await render(<S37MicrophonePermissionPrimer />);
    await userEvent.press(screen.getByLabelText('Enable microphone access, button'));
    expect(replace).toHaveBeenCalledWith('/assistant/chat?listen=');
    replace.mockRestore();
  });

  it('B11 — recovery: does NOT re-check permission immediately after openSettings (that read would still see the stale value)', async () => {
    // `expo-router/testing-library` — the shipped official test harness, not a hand-rolled
    // mock of the package — is the only way to give this screen a real `context=recovery`
    // search param (house pattern's own note: outside a real navigator, params come back
    // empty).
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    await renderRouter(
      { 'mic-primer': S37MicrophonePermissionPrimer, 'assistant/chat': ChatMarker },
      { initialUrl: '/mic-primer?context=recovery' },
    );
    await userEvent.press(routerScreen.getByLabelText('Open system settings, button'));
    // The old bug called `getRecordingPermissionsAsync()` right after `openSettings()`
    // resolves — while the user is still inside Settings. It must NOT be called here; the
    // recheck only happens once the app is foregrounded again (see the next test).
    expect(mockGetRecordingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('B11 — recovery: rechecks permission on AppState -> "active", and navigates to S32 listening once granted', async () => {
    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    await renderRouter(
      { 'mic-primer': S37MicrophonePermissionPrimer, 'assistant/chat': ChatMarker },
      { initialUrl: '/mic-primer?context=recovery' },
    );
    await routerScreen.findByText(S37_COPY.recovery.headline);

    // `AppState.addEventListener` is jest's own preset mock (`@react-native/jest-preset`) —
    // it records the handler but never fires it, so drive the registered handler directly,
    // exactly the seam `AppState.addEventListener('change', handler)` exposes.
    const addEventListener = AppState.addEventListener as jest.Mock;
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    const handler = addEventListener.mock.calls[addEventListener.mock.calls.length - 1][1];

    mockGetRecordingPermissionsAsync.mockResolvedValue({ granted: true });
    await handler('active');

    await routerScreen.findByText('MARKER_ASSISTANT_CHAT');
  });
});
