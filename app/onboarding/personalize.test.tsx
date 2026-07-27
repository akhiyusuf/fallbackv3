/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useThemeStore, useToastStore } from '@/app-shell';
import { DEFAULT_ACCENT } from '@/theme';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockSettingsData: { current: unknown } = { current: undefined };
const mockUpdateSettingsMutateAsync = jest.fn();
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

import S06OnboardingMakeItYours from './personalize';
import { S06_COPY } from '@/features/onboarding/copy';

const BASE_SETTINGS = {
  accent: DEFAULT_ACCENT,
  notifications: {
    master: false,
    routineDue: true,
    eventStarting: true,
    courseDose: true,
    courseEndingSoon: true,
    gentleReentry: true,
    milestoneReached: true,
    dailyDigest: false,
    dailyDigestTime: '08:00',
  },
};

describe('S06 — Onboarding: Make it yours', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = BASE_SETTINGS;
    useThemeStore.setState({ mode: 'auto', accent: DEFAULT_ACCENT });
    useToastStore.setState({ toast: null });
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
  });

  it('default: no Skip control, Forge Orange pre-selected, reminders off', async () => {
    await render(<S06OnboardingMakeItYours />);
    expect(screen.queryByLabelText('Skip onboarding')).toBeNull();
    expect(screen.getByLabelText('Forge Orange, selected')).toBeTruthy();
    expect(screen.getByLabelText(`${S06_COPY.remindersRowLabel}, off`)).toBeTruthy();
  });

  it('picking an accent updates the app-wide theme store immediately', async () => {
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Indigo'));
    expect(useThemeStore.getState().accent).toBe('indigo');
  });

  it('reminders off -> Next routes straight to S08, skipping the notification primer', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Next'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/first-task'));
    push.mockRestore();
  });

  it('reminders on -> Next routes to S07 (the OS permission primer)', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText(`${S06_COPY.remindersRowLabel}, off`));
    await user.press(screen.getByLabelText('Next'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/notifications-primer'));
    push.mockRestore();
  });

  it('a persist failure on Next reverts the selection and shows the calm retry toast', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Indigo'));
    await user.press(screen.getByLabelText('Next'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S06_COPY.saveFailure));
    expect(useThemeStore.getState().accent).toBe(DEFAULT_ACCENT);
  });
});
