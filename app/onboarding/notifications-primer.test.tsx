/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockRequestPermission = jest.fn().mockResolvedValue({ ok: true, value: true });
const mockReschedule = jest.fn().mockResolvedValue({ ok: true, value: undefined });
const mockInitNotificationsBridge = jest.fn();
jest.mock('@/services/notifications', () => ({
  notifications: { requestPermission: () => mockRequestPermission(), reschedule: () => mockReschedule() },
  initNotificationsBridge: () => mockInitNotificationsBridge(),
}));
const mockInitWidgetsBridge = jest.fn();
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => mockInitWidgetsBridge() }));

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

  it('mounting arms both the notifications and widgets bridges (review pass 1, blocking item 1)', async () => {
    await render(<S07NotificationPermissionPrimer />);
    expect(mockInitNotificationsBridge).toHaveBeenCalled();
    expect(mockInitWidgetsBridge).toHaveBeenCalled();
  });

  it('a granted "Allow" re-arms reminders directly — a permission grant alone emits no bus event (review pass 1, blocking item 1)', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications, button'));
    await waitFor(() => expect(mockReschedule).toHaveBeenCalled());
    replace.mockRestore();
  });

  it('a declined "Allow" does not reschedule', async () => {
    mockRequestPermission.mockResolvedValueOnce({ ok: true, value: false });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications, button'));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(mockReschedule).not.toHaveBeenCalled();
    replace.mockRestore();
  });
});
