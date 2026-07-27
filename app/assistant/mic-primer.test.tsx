/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. Do NOT mock expo-router. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockRequestRecordingPermissionsAsync = jest.fn();
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: () => mockRequestRecordingPermissionsAsync(),
  getRecordingPermissionsAsync: jest.fn(async () => ({ granted: false })),
}));

import S37MicrophonePermissionPrimer from './mic-primer';
import { S37_COPY } from '@/features/assistant/copy';

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
});
