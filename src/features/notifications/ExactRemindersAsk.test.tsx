const mockAllowed = jest.fn(() => false);
const mockOpen = jest.fn(() => true);
jest.mock('@/services/exactAlarms', () => ({ exactRemindersAllowed: () => mockAllowed(), openExactReminderSettings: () => mockOpen() }));
const mockHasPermission = jest.fn(async () => true);
jest.mock('@/services/notifications', () => ({ notifications: { hasPermission: () => mockHasPermission() } }));
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockStore.set(k, v);
  }),
}));

import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { EXACT_ASKED_KEY, EXACT_REMINDERS_COPY, ExactRemindersAsk } from './ExactRemindersAsk';

beforeEach(() => {
  mockStore.clear();
  mockAllowed.mockReset().mockReturnValue(false);
  mockOpen.mockReset().mockReturnValue(true);
  mockHasPermission.mockReset().mockResolvedValue(true);
});

describe('asking once for on-time reminders (Android)', () => {
  it('asks when notifications are allowed and exact timing is off; Allow opens the system page and it is not asked again', async () => {
    await render(<ExactRemindersAsk />);
    expect(await screen.findByText(EXACT_REMINDERS_COPY.title)).toBeTruthy();
    await userEvent.press(screen.getByText(EXACT_REMINDERS_COPY.allow));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockStore.get(EXACT_ASKED_KEY)).toBe('1'));
  });

  it('Not now also remembers the answer', async () => {
    await render(<ExactRemindersAsk />);
    await userEvent.press(await screen.findByText(EXACT_REMINDERS_COPY.notNow));
    expect(mockOpen).not.toHaveBeenCalled();
    await waitFor(() => expect(mockStore.get(EXACT_ASKED_KEY)).toBe('1'));
  });

  it('never asks once asked, when timing is already exact, or when notifications are off', async () => {
    for (const setup of [
      () => mockStore.set(EXACT_ASKED_KEY, '1'),
      () => mockAllowed.mockReturnValue(true),
      () => mockHasPermission.mockResolvedValue(false),
    ]) {
      mockStore.clear();
      mockAllowed.mockReturnValue(false);
      mockHasPermission.mockResolvedValue(true);
      setup();
      const view = await render(<ExactRemindersAsk />);
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByText(EXACT_REMINDERS_COPY.title)).toBeNull();
      await view.unmount();
    }
  });
});
