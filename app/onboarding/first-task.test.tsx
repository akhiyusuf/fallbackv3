/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockCreateTaskMutateAsync = jest.fn();
const mockUpdateSettingsMutateAsync = jest.fn().mockResolvedValue({ ok: true });
jest.mock('@/queries', () => ({
  useCreateTask: () => ({ mutateAsync: mockCreateTaskMutateAsync }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

import S08OnboardingFirstTask from './first-task';
import { S08_COPY } from '@/features/onboarding/copy';

describe('S08 — Onboarding: First Task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTaskMutateAsync.mockResolvedValue({ ok: true, value: 'task-1' });
  });

  it('default: Save is disabled until Name, Ideal and Fallback all have content', async () => {
    const user = userEvent.setup();
    await render(<S08OnboardingFirstTask />);
    const save = screen.getByLabelText(S08_COPY.save);
    expect(save.props.accessibilityState?.disabled).toBe(true);

    await user.type(screen.getByLabelText(S08_COPY.nameLabel), 'Morning workout');
    await user.type(screen.getByLabelText(S08_COPY.idealLabel), 'Full workout');
    await user.type(screen.getByLabelText(S08_COPY.fallbackLabel), '10 pushups');
    expect(screen.getByLabelText(S08_COPY.save).props.accessibilityState?.disabled).toBe(false);
  });

  it('only "Routines" is selectable — the other three tiles are marked unavailable', async () => {
    await render(<S08OnboardingFirstTask />);
    expect(screen.getByLabelText('Events, unavailable until after setup')).toBeTruthy();
    expect(screen.getByLabelText('Courses, unavailable until after setup')).toBeTruthy();
    expect(screen.getByLabelText('To-dos, unavailable until after setup')).toBeTruthy();
  });

  it('save applies the four silent defaults (daily cadence, Medium/Recommended, Repeat icon, Forge Orange)', async () => {
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S08OnboardingFirstTask />);
    await user.type(screen.getByLabelText(S08_COPY.nameLabel), 'Morning workout');
    await user.type(screen.getByLabelText(S08_COPY.idealLabel), 'Full workout');
    await user.type(screen.getByLabelText(S08_COPY.fallbackLabel), '10 pushups');
    await user.press(screen.getByLabelText(S08_COPY.save));

    await waitFor(() => expect(mockCreateTaskMutateAsync).toHaveBeenCalled());
    const draft = mockCreateTaskMutateAsync.mock.calls[0][0];
    expect(draft.cadence).toEqual({ kind: 'daily' });
    expect(draft.importance).toBe('med');
    expect(draft.necessity).toBe('recommended');
    expect(draft.icon).toBe('Repeat');
    expect(draft.color).toBe('forge-orange');
    expect(draft.isAsNeeded).toBe(false);

    await waitFor(() => expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({ onboardingCompletedAt: expect.any(String) }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today?justAdded=1'));
    replace.mockRestore();
  });

  it('a persist failure shows the calm retry toast and preserves the typed content', async () => {
    mockCreateTaskMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<S08OnboardingFirstTask />);
    await user.type(screen.getByLabelText(S08_COPY.nameLabel), 'Morning workout');
    await user.type(screen.getByLabelText(S08_COPY.idealLabel), 'Full workout');
    await user.type(screen.getByLabelText(S08_COPY.fallbackLabel), '10 pushups');
    await user.press(screen.getByLabelText(S08_COPY.save));

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S08_COPY.saveFailure, 'warning'));
    expect(screen.getByDisplayValue('Morning workout')).toBeTruthy();
  });
});
