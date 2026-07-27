/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockSettingsData: { current: unknown } = { current: undefined };
const mockUpdateSettingsMutateAsync = jest.fn();
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

import S42NotificationsSettings from './notifications';
import { S42_COPY } from '@/features/settings/copy';

const ALL_ON = {
  master: true,
  routineDue: true,
  eventStarting: true,
  courseDose: true,
  courseEndingSoon: true,
  gentleReentry: true,
  milestoneReached: true,
  dailyDigest: false,
  dailyDigestTime: '08:00',
};

describe('S42 — Notifications Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = undefined;
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
  });

  it('default (some on): every section is visible and independently switchable', async () => {
    mockSettingsData.current = { notifications: ALL_ON };
    await render(<S42NotificationsSettings />);
    expect(screen.getByText(S42_COPY.reminderRows.routineDue)).toBeTruthy();
    expect(screen.getByText(S42_COPY.encouragementRows.gentleReentry)).toBeTruthy();
    expect(screen.queryByText(S42_COPY.emptyHeadline)).toBeNull();
  });

  it('Trigger A — master off: sections are replaced by the EmptyState, master row stays visible', async () => {
    mockSettingsData.current = { notifications: { ...ALL_ON, master: false } };
    await render(<S42NotificationsSettings />);
    expect(screen.getByText(S42_COPY.emptyHeadline)).toBeTruthy();
    expect(screen.queryByText(S42_COPY.reminderRows.routineDue)).toBeNull();
    expect(screen.getByLabelText(`${S42_COPY.masterLabel}, off, toggles all reminders`)).toBeTruthy();
  });

  it('Trigger B — master on, all subs off: sections STAY visible and switchable, plus the banner shows', async () => {
    const allSubsOff = { ...ALL_ON, routineDue: false, eventStarting: false, courseDose: false, courseEndingSoon: false, gentleReentry: false, milestoneReached: false, dailyDigest: false };
    mockSettingsData.current = { notifications: allSubsOff };
    await render(<S42NotificationsSettings />);
    expect(screen.getByText(S42_COPY.emptyHeadline)).toBeTruthy();
    // The controls a user needs to leave this state must still be present (never hidden).
    expect(screen.getByText(S42_COPY.reminderRows.routineDue)).toBeTruthy();
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(1);
  });

  it('toggling a sub-switch persists immediately', async () => {
    mockSettingsData.current = { notifications: ALL_ON };
    const user = userEvent.setup();
    await render(<S42NotificationsSettings />);
    await user.press(screen.getByLabelText(`${S42_COPY.reminderRows.routineDue}, on, toggles ${S42_COPY.reminderRows.routineDue.toLowerCase()} reminders`));
    await waitFor(() => expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ notifications: { ...ALL_ON, routineDue: false } }));
  });

  it('a persist failure shows the calm retry toast', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    mockSettingsData.current = { notifications: ALL_ON };
    const user = userEvent.setup();
    await render(<S42NotificationsSettings />);
    await user.press(screen.getByLabelText(`${S42_COPY.masterLabel}, on, toggles all reminders`));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S42_COPY.errorToast, 'warning'));
  });

  it('the daily digest time picker only appears once the digest switch is on', async () => {
    mockSettingsData.current = { notifications: { ...ALL_ON, dailyDigest: true, dailyDigestTime: '08:00' } };
    await render(<S42NotificationsSettings />);
    expect(screen.getByText('8:00 AM')).toBeTruthy();
  });

  it('tap back chevron navigates to S41', async () => {
    mockSettingsData.current = { notifications: ALL_ON };
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S42NotificationsSettings />);
    await user.press(screen.getByLabelText('Back'));
    expect(push).toHaveBeenCalledWith('/settings');
    push.mockRestore();
  });
});
