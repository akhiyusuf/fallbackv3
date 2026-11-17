/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { useToastStore } from '@/app-shell';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import type { Id, Instant, TaskWithSteps } from '@/types';

// A save replaces the list with a new array, the way a refetch from the database would, so the
// screen's memoised grouping picks the new ranks up.
let mockTasks: TaskWithSteps[] = [];
const mockMutateAsync = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@/queries', () => ({
  useTasks: () => ({ data: mockTasks, isLoading: false, isError: false, refetch: mockRefetch }),
  useUpdateTask: () => ({ mutateAsync: mockMutateAsync }),
}));

import PrioritiesScreen from './index';

function high(id: string, name: string, patch: Partial<TaskWithSteps> = {}) {
  return makeTask({ id, name, importance: 'high', createdAt: `2026-01-0${id.length}T00:00:00.000Z` as Instant, ...patch });
}

/** Applies a save to the rows, the way the database would. */
function saveIntoRows(input: { id: Id; patch: Partial<TaskWithSteps> }) {
  mockTasks = mockTasks.map((t) => (t.id === input.id ? { ...t, ...input.patch } : t));
  return { ok: true };
}

function orderOnScreen(): string[] {
  return mockTasks
    .slice()
    .sort((a, b) => {
      if (a.priorityRank !== null && b.priorityRank !== null) return a.priorityRank - b.priorityRank;
      if (a.priorityRank !== null) return -1;
      if (b.priorityRank !== null) return 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    })
    .map((t) => t.name);
}

describe('Priorities screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useToastStore.setState({ toast: null });
    mockTasks = [high('t1', 'Alpha', { priorityRank: 0 }), high('t2', 'Beta', { priorityRank: 1 }), high('t3', 'Gamma')];
    mockMutateAsync.mockImplementation(async (input: { id: Id; patch: Partial<TaskWithSteps> }) => saveIntoRows(input));
    mockRefetch.mockResolvedValue(undefined);
  });

  it('lists the High tasks in their own order, numbered', async () => {
    await render(<PrioritiesScreen />);
    expect(screen.getByLabelText('Number 1 of 3: Alpha. Opens the task')).toBeTruthy();
    expect(screen.getByLabelText('Number 2 of 3: Beta. Opens the task')).toBeTruthy();
    expect(screen.getByLabelText('Number 3 of 3: Gamma. Opens the task')).toBeTruthy();
    expect(screen.getByText('In your order: the top one matters most. Use the arrows to move one up or down.')).toBeTruthy();
  });

  it('moving a task up swaps it with the one above and saves each place that changed', async () => {
    const user = userEvent.setup();
    await render(<PrioritiesScreen />);
    await user.press(screen.getByLabelText('Move Gamma up'));

    // Gamma goes to place 2 (rank 1); Beta moves to place 3 (rank 2); Alpha already sits at rank 0 and is not written again.
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    expect(mockMutateAsync).toHaveBeenCalledWith({ id: 't3', patch: { priorityRank: 1 } });
    expect(mockMutateAsync).toHaveBeenCalledWith({ id: 't2', patch: { priorityRank: 2 } });
    await waitFor(() => expect(orderOnScreen()).toEqual(['Alpha', 'Gamma', 'Beta']));
    expect(mockRefetch).toHaveBeenCalled();
    expect(screen.getByLabelText('Number 2 of 3: Gamma. Opens the task')).toBeTruthy();
  });

  it('moving a task down, then to the top by repeated moves, keeps every rank saved', async () => {
    const user = userEvent.setup();
    await render(<PrioritiesScreen />);
    await user.press(screen.getByLabelText('Move Alpha down'));
    await waitFor(() => expect(orderOnScreen()).toEqual(['Beta', 'Alpha', 'Gamma']));

    await user.press(screen.getByLabelText('Move Gamma up'));
    await waitFor(() => expect(orderOnScreen()).toEqual(['Beta', 'Gamma', 'Alpha']));

    await user.press(screen.getByLabelText('Move Gamma up'));
    await waitFor(() => expect(orderOnScreen()).toEqual(['Gamma', 'Beta', 'Alpha']));
    // Gamma 0, Beta 1, Alpha 2: every place that changed was saved, nothing else was written.
    expect(Object.fromEntries(mockTasks.map((t) => [t.name, t.priorityRank]))).toEqual({ Alpha: 2, Beta: 1, Gamma: 0 });
  });

  it('the top task has its up arrow disabled and the bottom task has its down arrow disabled', async () => {
    await render(<PrioritiesScreen />);
    expect(screen.getByLabelText('Move Alpha up')).toBeDisabled();
    expect(screen.getByLabelText('Move Gamma down')).toBeDisabled();
    expect(screen.getByLabelText('Move Alpha down')).not.toBeDisabled();
  });

  it('a save that comes back failed shows a warning and puts the saved order back', async () => {
    mockMutateAsync.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    await render(<PrioritiesScreen />);
    await user.press(screen.getByLabelText('Move Gamma up'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save the new order. Try again."));
    expect(useToastStore.getState().toast?.tone).toBe('warning');
    expect(orderOnScreen()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('a save that throws unlocks the arrows again and shows the same warning', async () => {
    mockMutateAsync.mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    await render(<PrioritiesScreen />);
    await user.press(screen.getByLabelText('Move Gamma up'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save the new order. Try again."));
    await act(async () => undefined);
    expect(screen.getByLabelText('Move Gamma up')).not.toBeDisabled();
    expect(screen.getByLabelText('Move Alpha down')).not.toBeDisabled();
  });

  it('switching level clears any order on screen and shows that level', async () => {
    const user = userEvent.setup();
    await render(<PrioritiesScreen />);
    await user.press(screen.getByLabelText('Low'));
    expect(screen.getByText('Nothing marked low yet')).toBeTruthy();
    expect(screen.getByText('Set a task\'s importance on its own screen and it shows up here.')).toBeTruthy();
  });

  it('a single task at a level has no arrows, only its place', async () => {
    mockTasks = [high('t9', 'Solo')];
    await render(<PrioritiesScreen />);
    expect(screen.getByText('The only one at this level.')).toBeTruthy();
    expect(screen.queryByLabelText('Move Solo up')).toBeNull();
    expect(screen.queryByLabelText('Move Solo down')).toBeNull();
  });
});
