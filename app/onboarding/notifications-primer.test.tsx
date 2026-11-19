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

// The primer reads the saved notification settings and writes them back on Allow / Not now.
const mockSettings: { current: { notifications: Record<string, boolean> } } = {
  current: { notifications: { master: false, routineDue: false, eventStarting: false, courseDose: false, gentleReentry: false } },
};
const mockUpdateSettings = jest.fn().mockResolvedValue({ ok: true });
const mockSettingsLoaded = { current: true };
const mockRefetch = jest.fn();
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsLoaded.current ? mockSettings.current : undefined, refetch: () => mockRefetch() }),
  useUpdateSettings: () => ({ mutateAsync: (args: unknown) => mockUpdateSettings(args) }),
}));

import S07NotificationPermissionPrimer from './notifications-primer';
import { S07_COPY } from '@/features/onboarding/copy';

const REMINDERS_ON = { master: true, routineDue: true, eventStarting: true, courseDose: true, gentleReentry: true };

describe('S07 — Notification Permission Primer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsLoaded.current = true;
    mockSettings.current = { notifications: { master: false, routineDue: false, eventStarting: false, courseDose: false, gentleReentry: false } };
  });

  it('renders the rationale and the sample notification preview', async () => {
    await render(<S07NotificationPermissionPrimer />);
    expect(screen.getByText(S07_COPY.headline)).toBeTruthy();
    expect(screen.getByText(S07_COPY.previewTitle)).toBeTruthy();
    expect(screen.getByLabelText('Allow notifications')).toBeTruthy();
    expect(screen.getByLabelText('Not now')).toBeTruthy();
    expect(screen.getByLabelText('Step 6 of 7')).toBeTruthy();
  });

  it('"Allow" primes the OS system prompt then proceeds to S08 (pushed, so Back returns here) regardless of outcome', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications'));
    expect(mockRequestPermission).toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/first-task'));
    push.mockRestore();
  });

  it('"Not now" declines without ever calling the OS prompt, and still proceeds to S08 (F9 — fully usable if declined)', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Not now'));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/first-task'));
    push.mockRestore();
  });

  it('"Not now" turns reminders back off if they were on (the person came back and changed their mind)', async () => {
    mockSettings.current = { notifications: REMINDERS_ON };
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Not now'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/first-task'));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ notifications: { ...REMINDERS_ON, master: false } });
    push.mockRestore();
  });

  it('mounting arms both the notifications and widgets bridges (review pass 1, blocking item 1)', async () => {
    await render(<S07NotificationPermissionPrimer />);
    expect(mockInitNotificationsBridge).toHaveBeenCalled();
    expect(mockInitWidgetsBridge).toHaveBeenCalled();
  });

  it('a granted "Allow" turns the described reminders on and re-arms them directly — a permission grant alone emits no bus event (review pass 1, blocking item 1)', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications'));
    await waitFor(() => expect(mockReschedule).toHaveBeenCalled());
    expect(mockUpdateSettings).toHaveBeenCalledWith({ notifications: REMINDERS_ON });
    push.mockRestore();
  });

  it('a declined "Allow" does not reschedule or turn reminders on, and still proceeds', async () => {
    mockRequestPermission.mockResolvedValueOnce({ ok: true, value: false });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/first-task'));
    expect(mockReschedule).not.toHaveBeenCalled();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('Allow before the settings have loaded still turns the reminders on (it asks for them again)', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    mockSettingsLoaded.current = false;
    mockRefetch.mockResolvedValue({ data: mockSettings.current });
    const user = userEvent.setup();
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/first-task'));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ notifications: REMINDERS_ON });
    push.mockRestore();
  });

  it('a write that fails on Allow or Not now does not trap the person: the tour still goes on', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    mockUpdateSettings.mockRejectedValue(new Error('database closed'));
    mockSettings.current = { notifications: { ...REMINDERS_ON } };
    const user = userEvent.setup();
    const view = await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Not now'));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    await view.unmount();
    mockSettings.current = { notifications: { master: false, routineDue: false, eventStarting: false, courseDose: false, gentleReentry: false } };
    await render(<S07NotificationPermissionPrimer />);
    await user.press(screen.getByLabelText('Allow notifications'));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(2));
    mockUpdateSettings.mockResolvedValue({ ok: true });
    push.mockRestore();
  });
});
