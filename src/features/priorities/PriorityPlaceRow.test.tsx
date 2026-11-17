/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { makeTask } from '@/features/task/testSupport/taskFixture';
import type { Id, Instant, TaskWithSteps } from '@/types';

let mockTasks: TaskWithSteps[] = [];
jest.mock('@/queries', () => ({
  useTasks: () => ({ data: mockTasks, isLoading: false, isError: false, refetch: jest.fn() }),
}));

import { PriorityPlaceRow } from './PriorityPlaceRow';

function high(id: string, name: string, rank: number | null) {
  return makeTask({ id, name, importance: 'high', priorityRank: rank, createdAt: '2026-01-01T00:00:00.000Z' as Instant });
}

describe('PriorityPlaceRow (on a task screen)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTasks = [high('a', 'Alpha', 0), high('b', 'Beta', 1), high('c', 'Gamma', 2)];
  });

  it("shows the task's place in its importance level", async () => {
    await render(<PriorityPlaceRow taskId={'b' as Id} importance="high" />);
    expect(screen.getByText('No. 2 of 3 in High')).toBeTruthy();
    expect(screen.getByText('See them all and change the order')).toBeTruthy();
  });

  it('opens the Priorities screen at that level', async () => {
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<PriorityPlaceRow taskId={'c' as Id} importance="high" />);
    await user.press(screen.getByText('No. 3 of 3 in High'));
    expect(push).toHaveBeenCalledWith('/priorities?level=high');
    push.mockRestore();
  });

  it('renders nothing when the task is not on that level list', async () => {
    await render(<PriorityPlaceRow taskId={'zzz' as Id} importance="high" />);
    expect(screen.queryByText(/No\. \d+ of/)).toBeNull();
  });
});
