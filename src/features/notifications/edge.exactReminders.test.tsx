/** Round 4: the exact-reminders ask, its native wrapper, and the Settings row. */
const mockAllowed = jest.fn(() => false);
const mockOpen = jest.fn(() => true);
jest.mock('@/services/exactAlarms', () => ({ exactRemindersAllowed: () => mockAllowed(), openExactReminderSettings: () => mockOpen() }));
const mockHasPermission = jest.fn(async () => true);
jest.mock('@/services/notifications', () => ({ notifications: { hasPermission: () => mockHasPermission() }, initNotificationsBridge: jest.fn() }));
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: jest.fn() }));
const mockStore = new Map<string, string>();
const mockGet = jest.fn(async (k: string) => mockStore.get(k) ?? null);
const mockSet = jest.fn(async (k: string, v: string) => {
  mockStore.set(k, v);
});
jest.mock('expo-secure-store', () => ({ getItemAsync: (k: string) => mockGet(k), setItemAsync: (k: string, v: string) => mockSet(k, v) }));
const mockSettings: { current: unknown } = { current: undefined };
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettings.current, isLoading: false }),
  useTasks: () => ({ data: [] }),
  useUpdateSettings: () => ({ mutateAsync: jest.fn(async () => ({ ok: true })) }),
}));

import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useAddMenuStore } from '@/app-shell/stores/addMenu';
import { useCelebrationStore } from '@/app-shell/stores/celebration';
import { useToastStore } from '@/app-shell/stores/toast';
import { S42_COPY } from '@/features/settings/copy';
import S42NotificationsSettings from '../../../app/settings/notifications';
import { EXACT_ASKED_KEY, EXACT_REMINDERS_COPY, ExactRemindersAsk } from './ExactRemindersAsk';

const settle = () => new Promise((r) => setTimeout(r, 25));
const prefs = { master: true, routineDue: true, eventStarting: true, courseDose: true, courseEndingSoon: true, gentleReentry: true, milestoneReached: true, dailyDigest: false, dailyDigestTime: '08:00' };

beforeEach(() => {
  mockStore.clear();
  mockGet.mockClear();
  mockSet.mockClear();
  mockAllowed.mockReset().mockReturnValue(false);
  mockOpen.mockReset().mockReturnValue(true);
  mockHasPermission.mockReset().mockResolvedValue(true);
  useAddMenuStore.setState({ open: false });
  useCelebrationStore.setState({ queue: [] });
  useToastStore.setState({ toast: null });
  mockSettings.current = { notifications: prefs };
});

describe('the ask never stacks on another sheet', () => {
  it('waits while a milestone pop-up is queued, then shows once it is dismissed (and is not counted as asked meanwhile)', async () => {
    useCelebrationStore.setState({ queue: [{ kind: 'level-up', lifetimeXp: 100 }] });
    await render(<ExactRemindersAsk />);
    await settle();
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
    expect(mockStore.has(EXACT_ASKED_KEY)).toBe(false);
    await act(async () => useCelebrationStore.getState().shift());
    expect(await screen.findByText(EXACT_REMINDERS_COPY.title)).toBeTruthy();
  });

  it('waits while the add menu is open', async () => {
    useAddMenuStore.setState({ open: true });
    await render(<ExactRemindersAsk />);
    await settle();
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
    await act(async () => useAddMenuStore.getState().hide());
    expect(await screen.findByText(EXACT_REMINDERS_COPY.title)).toBeTruthy();
  });

  it('opening the add menu or a milestone arriving while the ask is up hides it again (never two sheets), and it comes back after', async () => {
    await render(<ExactRemindersAsk />);
    expect(await screen.findByText(EXACT_REMINDERS_COPY.title)).toBeTruthy();
    await act(async () => useCelebrationStore.getState().push({ kind: 'badge', badgeKey: 'x' }));
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
    await act(async () => useCelebrationStore.getState().shift());
    expect(await screen.findByText(EXACT_REMINDERS_COPY.title)).toBeTruthy();
  });

  it('`hold` (the first-habit banner or the welcome back note on Today) delays it without losing it', async () => {
    const view = await render(<ExactRemindersAsk hold />);
    await settle();
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
    await view.rerender(<ExactRemindersAsk hold={false} />);
    expect(await screen.findByText(EXACT_REMINDERS_COPY.title)).toBeTruthy();
  });
});

describe('answers', () => {
  it('Allow when the system page cannot open: a calm line, never asked again, no crash', async () => {
    mockOpen.mockReturnValue(false);
    await render(<ExactRemindersAsk />);
    await userEvent.press(await screen.findByText(EXACT_REMINDERS_COPY.allow));
    expect(useToastStore.getState().toast?.message).toBe(S42_COPY.exactTimingCannotOpen);
    expect(useToastStore.getState().toast?.tone).not.toBe('warning');
    expect(S42_COPY.exactTimingCannotOpen).not.toMatch(/—|–|error|fail|sorry/i);
    await waitFor(() => expect(mockStore.get(EXACT_ASKED_KEY)).toBe('1'));
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
  });

  it('Allow when the page opens shows no toast', async () => {
    await render(<ExactRemindersAsk />);
    await userEvent.press(await screen.findByText(EXACT_REMINDERS_COPY.allow));
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('erase all data (the key removed) asks again on the next visit', async () => {
    await render(<ExactRemindersAsk />);
    await userEvent.press(await screen.findByText(EXACT_REMINDERS_COPY.notNow));
    await waitFor(() => expect(mockStore.get(EXACT_ASKED_KEY)).toBe('1'));
    mockStore.delete(EXACT_ASKED_KEY);
    await render(<ExactRemindersAsk />);
    expect(await screen.findByText(EXACT_REMINDERS_COPY.title)).toBeTruthy();
  });

  it('the erase list includes this key', () => {
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'src/db/lifecycle.ts'), 'utf8') as string;
    expect(src).toContain(`'${EXACT_ASKED_KEY}'`);
  });

  it('a secure store that throws on read never asks (cannot remember an answer)', async () => {
    mockGet.mockRejectedValueOnce(new Error('keystore locked'));
    await render(<ExactRemindersAsk />);
    await settle();
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
  });

  it('a secure store that throws on write still closes the ask and does not crash', async () => {
    mockSet.mockRejectedValueOnce(new Error('disk full'));
    await render(<ExactRemindersAsk />);
    await userEvent.press(await screen.findByText(EXACT_REMINDERS_COPY.notNow));
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
  });

  it('a permission check that throws never asks', async () => {
    mockHasPermission.mockRejectedValueOnce(new Error('nope'));
    await render(<ExactRemindersAsk />);
    await settle();
    expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
  });

  it('unmounting before the permission check answers does not show or throw', async () => {
    let release: (v: boolean) => void = () => undefined;
    mockHasPermission.mockImplementationOnce(() => new Promise<boolean>((r) => (release = r)));
    const view = await render(<ExactRemindersAsk />);
    await settle();
    await view.unmount();
    release(true);
    await settle();
  });

  it('copy has no em dash', () => {
    for (const v of Object.values(EXACT_REMINDERS_COPY)) expect(v).not.toMatch(/—/);
  });
});

describe('Settings > Notifications row', () => {
  it('shows when exact timing is off and notifications are on; tapping opens the system page', async () => {
    await render(<S42NotificationsSettings />);
    await userEvent.press(screen.getByTestId('s42-exact-timing'));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toast).toBeNull();
  });

  it('tapping when the page cannot open says something calm', async () => {
    mockOpen.mockReturnValue(false);
    await render(<S42NotificationsSettings />);
    await userEvent.press(screen.getByTestId('s42-exact-timing'));
    expect(useToastStore.getState().toast?.message).toBe(S42_COPY.exactTimingCannotOpen);
  });

  it('is hidden when exact timing is already on, and when notifications are off', async () => {
    mockAllowed.mockReturnValue(true);
    const view = await render(<S42NotificationsSettings />);
    expect(screen.queryByTestId('s42-exact-timing')).toBeNull();
    await view.unmount();
    mockAllowed.mockReturnValue(false);
    mockSettings.current = { notifications: { ...prefs, master: false } };
    await render(<S42NotificationsSettings />);
    expect(screen.queryByTestId('s42-exact-timing')).toBeNull();
  });

  it('coming back from the system page (app active) with exact timing now on hides the row; off again brings it back', async () => {
    let handler: (s: string) => void = () => undefined;
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove };
    }) as never);
    const view = await render(<S42NotificationsSettings />);
    expect(screen.getByTestId('s42-exact-timing')).toBeTruthy();
    mockAllowed.mockReturnValue(true);
    await act(async () => handler('background'));
    expect(screen.getByTestId('s42-exact-timing')).toBeTruthy(); // only 'active' re-reads
    await act(async () => handler('active'));
    expect(screen.queryByTestId('s42-exact-timing')).toBeNull();
    mockAllowed.mockReturnValue(false);
    await act(async () => handler('active'));
    expect(screen.getByTestId('s42-exact-timing')).toBeTruthy();
    await view.unmount();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});
