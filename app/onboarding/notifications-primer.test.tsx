/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockRequestPermission = jest.fn().mockResolvedValue({ ok: true, value: true });
jest.mock('@/services/notifications', () => ({ notifications: { requestPermission: () => mockRequestPermission() } }));

import S07NotificationPermissionPrimer from './notifications-primer';
import { S07_COPY } from '@/features/onboarding/copy';

describe('S07 — Notification Permission Primer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the rationale and the sample notification preview', async () => {
    await render(<S07NotificationPermissionPrimer />);
    expect(screen.getByText(S07_COPY.headline)).toBeTruthy();
    expect(screen.getByText(S07_COPY.previewTitle)).toBeTruthy();
    expect(screen.getByLabelText('Allow notifications, button')).toBeTruthy();
    expect(screen.getByLabelText('Not now, button')).toBeTruthy();
  });

  it('"Allow" primes the OS system prompt then proceeds to S08 regardless of outcome', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications, button'));
    expect(mockRequestPermission).toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding/first-task'));
    replace.mockRestore();
  });

  it('"Not now" declines without ever calling the OS prompt, and still proceeds to S08 (F9 — fully usable if declined)', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Not now, button'));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/onboarding/first-task'));
    replace.mockRestore();
  });
});
