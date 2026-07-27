/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockUseTasks = jest.fn();
jest.mock('@/queries', () => ({ useTasks: () => mockUseTasks() }));

import SearchScreen from './SearchScreen';

function task(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    type: 'routine',
    name: 'Movement',
    note: null,
    icon: 'Repeat',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: true,
    importance: 'high',
    necessity: 'must-do',
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

describe('S14 — Filter & Search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('nothing to search yet: no tasks exist anywhere -> the dedicated empty state', async () => {
    mockUseTasks.mockReturnValue({ data: [], isLoading: false, isError: false });
    await render(<SearchScreen />);
    expect(screen.getByText('Nothing to search yet.')).toBeTruthy();
  });

  it('error: a read failure renders InlineRetryBanner, not the no-results empty state', async () => {
    const refetch = jest.fn();
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    await render(<SearchScreen />);
    expect(screen.getByText("Couldn't load this list. Your data is safe on this device.")).toBeTruthy();
    expect(screen.queryByText('No matches.')).toBeNull();
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('default (no query, no filters): shows the full unfiltered result set including an as-needed routine, tagged distinctly', async () => {
    const asNeeded = task({ id: 't2', name: 'Emergency plan', isAsNeeded: true, cadence: null, importance: null, necessity: null });
    mockUseTasks.mockReturnValue({ data: [task(), asNeeded], isLoading: false, isError: false });
    await render(<SearchScreen />);
    expect(screen.getByText('Movement')).toBeTruthy();
    expect(screen.getByText('Emergency plan')).toBeTruthy();
    expect(screen.getByText('As-needed')).toBeTruthy();
    expect(screen.getByText('2 results')).toBeTruthy();
  });

  it('typing a query live-filters results', async () => {
    mockUseTasks.mockReturnValue({ data: [task(), task({ id: 't2', name: 'Read' })], isLoading: false, isError: false });
    const user = userEvent.setup();
    await render(<SearchScreen />);
    await user.type(screen.getByLabelText('Search tasks'), 'Move');
    expect(screen.getByText('Movement')).toBeTruthy();
    expect(screen.queryByText('Read')).toBeNull();
    expect(screen.getByLabelText('Clear all')).toBeTruthy();
  });

  it('no matches: renders the no-results empty state with a working Clear all', async () => {
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    const user = userEvent.setup();
    await render(<SearchScreen />);
    await user.type(screen.getByLabelText('Search tasks'), 'zzz-nothing-matches');
    expect(screen.getByText('No matches.')).toBeTruthy();
    await user.press(screen.getAllByLabelText('Clear all')[0]!);
    expect(screen.getByText('Movement')).toBeTruthy();
  });

  it('a scheduled result taps through to S20 with origin=search', async () => {
    mockUseTasks.mockReturnValue({ data: [task()], isLoading: false, isError: false });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<SearchScreen />);
    await user.press(screen.getByText('Movement'));
    expect(push).toHaveBeenCalledWith('/task/t1?from=search');
    push.mockRestore();
  });

  it('an as-needed result taps through to S23, not S20', async () => {
    const asNeeded = task({ id: 't2', name: 'Emergency plan', isAsNeeded: true, cadence: null, importance: null, necessity: null });
    mockUseTasks.mockReturnValue({ data: [asNeeded], isLoading: false, isError: false });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<SearchScreen />);
    await user.press(screen.getByText('Emergency plan'));
    expect(push).toHaveBeenCalledWith('/task/t2/as-needed?from=search');
    push.mockRestore();
  });

  it('a Type filter chip narrows results to that type', async () => {
    const note = task({ id: 't3', type: 'todo', name: 'Renew passport', cadence: null, isTracked: false });
    mockUseTasks.mockReturnValue({ data: [task(), note], isLoading: false, isError: false });
    const user = userEvent.setup();
    await render(<SearchScreen />);
    await user.press(screen.getAllByLabelText('To-do/Note')[0]!);
    expect(screen.getByText('Renew passport')).toBeTruthy();
    expect(screen.queryByText('Movement')).toBeNull();
  });
});
