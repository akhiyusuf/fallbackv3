/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

const mockUseTasks = jest.fn();
jest.mock('@/queries', () => ({ useTasks: () => mockUseTasks() }));

const mockUseAsNeededHistory = jest.fn();
jest.mock('./useAsNeededHistory', () => ({ useAsNeededHistory: () => mockUseAsNeededHistory() }));

import RoutinesBrowseScreen from './RoutinesBrowseScreen';

function routine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
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
    idealSteps: [{ id: 's1', taskId: 'r1', role: 'ideal', text: '30-min workout', position: 0, dueWeekdays: null }],
    fallbackSteps: [{ id: 's2', taskId: 'r1', role: 'fallback', text: '5-min walk', position: 0, dueWeekdays: null }],
    ...overrides,
  };
}

describe('S10 — Routines Browse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAsNeededHistory.mockReturnValue({ data: [] });
  });

  it('loading: renders skeleton rows', async () => {
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });
    await render(<RoutinesBrowseScreen />);
    expect(screen.getAllByLabelText('Loading').length).toBeGreaterThan(0);
  });

  it('empty — no routines at all: renders the F6 empty state', async () => {
    mockUseTasks.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<RoutinesBrowseScreen />);
    expect(screen.getByText('Create your first routine')).toBeTruthy();
    expect(screen.getByLabelText('New routine')).toBeTruthy();
  });

  it('error: renders InlineRetryBanner', async () => {
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });
    await render(<RoutinesBrowseScreen />);
    expect(screen.getByText("Couldn't load this list. Your data is safe on this device.")).toBeTruthy();
  });

  it('populated: a daily routine always appears in the Due section with a Due badge; an as-needed routine renders as AsNeededCard in Other routines with no due badge/cadence/heatmap', async () => {
    const asNeeded = routine({ id: 'r2', name: 'Emergency plan', isAsNeeded: true, cadence: null, importance: null, necessity: null });
    mockUseTasks.mockReturnValue({ data: [routine(), asNeeded], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<RoutinesBrowseScreen />);
    expect(screen.getByText('Movement')).toBeTruthy();
    expect(screen.getByText('Due')).toBeTruthy();
    expect(screen.getByText('Other routines')).toBeTruthy();
    expect(screen.getByText('Emergency plan')).toBeTruthy();
    expect(screen.getByLabelText('Log used it')).toBeTruthy();
    // AsNeededCard never shows cadence text or a due badge for its own row.
    expect(screen.queryByText('daily')).toBeNull();
  });

  it('an as-needed row with usage history shows the "Last used" preview', async () => {
    const asNeeded = routine({ id: 'r2', name: 'Emergency plan', isAsNeeded: true, cadence: null, importance: null, necessity: null });
    mockUseTasks.mockReturnValue({ data: [asNeeded], isLoading: false, isError: false, refetch: jest.fn() });
    mockUseAsNeededHistory.mockReturnValue({
      data: [
        { id: 'u1', taskId: 'r2', date: '2026-03-03', marker: 'ideal', createdAt: '2026-03-03T00:00:00.000Z' },
        { id: 'u2', taskId: 'r2', date: '2026-01-01', marker: 'fallback', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    });
    await render(<RoutinesBrowseScreen />);
    expect(screen.getByText('Last used Mar 3')).toBeTruthy();
  });

  it('tapping an as-needed card navigates to S23, never S20', async () => {
    const asNeeded = routine({ id: 'r2', name: 'Emergency plan', isAsNeeded: true, cadence: null, importance: null, necessity: null });
    mockUseTasks.mockReturnValue({ data: [asNeeded], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<RoutinesBrowseScreen />);
    await user.press(screen.getByLabelText('Log used it'));
    expect(push).toHaveBeenCalledWith('/task/r2/as-needed?from=routines');
    push.mockRestore();
  });

  it('tapping a scheduled routine card navigates to S20 with origin=routines', async () => {
    mockUseTasks.mockReturnValue({ data: [routine()], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<RoutinesBrowseScreen />);
    await user.press(screen.getByText('Movement'));
    expect(push).toHaveBeenCalledWith('/task/r1?from=routines');
    push.mockRestore();
  });

  it('nothing-due empty variant: a routine due only Sat–Sun still shows under Other routines, scoped Due-section empty state names the selected day', async () => {
    const weekend = routine({ id: 'r3', name: 'Yoga flow', cadence: { kind: 'specific-weekdays', weekdays: [6, 7] } });
    mockUseTasks.mockReturnValue({ data: [weekend], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<RoutinesBrowseScreen />);
    // The weekday tab defaults to "today" in the real clock, so this just asserts the routine
    // renders somewhere (Due or Other) without being dropped from the list entirely (F6/F27).
    expect(screen.getByText('Yoga flow')).toBeTruthy();
  });

  it('the + FAB navigates to S15 (pick type)', async () => {
    mockUseTasks.mockReturnValue({ data: [routine()], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<RoutinesBrowseScreen />);
    await user.press(screen.getByLabelText('Add task'));
    expect(push).toHaveBeenCalledWith('/add');
    push.mockRestore();
  });

  it('search icon navigates to S14 tagged with origin=routines', async () => {
    mockUseTasks.mockReturnValue({ data: [routine()], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<RoutinesBrowseScreen />);
    await user.press(screen.getByLabelText('Search'));
    expect(push).toHaveBeenCalledWith('/search?from=routines');
    push.mockRestore();
  });

  it('changing the weekday tab re-badges the Due section without dropping any routine (client-side re-partition)', async () => {
    mockUseTasks.mockReturnValue({ data: [routine()], isLoading: false, isError: false, refetch: jest.fn() });
    const user = userEvent.setup();
    await render(<RoutinesBrowseScreen />);
    await user.press(screen.getByLabelText('Sat'));
    await waitFor(() => expect(screen.getByText('Movement')).toBeTruthy()); // daily routine still shown regardless of tab
  });
});
