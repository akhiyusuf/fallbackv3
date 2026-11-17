/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useToastStore } from '@/app-shell';
import { play } from '@/services/sfx';
import { SAVE_FAILED } from '@/features/task/formShared';

jest.mock('@/services/sfx', () => ({ play: jest.fn() }));

const mockUseTasks = jest.fn();
const mockUpdateTaskMutateAsync = jest.fn();
jest.mock('@/queries', () => ({
  useTasks: () => mockUseTasks(),
  useUpdateTask: () => ({ mutateAsync: mockUpdateTaskMutateAsync }),
}));

import ToDosBrowseScreen from './ToDosBrowseScreen';

function todo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'td1',
    type: 'todo',
    name: 'Renew passport',
    note: null,
    icon: 'StickyNote',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: null,
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: false,
    importance: 'high',
    necessity: null,
    todoDoneAt: null,
    snoozable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    idealSteps: [],
    fallbackSteps: [],
    ...overrides,
  };
}

describe('S13 — To-dos & Notes Browse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useToastStore.setState({ toast: null });
  });

  it('empty (To-dos lens): renders the authored empty state, "New to-do or note" -> S19 directly', async () => {
    mockUseTasks.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    expect(screen.getByText('Nothing here yet.')).toBeTruthy();
    await user.press(screen.getByLabelText('New to-do or note'));
    expect(push).toHaveBeenCalledWith('/add/todo');
    push.mockRestore();
  });

  it('populated (To-dos lens): renders a checkbox row with its Importance tag', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<ToDosBrowseScreen />);
    expect(screen.getByText('Renew passport')).toBeTruthy();
    expect(screen.getByText('High importance')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Renew passport/ })).toBeTruthy();
  });

  it('toggling a to-do checkbox persists via useUpdateTask (todoDoneAt), never a StateChip/celebration', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    mockUpdateTaskMutateAsync.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('checkbox', { name: /Renew passport/ }));
    await waitFor(() =>
      expect(mockUpdateTaskMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: 'td1', patch: expect.objectContaining({ todoDoneAt: expect.any(String) }) })),
    );
  });

  it('ticking a to-do plays the done sound and shows a "Done" toast with Undo; Undo clears todoDoneAt', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    mockUpdateTaskMutateAsync.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('checkbox', { name: /Renew passport/ }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('Done'));
    expect(play).toHaveBeenCalledWith('todo_done');
    const toast = useToastStore.getState().toast;
    expect(toast?.action?.label).toBe('Undo');

    mockUpdateTaskMutateAsync.mockClear();
    await act(async () => {
      toast?.action?.onPress();
    });
    expect(mockUpdateTaskMutateAsync).toHaveBeenCalledWith({ id: 'td1', patch: { todoDoneAt: null } });
  });

  it('un-ticking a done to-do clears todoDoneAt and shows no "Done" toast', async () => {
    mockUseTasks.mockReturnValue({ data: [todo({ todoDoneAt: '2026-11-16T09:00:00.000Z' })], isLoading: false, isError: false, refetch: jest.fn() });
    mockUpdateTaskMutateAsync.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('checkbox', { name: /Renew passport/ }));
    await waitFor(() => expect(mockUpdateTaskMutateAsync).toHaveBeenCalledWith({ id: 'td1', patch: { todoDoneAt: null } }));
    expect(useToastStore.getState().toast).toBeNull();
    expect(play).not.toHaveBeenCalledWith('todo_done');
  });

  it('tapping the card row (not the checkbox) navigates to S20 with origin=todos', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('button', { name: /Renew passport/ }));
    expect(push).toHaveBeenCalledWith('/task/td1?from=todos');
    push.mockRestore();
  });

  it('Notes lens: an item with note body renders without a checkbox, using its note as the preview', async () => {
    const note = todo({ id: 'n1', name: 'Gift ideas', note: 'scarf, the tea sampler', importance: 'med', isNote: true });
    mockUseTasks.mockReturnValue({ data: [note], isLoading: false, isError: false, refetch: jest.fn() });
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByLabelText('Notes'));
    expect(screen.getByText('Gift ideas')).toBeTruthy();
    expect(screen.getByText('scarf, the tea sampler')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('error: renders InlineRetryBanner', async () => {
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });
    await render(<ToDosBrowseScreen />);
    expect(screen.getByText("Couldn't load this list. Your data is safe on this device.")).toBeTruthy();
  });

  it('a tick that the save rejects shows the "Couldn\'t save" warning, plays no done sound and shows no Done toast', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    mockUpdateTaskMutateAsync.mockResolvedValue({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('checkbox', { name: 'Renew passport' }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(SAVE_FAILED));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
    expect(play).not.toHaveBeenCalledWith('todo_done');
  });

  it('a tick whose write throws shows the same "Couldn\'t save" warning', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    mockUpdateTaskMutateAsync.mockRejectedValue(new Error('database closed'));
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('checkbox', { name: 'Renew passport' }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(SAVE_FAILED));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
  });

  it('a failed Undo shows the "Couldn\'t save" warning in place of the Done toast', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    mockUpdateTaskMutateAsync.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: { code: 'WRITE_FAILED', message: 'boom' } });
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('checkbox', { name: 'Renew passport' }));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe('Done'));
    const undo = useToastStore.getState().toast?.action?.onPress;
    await act(async () => {
      undo?.();
    });
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(SAVE_FAILED));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
    expect(mockUpdateTaskMutateAsync).toHaveBeenCalledTimes(2);
  });

  it('the checkbox is named by the to-do alone; its ticked state is carried by checked, not by the name', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    const open = await render(<ToDosBrowseScreen />);
    expect(screen.getByRole('checkbox', { name: 'Renew passport', checked: false })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Renew passport, done' })).toBeNull();
    await open.unmount();

    mockUseTasks.mockReturnValue({ data: [todo({ todoDoneAt: '2026-11-16T09:00:00.000Z' })], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<ToDosBrowseScreen />);
    expect(screen.getByRole('checkbox', { name: 'Renew passport', checked: true })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Renew passport, done' })).toBeNull();
  });
});
