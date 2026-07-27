/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

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
  beforeEach(() => jest.clearAllMocks());

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
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('toggling a to-do checkbox persists via useUpdateTask (todoDoneAt), never a StateChip/celebration', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    mockUpdateTaskMutateAsync.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByRole('checkbox', { name: 'Renew passport' }));
    await waitFor(() =>
      expect(mockUpdateTaskMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: 'td1', patch: expect.objectContaining({ todoDoneAt: expect.any(String) }) })),
    );
  });

  it('tapping "Details" on a to-do row navigates to S20 with origin=todos', async () => {
    mockUseTasks.mockReturnValue({ data: [todo()], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<ToDosBrowseScreen />);
    await user.press(screen.getByLabelText('Open Renew passport'));
    expect(push).toHaveBeenCalledWith('/task/td1?from=todos');
    push.mockRestore();
  });

  it('Notes lens: an item with note body renders without a checkbox, using its note as the preview', async () => {
    const note = todo({ id: 'n1', name: 'Gift ideas', note: 'scarf, the tea sampler', importance: 'med' });
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
    expect(screen.getByText('Couldn’t load this list. Your data is safe on this device.')).toBeTruthy();
  });
});
