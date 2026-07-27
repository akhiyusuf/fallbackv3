/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { today } from '@/lib/date';

const mockUseTasks = jest.fn();
const mockUseTaskOccurrences = jest.fn();
jest.mock('@/queries', () => ({
  useTasks: () => mockUseTasks(),
  useTaskOccurrences: () => mockUseTaskOccurrences(),
}));

import EventsBrowseScreen from './EventsBrowseScreen';

function event(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e1',
    type: 'event',
    name: 'Dentist visit',
    note: null,
    icon: 'Calendar',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: null,
    eventDate: today(),
    timeOfDay: '14:30',
    startDate: null,
    endDate: null,
    dosesPerDay: 1,
    isTracked: false,
    importance: 'med',
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

describe('S11 — Events Browse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTaskOccurrences.mockReturnValue({ data: [] });
  });

  it('empty — no events at all: F6-pattern EmptyState, "New event" -> S17 directly', async () => {
    mockUseTasks.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<EventsBrowseScreen />);
    expect(screen.getByText('No events yet.')).toBeTruthy();
    await user.press(screen.getByLabelText('New event'));
    expect(push).toHaveBeenCalledWith('/add/event');
    push.mockRestore();
  });

  it('populated: a today one-off event renders under Today with its time and a "One-time" badge', async () => {
    mockUseTasks.mockReturnValue({ data: [event()], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<EventsBrowseScreen />);
    expect(screen.getByText('Dentist visit')).toBeTruthy();
    expect(screen.getByText('2:30 PM')).toBeTruthy();
    expect(screen.getByText('One-time')).toBeTruthy();
  });

  it('no events today, but some upcoming: Today section shows its own scoped empty copy; Upcoming still lists', async () => {
    const upcoming = event({ id: 'e2', name: 'Team dinner', eventDate: '2099-01-01' });
    mockUseTasks.mockReturnValue({ data: [upcoming], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<EventsBrowseScreen />);
    expect(screen.getByText('No events today.')).toBeTruthy();
    expect(screen.getByText('Team dinner')).toBeTruthy();
  });

  it('tapping an event card navigates to S20 with origin=events', async () => {
    mockUseTasks.mockReturnValue({ data: [event()], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<EventsBrowseScreen />);
    await user.press(screen.getByText('Dentist visit'));
    expect(push).toHaveBeenCalledWith('/task/e1?from=events');
    push.mockRestore();
  });

  it('error: renders InlineRetryBanner', async () => {
    mockUseTasks.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: jest.fn() });
    await render(<EventsBrowseScreen />);
    expect(screen.getByText('Couldn’t load this list. Your data is safe on this device.')).toBeTruthy();
  });
});
