/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useThemeStore, useToastStore } from '@/app-shell';
import { DEFAULT_ACCENT } from '@/theme';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockInitNotificationsBridge = jest.fn();
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: () => mockInitNotificationsBridge() }));
const mockInitWidgetsBridge = jest.fn();
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => mockInitWidgetsBridge() }));

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

  it('default: Skip is on the top bar (every step has one, D6), Forge Orange pre-selected, and no reminders row (reminders are asked on the next step)', async () => {
    await render(<S06OnboardingMakeItYours />);
    expect(screen.getByLabelText('Skip onboarding')).toBeTruthy();
    expect(screen.getByLabelText('Forge, selected')).toBeTruthy();
    expect(screen.queryByLabelText(`${S06_COPY.remindersRowLabel}, off`)).toBeNull();
    expect(screen.queryByText(S06_COPY.remindersRowLabel)).toBeNull();
  });

  it('shows one progress dot per step (seven), with step 5 as the current one, and no "Preview" button', async () => {
    await render(<S06OnboardingMakeItYours />);
    // The dots container is `accessibilityElementsHidden` (decorative — the shell's own
    // convention), so RNTL's default queries exclude it; opt back in explicitly.
    for (let dot = 1; dot <= 7; dot++) {
      expect(screen.getByTestId(`onboarding-dot-${dot}`, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.getByLabelText('Step 5 of 7')).toBeTruthy();
    expect(screen.queryByLabelText('Preview, illustrative only')).toBeNull();
  });

  it('does not arm the notification or widget bridges itself: the root layout arms them once at boot (app/_layout.test.tsx)', async () => {
    await render(<S06OnboardingMakeItYours />);
    expect(mockInitNotificationsBridge).not.toHaveBeenCalled();
    expect(mockInitWidgetsBridge).not.toHaveBeenCalled();
  });

  it('picking an accent updates the app-wide theme store immediately', async () => {
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Indigo'));
    expect(useThemeStore.getState().accent).toBe('indigo');
  });

  it('Next saves the colour and light/dark choice, then always routes to the notification primer (S07), whatever the colour', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Indigo'));
    await user.press(screen.getByLabelText('Next'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/onboarding/notifications-primer'));
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ accent: 'indigo', theme: 'auto' });
    expect(push).not.toHaveBeenCalledWith('/onboarding/first-task');
    push.mockRestore();
  });

  it('a write that throws on Next also reverts and shows the retry toast, instead of leaving Next spinning', async () => {
    mockUpdateSettingsMutateAsync.mockRejectedValue(new Error('database closed'));
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Indigo'));
    await user.press(screen.getByLabelText('Next'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(S06_COPY.saveFailure));
    expect(useThemeStore.getState().accent).toBe(DEFAULT_ACCENT);
    expect(screen.getByLabelText('Next').props.accessibilityState?.disabled).not.toBe(true);
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

  it('a colour or light/dark pick is kept at once, so it survives Skip or a kill before Next', async () => {
    const user = userEvent.setup();
    await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Indigo'));
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ accent: 'indigo' });
    await user.press(screen.getByText(S06_COPY.appearanceOptions[2]!.label));
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ theme: S06_COPY.appearanceOptions[2]!.value });
    expect(useThemeStore.getState().mode).toBe(S06_COPY.appearanceOptions[2]!.value);
  });

  it('a settings reload after a save does not put an older colour back over a newer pick', async () => {
    const user = userEvent.setup();
    const view = await render(<S06OnboardingMakeItYours />);
    await user.press(screen.getByLabelText('Indigo'));
    mockSettingsData.current = { ...BASE_SETTINGS, accent: 'indigo' };
    await user.press(screen.getByLabelText('Forge'));
    await view.rerender(<S06OnboardingMakeItYours />);
    expect(useThemeStore.getState().accent).toBe('forge-orange');
  });
});
