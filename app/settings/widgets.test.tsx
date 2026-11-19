/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockSettingsData: { current: unknown } = { current: undefined };
const mockUpdateSettingsMutateAsync = jest.fn();
jest.mock('@/queries', () => ({
  useSettings: () => ({ data: mockSettingsData.current, isLoading: mockSettingsData.current === undefined }),
  useTasks: () => ({ data: [{ id: 't1', name: 'Morning workout' }, { id: 't2', name: 'Meditate' }] }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateSettingsMutateAsync }),
}));

// The previews draw today's rows; an empty day keeps this test about the settings only.
jest.mock('@/features/today/useTodayRows', () => ({ useTodayRows: () => ({ rows: [] }) }));

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

const mockInitNotificationsBridge = jest.fn();
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: () => mockInitNotificationsBridge() }));
const mockInitWidgetsBridge = jest.fn();
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => mockInitWidgetsBridge() }));

import S46Widgets from './widgets';
import { S46_COPY } from '@/features/settings/copy';

const TODAY_ROW = 'Small: today widget. Opens its settings';
const ONE_TASK_ROW = 'Small: one task widget. Opens its settings';

describe('S46 — Widgets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = { widgets: [] };
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
  });

  it('a fixed task that is in Recently deleted (not in the task list) shows the generic label, and its picker asks to choose one — no crash', async () => {
    const user = userEvent.setup();
    mockSettingsData.current = { widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 'deleted-one' }] };
    await render(<S46Widgets />);
    expect(screen.getByText(S46_COPY.fixedTask)).toBeTruthy();
    await user.press(screen.getByLabelText(ONE_TASK_ROW));
    expect(screen.getByLabelText('Task, Choose a task')).toBeTruthy();
    // Save is not offered for a task the picker cannot show.
    expect(screen.getByLabelText(S46_COPY.save).props.accessibilityState?.disabled).toBe(true);
  });

  it('gallery-default: all three widget rows shown, no settings sheet open', async () => {
    await render(<S46Widgets />);
    for (const entry of S46_COPY.gallery) {
      expect(screen.getByText(entry.label)).toBeTruthy();
    }
    expect(screen.queryByText(S46_COPY.smartHelper)).toBeNull();
  });

  it('tapping a widget row opens its settings sheet on "Next due"', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText(TODAY_ROW));
    expect(screen.getByText(S46_COPY.smartHelper)).toBeTruthy();
    expect(screen.getByLabelText('Shows').props.accessibilityLabel).toBe('Shows');
  });

  it('choosing "Fixed task" reveals the task picker; "Next due" hides it and shows the helper', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText(TODAY_ROW));
    await user.press(screen.getByLabelText(S46_COPY.fixedTask));
    expect(screen.getByLabelText(`Task, ${'Choose a task'}`)).toBeTruthy();
    expect(screen.queryByText(S46_COPY.smartHelper)).toBeNull();
    await user.press(screen.getByLabelText(S46_COPY.smartNextDue));
    expect(screen.getByText(S46_COPY.smartHelper)).toBeTruthy();
  });

  it('a fixed-task widget cannot be saved until a task is chosen', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText(ONE_TASK_ROW));
    await user.press(screen.getByLabelText(S46_COPY.fixedTask));
    expect(screen.getByLabelText(S46_COPY.save).props.accessibilityState.disabled).toBe(true);
  });

  it('Save persists the chosen fixed task for that widget and shows the success toast', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText(ONE_TASK_ROW));
    await user.press(screen.getByLabelText(S46_COPY.fixedTask));
    await user.press(screen.getByLabelText('Task, Choose a task'));
    await user.press(screen.getByLabelText('Meditate'));
    await user.press(screen.getByLabelText(S46_COPY.save));
    await waitFor(() =>
      expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({
        widgets: [{ size: 'small-one-task', mode: 'fixed-task', fixedTaskId: 't2' }],
      }),
    );
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S46_COPY.savedToast, 'success'));
  });

  it('Save persists the default "Next due" config for a widget and keeps the others', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText(TODAY_ROW));
    await user.press(screen.getByLabelText(S46_COPY.save));
    await waitFor(() =>
      expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({
        widgets: [{ size: 'small-today', mode: 'smart-next-due', fixedTaskId: null }],
      }),
    );
  });

  it('a persist failure shows the calm retry toast and keeps the sheet open', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText(TODAY_ROW));
    await user.press(screen.getByLabelText(S46_COPY.save));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S46_COPY.errorToast, 'warning'));
    expect(screen.getByText(S46_COPY.smartHelper)).toBeTruthy();
  });

  it('renders the footer note verbatim', async () => {
    await render(<S46Widgets />);
    expect(screen.getByText(S46_COPY.footer)).toBeTruthy();
  });

  it('tap back chevron navigates to S41', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText('Back'));
    expect(push).toHaveBeenCalledWith('/settings');
    push.mockRestore();
  });

  it('mounting arms both the notifications and widgets bridges (review pass 1, blocking item 1)', async () => {
    await render(<S46Widgets />);
    expect(mockInitNotificationsBridge).toHaveBeenCalled();
    expect(mockInitWidgetsBridge).toHaveBeenCalled();
  });
});
