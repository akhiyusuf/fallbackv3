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

const mockShowToast = jest.fn();
jest.mock('@/app-shell', () => ({ useToastStore: (selector: (s: { show: typeof mockShowToast }) => unknown) => selector({ show: mockShowToast }) }));

const mockInitNotificationsBridge = jest.fn();
jest.mock('@/services/notifications', () => ({ initNotificationsBridge: () => mockInitNotificationsBridge() }));
const mockInitWidgetsBridge = jest.fn();
jest.mock('@/services/widgets', () => ({ initWidgetsBridge: () => mockInitWidgetsBridge() }));

import S46Widgets from './widgets';
import { S46_COPY } from '@/features/settings/copy';

describe('S46 — Widgets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsData.current = { widgets: [] };
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: true });
  });

  it('gallery-default: no panel expanded, all three gallery cards shown', async () => {
    await render(<S46Widgets />);
    for (const entry of S46_COPY.gallery) {
      expect(screen.getByText(entry.label)).toBeTruthy();
    }
    expect(screen.queryByText(S46_COPY.fixedTask)).toBeNull();
  });

  it('tapping a gallery card expands its config panel; tapping again collapses it', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText('Small · Today widget, collapsed'));
    expect(screen.getByText(S46_COPY.smartHelper)).toBeTruthy();
    await user.press(screen.getByLabelText('Small · Today widget, expanded'));
    expect(screen.queryByText(S46_COPY.smartHelper)).toBeNull();
  });

  it('opening a different card collapses the previously-open one', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText('Small · Today widget, collapsed'));
    expect(screen.getByText(S46_COPY.smartHelper)).toBeTruthy();
    await user.press(screen.getByLabelText('Small · One task widget, collapsed'));
    expect(screen.getByLabelText('Small · Today widget, collapsed')).toBeTruthy();
  });

  it('choosing "Fixed task" reveals the task Select; "Smart" hides it and shows the helper', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText('Small · Today widget, collapsed'));
    await user.press(screen.getByLabelText(S46_COPY.fixedTask));
    expect(screen.getAllByText(S46_COPY.fixedTask).length).toBeGreaterThan(1); // radio option + the Select's own label row
    await user.press(screen.getByLabelText(S46_COPY.smartNextDue));
    expect(screen.getByText(S46_COPY.smartHelper)).toBeTruthy();
  });

  it('Save persists that widget config and shows the success toast', async () => {
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText('Small · Today widget, collapsed'));
    await user.press(screen.getByLabelText(S46_COPY.save));
    await waitFor(() =>
      expect(mockUpdateSettingsMutateAsync).toHaveBeenCalledWith({
        widgets: [{ size: 'small-today', mode: 'smart-next-due', fixedTaskId: null }],
      }),
    );
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S46_COPY.savedToast, 'success'));
  });

  it('a persist failure shows the calm retry toast', async () => {
    mockUpdateSettingsMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<S46Widgets />);
    await user.press(screen.getByLabelText('Small · Today widget, collapsed'));
    await user.press(screen.getByLabelText(S46_COPY.save));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(S46_COPY.errorToast, 'warning'));
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
