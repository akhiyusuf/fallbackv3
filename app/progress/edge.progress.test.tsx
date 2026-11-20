/** Edge cases for the Progress screen: which task is selected when tasks come and go, and empty data. */
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockConsistency = jest.fn();
const mockTasks: { current: unknown[] } = { current: [] };
jest.mock('@/queries', () => ({
  useConsistency: (args: unknown) => mockConsistency(args),
  useTasks: () => ({ data: mockTasks.current, isLoading: false }),
}));

import Progress from './index';

const t = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, type: 'routine', isAsNeeded: false, icon: 'Repeat', color: 'forge-orange', ...extra });
const empty = { scope: 'per-task', percent: null, numerator: 0, denominator: 0, breakdown: { ideal: 0, fallback: 0, off: 0, missed: 0 }, countedDates: [] };

beforeEach(() => {
  jest.clearAllMocks();
  mockConsistency.mockReturnValue({ data: empty, isLoading: false, isError: false, refetch: jest.fn() });
});

describe('Progress edge cases', () => {
  it('first trackable task is selected by default; to-dos and as-needed routines are never chips', async () => {
    mockTasks.current = [t('a', 'Walk'), t('b', 'Todo', { type: 'todo' }), t('c', 'Inhaler', { isAsNeeded: true })];
    await render(<Progress />);
    expect(screen.getByLabelText('Walk').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByLabelText('Todo')).toBeNull();
    expect(screen.queryByLabelText('Inhaler')).toBeNull();
    expect(mockConsistency).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'per-task', taskId: 'a' }));
  });

  it('when the picked task disappears (deleted), the first remaining task is shown and lit, not a stale id', async () => {
    mockTasks.current = [t('a', 'Walk'), t('b', 'Read')];
    const view = await render(<Progress />);
    await fireEvent.press(screen.getByLabelText('Read'));
    expect(mockConsistency).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: 'b' }));
    mockTasks.current = [t('a', 'Walk')];
    await view.rerender(<Progress />);
    expect(mockConsistency).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: 'a' }));
    expect(screen.getByLabelText('Walk').props.accessibilityState.selected).toBe(true);
  });

  it('an ended task is still a chip, and picking it asks for its own record', async () => {
    mockTasks.current = [t('a', 'Walk'), t('b', 'Piano', { endedOn: '2026-01-01' })];
    await render(<Progress />);
    await fireEvent.press(screen.getByLabelText('Piano'));
    expect(mockConsistency).toHaveBeenLastCalledWith(expect.objectContaining({ taskId: 'b' }));
  });

  it('no history (percent null): calm empty state, never 0%', async () => {
    mockTasks.current = [t('a', 'Walk')];
    await render(<Progress />);
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('only off days: percent null with off days counted shows the empty state, not a divide-by-zero', async () => {
    mockTasks.current = [t('a', 'Walk')];
    mockConsistency.mockReturnValue({ data: { ...empty, breakdown: { ideal: 0, fallback: 0, off: 9, missed: 0 } }, isLoading: false, isError: false, refetch: jest.fn() });
    await render(<Progress />);
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('no tasks at all: per-task shows the empty state; Everything (aggregate) still renders', async () => {
    mockTasks.current = [];
    await render(<Progress />);
    expect(screen.getByText('No data yet')).toBeTruthy();
    mockConsistency.mockReturnValue({ data: { ...empty, scope: 'aggregate' }, isLoading: false, isError: false, refetch: jest.fn() });
    await fireEvent.press(screen.getAllByRole('radio')[0]!);
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('a 100 percent result and a name with emoji render without NaN', async () => {
    mockTasks.current = [t('a', 'Water 💧')];
    mockConsistency.mockReturnValue({ data: { ...empty, percent: 100, numerator: 3, denominator: 3, breakdown: { ideal: 3, fallback: 0, off: 0, missed: 0 } }, isLoading: false, isError: false, refetch: jest.fn() });
    await render(<Progress />);
    expect(screen.getByLabelText('Water 💧')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });
});
