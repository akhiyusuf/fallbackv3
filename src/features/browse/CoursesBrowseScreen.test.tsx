/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { addDays, today } from '@/lib/date';

const mockUseTasks = jest.fn();
jest.mock('@/queries', () => ({
  useTasks: () => mockUseTasks(),
  // TaskCard's week strip reads occurrences; none are needed for these assertions.
  useTaskOccurrences: () => ({ data: [] }),
}));

import CoursesBrowseScreen from './CoursesBrowseScreen';

function course(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    type: 'course',
    name: 'Antibiotics',
    note: null,
    icon: 'ListChecks',
    color: 'forge-orange',
    isAsNeeded: false,
    cadence: { kind: 'daily' },
    eventDate: null,
    timeOfDay: null,
    startDate: addDays(today(), -7),
    endDate: addDays(today(), 2),
    dosesPerDay: 2,
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

describe('S12 — Courses Browse', () => {
  beforeEach(() => jest.clearAllMocks());

  it('empty — no courses at all: F6-pattern EmptyState, "New course" -> S18 directly', async () => {
    mockUseTasks.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<CoursesBrowseScreen />);
    expect(screen.getByText('Start your first course')).toBeTruthy();
    await user.press(screen.getByLabelText('New course'));
    expect(push).toHaveBeenCalledWith('/add/course');
    push.mockRestore();
  });

  it('populated (Active tab): the meta line shows the day count and the doses a day', async () => {
    mockUseTasks.mockReturnValue({ data: [course()], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<CoursesBrowseScreen />);
    expect(screen.getByText('Antibiotics')).toBeTruthy();
    // Details are one muted meta line: "Day N of M · doses · importance · necessity".
    expect(screen.getByText(/Day 8 of 10/)).toBeTruthy();
    expect(screen.getByText(/2 doses a day/)).toBeTruthy();
  });

  it('Past tab: shows "Completed <date>" and hides the live doses-a-day detail', async () => {
    const pastCourse = course({ id: 'c2', name: 'Old course', startDate: addDays(today(), -20), endDate: addDays(today(), -5) });
    mockUseTasks.mockReturnValue({ data: [pastCourse], isLoading: false, isError: false, refetch: jest.fn() });
    const user = userEvent.setup();
    await render(<CoursesBrowseScreen />);
    await user.press(screen.getByLabelText('Past'));
    expect(screen.getByText(/Completed/)).toBeTruthy();
    expect(screen.queryByText(/doses a day/)).toBeNull();
  });

  it('tapping a course card navigates to S20 with origin=courses', async () => {
    mockUseTasks.mockReturnValue({ data: [course()], isLoading: false, isError: false, refetch: jest.fn() });
    const push = jest.spyOn(router, 'push').mockImplementation(() => {});
    const user = userEvent.setup();
    await render(<CoursesBrowseScreen />);
    await user.press(screen.getByText('Antibiotics'));
    expect(push).toHaveBeenCalledWith('/task/c1?from=courses');
    push.mockRestore();
  });

  it('no active courses, but past ones exist: the scoped Active-tab empty state', async () => {
    const pastOnly = course({ id: 'c3', startDate: addDays(today(), -20), endDate: addDays(today(), -5) });
    mockUseTasks.mockReturnValue({ data: [pastOnly], isLoading: false, isError: false, refetch: jest.fn() });
    await render(<CoursesBrowseScreen />);
    expect(screen.getByText(/No active courses right now\./)).toBeTruthy();
  });
});
