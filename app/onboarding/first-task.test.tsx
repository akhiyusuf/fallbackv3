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

  // The screen does not disable Save: it stays enabled, and pressing it with an empty field shows
  // that field's error and saves nothing. ALLSCREENS_1.md (S08) says Save is disabled until all three
  // have content; the app does not do that today (open question for a human, see the report).
  it('default: Save is enabled; pressing it with empty fields shows the three errors and saves nothing', async () => {
    const user = userEvent.setup();
    await render(<S08OnboardingFirstTask />);
    expect(screen.getByLabelText(S08_COPY.save).props.accessibilityState?.disabled).not.toBe(true);

    await user.press(screen.getByLabelText(S08_COPY.save));
    expect(screen.getByText(S08_COPY.nameError)).toBeTruthy();
    expect(screen.getByText(S08_COPY.idealError)).toBeTruthy();
    expect(screen.getByText(S08_COPY.fallbackError)).toBeTruthy();
    expect(mockCreateTaskMutateAsync).not.toHaveBeenCalled();
  });

  it('an error clears as soon as its field is typed in', async () => {
    const user = userEvent.setup();
    await render(<S08OnboardingFirstTask />);
    await user.press(screen.getByLabelText(S08_COPY.save));
    await user.type(screen.getByLabelText(S08_COPY.nameLabel), 'Morning workout');
    expect(screen.queryByText(S08_COPY.nameError)).toBeNull();
    expect(screen.getByText(S08_COPY.idealError)).toBeTruthy();
  });

  // The type picker (Routines / Events / Courses / To-dos) is not on the reworked screen at all;
  // the body copy says the other types come after setup. Asserted as the app does it now.
  it('has no type picker: the body says events, courses and to-dos come after setup', async () => {
    await render(<S08OnboardingFirstTask />);
    expect(screen.getByText(S08_COPY.body)).toBeTruthy();
    expect(screen.queryByLabelText(/unavailable until after setup/)).toBeNull();
    expect(screen.getByLabelText('Step 7 of 7')).toBeTruthy();
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

  it('a write that throws (not just returns an error) also shows the retry toast and stops the spinner', async () => {
    mockCreateTaskMutateAsync.mockRejectedValue(new Error('database closed'));
    const user = userEvent.setup();
    await render(<S08OnboardingFirstTask />);
    await user.type(screen.getByLabelText(S08_COPY.nameLabel), 'Morning workout');
    await user.type(screen.getByLabelText(S08_COPY.idealLabel), 'Full workout');
    await user.type(screen.getByLabelText(S08_COPY.fallbackLabel), '10 pushups');
    await user.press(screen.getByLabelText(S08_COPY.save));

    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S08_COPY.saveFailure, 'warning'));
    expect(screen.getByLabelText(S08_COPY.save).props.accessibilityState?.disabled).not.toBe(true);
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

  // The routine is saved first, then the "onboarding finished" save. If only that second save fails, the
  // second press must finish onboarding without creating the routine a second time (createdRef).
  it('a failed "onboarding finished" save keeps the screen; the next Save does not create the routine again', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValueOnce({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S08OnboardingFirstTask />);
    await user.type(screen.getByLabelText(S08_COPY.nameLabel), 'Morning workout');
    await user.type(screen.getByLabelText(S08_COPY.idealLabel), 'Full workout');
    await user.type(screen.getByLabelText(S08_COPY.fallbackLabel), '10 pushups');

    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S08_COPY.saveFailure, 'warning'));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Morning workout')).toBeTruthy();
    expect(mockCreateTaskMutateAsync).toHaveBeenCalledTimes(1);

    await user.press(screen.getByLabelText(S08_COPY.save));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today?justAdded=1'));
    expect(mockCreateTaskMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledTimes(2);
    replace.mockRestore();
  });
});
