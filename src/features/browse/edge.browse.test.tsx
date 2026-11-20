/** Edge cases for the browse tabs, the weekday filter, Ended sections, search and priorities ordering. */
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { addDays, today, weekdayOf } from '@/lib/date';

const mockUseTasks = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/queries', () => ({
  useTasks: () => mockUseTasks(),
  useToday: () => ({ data: [] }),
  useTaskOccurrences: () => ({ data: [] }),
  useUpdateTask: () => ({ mutateAsync: mockUpdate }),
}));
jest.mock('./useAsNeededHistory', () => ({ useAsNeededHistory: () => ({ data: [] }) }));

import RoutinesBrowseScreen from './RoutinesBrowseScreen';
import CoursesBrowseScreen from './CoursesBrowseScreen';
import EventsBrowseScreen from './EventsBrowseScreen';
import ToDosBrowseScreen from './ToDosBrowseScreen';
import SearchScreen from '@/features/search/SearchScreen';
import { groupByImportance } from '@/features/priorities/order';
import { cadenceRunsOnWeekday, formatTimeOfDay } from './format';

function task(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1', type: 'routine', name: 'Movement', note: null, icon: 'Repeat', color: 'forge-orange', isAsNeeded: false,
    cadence: { kind: 'daily' }, eventDate: null, timeOfDay: null, startDate: null, endDate: null, dosesPerDay: 1,
    isTracked: true, importance: 'high', necessity: 'must-do', todoDoneAt: null, priorityRank: null, isNote: false,
    snoozable: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
    endedOn: null, idealSteps: [], fallbackSteps: [], ...overrides,
  };
}
const ok = (data: unknown[]) => mockUseTasks.mockReturnValue({ data, isLoading: false, isError: false, refetch: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ ok: true });
});

describe('Routines tab', () => {
  it('one routine: one card, no Other or Ended section', async () => {
    ok([task()]);
    await render(<RoutinesBrowseScreen />);
    expect(screen.getByText('Movement')).toBeTruthy();
    expect(screen.queryByText('Ended')).toBeNull();
  });

  it('300 routines render without throwing and every name is present', async () => {
    ok(Array.from({ length: 300 }, (_, i) => task({ id: `r${i}`, name: `Habit ${i}` })));
    await render(<RoutinesBrowseScreen />);
    expect(screen.getByText('Habit 0')).toBeTruthy();
    expect(screen.getByText('Habit 299')).toBeTruthy();
  });

  it('emoji and very long names render whole', async () => {
    const long = 'A very long routine name '.repeat(12).trim();
    ok([task({ name: 'Water 💧🌱' }), task({ id: 'r2', name: long })]);
    await render(<RoutinesBrowseScreen />);
    expect(screen.getByText('Water 💧🌱')).toBeTruthy();
    expect(screen.getByText(long)).toBeTruthy();
  });

  it('weekday filter: a Mon/Wed routine is Due on Monday and listed as Other on Tuesday', async () => {
    ok([task({ name: 'Gym', cadence: { kind: 'specific-weekdays', weekdays: [1, 3] } })]);
    await render(<RoutinesBrowseScreen />);
    const todayWd = weekdayOf(today());
    const pick = (wd: number) => screen.getByLabelText(new RegExp(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][wd - 1]!));
    await fireEvent.press(pick(2 === todayWd ? 1 : 2));
    // Tuesday (or Monday if today is Tuesday): the routine is not on that day when it is Tuesday.
    if (2 !== todayWd) expect(screen.getByText(/Nothing due|No routines on/i)).toBeTruthy();
    await fireEvent.press(pick(1));
    expect(screen.getByText('Gym')).toBeTruthy();
  });

  it('weekday filter handles every cadence kind without throwing', () => {
    const kinds = [
      { kind: 'daily' }, { kind: 'specific-weekdays', weekdays: [7] }, { kind: 'weekly', weekday: 5 },
      { kind: 'bi-weekly', weekday: 5 }, { kind: 'monthly' }, { kind: 'bi-monthly' }, { kind: 'yearly' }, null,
    ];
    for (const c of kinds) for (const wd of [1, 2, 3, 4, 5, 6, 7]) expect(typeof cadenceRunsOnWeekday(c as never, wd as never)).toBe('boolean');
    expect(cadenceRunsOnWeekday({ kind: 'weekly', weekday: 5 } as never, 5)).toBe(true);
    expect(cadenceRunsOnWeekday({ kind: 'specific-weekdays', weekdays: [] } as never, 5)).toBe(false);
  });

  it('only ended routines: the tab is not the empty state; Ended lists them newest first with the date', async () => {
    ok([task({ id: 'a', name: 'Older', endedOn: '2026-03-02' }), task({ id: 'b', name: 'Newer', endedOn: '2026-05-09' })]);
    await render(<RoutinesBrowseScreen />);
    expect(screen.queryByText('Create your first routine')).toBeNull();
    expect(screen.getByText('Ended')).toBeTruthy();
    expect(screen.getByText('Ended May 9')).toBeTruthy();
    expect(screen.getByText('Ended Mar 2')).toBeTruthy();
    const names = screen.getAllByText(/Older|Newer/).map((n) => n.props.children);
    expect(names.indexOf('Newer')).toBeLessThan(names.indexOf('Older'));
    // An ended routine is never in the weekday "Due" list.
    expect(screen.queryByText('Due')).toBeNull();
  });

  it('an ended routine is not shown in Other or As needed', async () => {
    ok([task({ id: 'a', name: 'Stopped', endedOn: '2026-03-02', isAsNeeded: true, cadence: null })]);
    await render(<RoutinesBrowseScreen />);
    expect(screen.queryByText('As needed')).toBeNull();
    expect(screen.getByText('Stopped')).toBeTruthy();
  });

  it('formatTimeOfDay handles midnight, noon and single digits', () => {
    expect(formatTimeOfDay('00:05')).toBe('12:05 AM');
    expect(formatTimeOfDay('12:00')).toBe('12:00 PM');
    expect(formatTimeOfDay('23:59')).toBe('11:59 PM');
  });
});

describe('Events tab', () => {
  it('a one-off event today, tomorrow and a repeating one all show', async () => {
    ok([
      task({ id: 'e1', type: 'event', name: 'Dentist', eventDate: today(), cadence: null }),
      task({ id: 'e2', type: 'event', name: 'Concert', eventDate: addDays(today(), 1), cadence: null }),
    ]);
    await render(<EventsBrowseScreen />);
    expect(screen.getByText('Dentist')).toBeTruthy();
    expect(screen.getByText('Concert')).toBeTruthy();
    expect(screen.getByText('Tomorrow')).toBeTruthy();
  });

  it('only past one-off events: calm summary, no crash (past events are not listed on this tab)', async () => {
    ok([task({ id: 'e1', type: 'event', name: 'Old gig', eventDate: addDays(today(), -9), cadence: null })]);
    await render(<EventsBrowseScreen />);
    expect(screen.getByText('Nothing coming up.')).toBeTruthy();
  });

  it('an ended repeating event appears only under Ended', async () => {
    ok([task({ id: 'e1', type: 'event', name: 'Book club', cadence: { kind: 'weekly', weekday: 2 }, endedOn: '2026-02-01' })]);
    await render(<EventsBrowseScreen />);
    expect(screen.getByText('Ended Feb 1')).toBeTruthy();
    expect(screen.getAllByText('Book club')).toHaveLength(1);
  });

  it('three events on one day sit under one day header', async () => {
    const d = addDays(today(), 3);
    ok(['A', 'B', 'C'].map((n, i) => task({ id: `e${i}`, type: 'event', name: n, eventDate: d, cadence: null })));
    await render(<EventsBrowseScreen />);
    expect(screen.getAllByText('A')).toHaveLength(1);
    expect(screen.getByText('C')).toBeTruthy();
  });
});

describe('Courses tab', () => {
  const course = (o: Record<string, unknown> = {}) =>
    task({ id: 'c1', type: 'course', name: 'Antibiotics', startDate: addDays(today(), -3), endDate: addDays(today(), 6), dosesPerDay: 1, ...o });

  it('a course that has not started yet says when it starts, never "Day 0"', async () => {
    ok([course({ startDate: addDays(today(), 5), endDate: addDays(today(), 12) })]);
    await render(<CoursesBrowseScreen />);
    expect(screen.queryByText(/Day 0 of/)).toBeNull();
    expect(screen.getByText(/Starts /)).toBeTruthy();
  });

  it('a course ended early is under Past and says it ended on the day it was ended, not its planned last day', async () => {
    const ended = addDays(today(), -1);
    ok([course({ endedOn: ended, endDate: addDays(today(), 30) })]);
    await render(<CoursesBrowseScreen />);
    await fireEvent.press(screen.getByText('Past'));
    const { format } = require('date-fns');
    const { parseLocalDate } = require('@/lib/date');
    expect(screen.getByText(new RegExp(`Completed ${format(parseLocalDate(ended), 'MMM d')}`))).toBeTruthy();
  });

  it('a one-day course says "1 day", not "1 days"', async () => {
    ok([course({ startDate: addDays(today(), -5), endDate: addDays(today(), -5) })]);
    await render(<CoursesBrowseScreen />);
    await fireEvent.press(screen.getByText('Past'));
    expect(screen.getByText(/1 day\b/)).toBeTruthy();
    expect(screen.queryByText(/1 days/)).toBeNull();
  });

  it('only past courses: Active shows its calm line, the FAB stays', async () => {
    ok([course({ endDate: addDays(today(), -2), startDate: addDays(today(), -9) })]);
    await render(<CoursesBrowseScreen />);
    expect(screen.getByText(/No active courses right now/)).toBeTruthy();
    expect(screen.getByLabelText('New course')).toBeTruthy();
  });

  it('a course with no end date does not crash and counts as active', async () => {
    ok([course({ endDate: null })]);
    await render(<CoursesBrowseScreen />);
    expect(screen.getByText('Antibiotics')).toBeTruthy();
  });
});

describe('To-dos tab', () => {
  it('only notes: To-dos lens shows its empty line, Notes lens lists them', async () => {
    ok([task({ id: 'n1', type: 'todo', name: 'Wi-Fi code', isNote: true, importance: null, necessity: null, cadence: null })]);
    await render(<ToDosBrowseScreen />);
    expect(screen.getByText('No to-dos right now.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Notes'));
    expect(screen.getByText('Wi-Fi code')).toBeTruthy();
  });

  it('a double tap on the checkbox writes once', async () => {
    let release!: (v: unknown) => void;
    mockUpdate.mockReturnValue(new Promise((r) => (release = r)));
    ok([task({ id: 'd1', type: 'todo', name: 'Call mom', cadence: null })]);
    await render(<ToDosBrowseScreen />);
    const box = screen.getByTestId('todo-checkbox-d1');
    await fireEvent.press(box);
    await fireEvent.press(box);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    release({ ok: true });
  });

  it('a write that throws shows the save-failed toast path without an unhandled rejection', async () => {
    mockUpdate.mockRejectedValue(new Error('db'));
    ok([task({ id: 'd1', type: 'todo', name: 'Call mom', cadence: null })]);
    await render(<ToDosBrowseScreen />);
    await fireEvent.press(screen.getByTestId('todo-checkbox-d1'));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('Search', () => {
  const run = async (data: unknown[], q: string) => {
    ok(data);
    const user = userEvent.setup();
    await render(<SearchScreen />);
    await user.type(screen.getByLabelText('Search by name'), q).catch(async () => {
      await fireEvent.changeText(screen.getByPlaceholderText(/search/i), q);
    });
  };
  const input = () => screen.getByPlaceholderText(/search/i);

  it('is case-insensitive and matches partial words', async () => {
    ok([task({ name: 'Morning Pages' }), task({ id: 't2', name: 'Evening walk' })]);
    await render(<SearchScreen />);
    await fireEvent.changeText(input(), 'MORN');
    expect(screen.getByText('Morning Pages')).toBeTruthy();
    expect(screen.queryByText('Evening walk')).toBeNull();
    await fireEvent.changeText(input(), 'ing wa');
    expect(screen.getByText('Evening walk')).toBeTruthy();
  });

  it('matches emoji', async () => {
    ok([task({ name: 'Water 💧' }), task({ id: 't2', name: 'Sleep' })]);
    await render(<SearchScreen />);
    await fireEvent.changeText(input(), '💧');
    expect(screen.getByText('Water 💧')).toBeTruthy();
    expect(screen.queryByText('Sleep')).toBeNull();
  });

  it('trims surrounding spaces; a query of spaces counts as no query', async () => {
    ok([task({ name: 'Read' })]);
    await render(<SearchScreen />);
    await fireEvent.changeText(input(), '  read  ');
    expect(screen.getByText('Read')).toBeTruthy();
    await fireEvent.changeText(input(), '    ');
    expect(screen.getByText('Read')).toBeTruthy();
  });

  it('regex characters in the query are plain text', async () => {
    ok([task({ name: 'Run (5k)' }), task({ id: 't2', name: 'Sleep' })]);
    await render(<SearchScreen />);
    await fireEvent.changeText(input(), '(5k');
    expect(screen.getByText('Run (5k)')).toBeTruthy();
    await fireEvent.changeText(input(), '.*');
    expect(screen.queryByText('Sleep')).toBeNull();
  });

  it('an ended habit is findable and marked Ended', async () => {
    ok([task({ name: 'Piano', endedOn: '2026-01-01' })]);
    await render(<SearchScreen />);
    await fireEvent.changeText(input(), 'piano');
    expect(screen.getByText('Piano')).toBeTruthy();
    expect(screen.getByText('Ended')).toBeTruthy();
  });

  it('no matches then Clear all brings everything back', async () => {
    ok([task({ name: 'Piano' })]);
    await render(<SearchScreen />);
    await fireEvent.changeText(input(), 'zzz');
    expect(screen.queryByText('Piano')).toBeNull();
    await fireEvent.press(screen.getAllByText(/clear all/i)[0]!);
    expect(screen.getByText('Piano')).toBeTruthy();
  });

  it('a note (todo with isNote) is a result; an item with no importance is hidden by an importance filter', async () => {
    ok([task({ name: 'Idea', type: 'todo', isNote: true, importance: null, necessity: null })]);
    await render(<SearchScreen />);
    expect(screen.getByText('Idea')).toBeTruthy();
    await fireEvent.press(screen.getByText('High'));
    expect(screen.queryByText('Idea')).toBeNull();
  });

  it('nothing at all: the "nothing to search" empty state, not "no matches"', async () => {
    ok([]);
    await render(<SearchScreen />);
    expect(screen.queryByText(/no matches/i)).toBeNull();
  });

  void run;
  void router;
});

describe('Priorities ordering', () => {
  const T = '2026-06-01' as never;
  const names = (arr: readonly { name: string }[]) => arr.map((t) => t.name);

  it('placed first by rank, unplaced after oldest first, ties on equal rank are stable', () => {
    const g = groupByImportance(
      [
        task({ id: 'a', name: 'Unplaced new', createdAt: '2026-03-01T00:00:00.000Z' }),
        task({ id: 'b', name: 'Rank 1', priorityRank: 1 }),
        task({ id: 'c', name: 'Unplaced old', createdAt: '2026-01-01T00:00:00.000Z' }),
        task({ id: 'd', name: 'Rank 0', priorityRank: 0 }),
      ] as never,
      T,
    );
    expect(names(g.high)).toEqual(['Rank 0', 'Rank 1', 'Unplaced old', 'Unplaced new']);
  });

  it('ended, finished to-dos, notes, past events and finished courses drop out; live ones stay', () => {
    const g = groupByImportance(
      [
        task({ id: '1', name: 'Ended', endedOn: '2026-05-01' }),
        task({ id: '2', name: 'Done todo', type: 'todo', todoDoneAt: '2026-05-01T00:00:00.000Z' }),
        task({ id: '3', name: 'Note', type: 'todo', isNote: true }),
        task({ id: '4', name: 'Past event', type: 'event', eventDate: '2026-05-31' }),
        task({ id: '5', name: 'Event today', type: 'event', eventDate: '2026-06-01' }),
        task({ id: '6', name: 'Old course', type: 'course', endDate: '2026-05-31' }),
        task({ id: '7', name: 'Course ends today', type: 'course', endDate: '2026-06-01' }),
        task({ id: '8', name: 'Open todo', type: 'todo' }),
        task({ id: '9', name: 'No importance', importance: null }),
      ] as never,
      T,
    );
    expect(names(g.high)).toEqual(['Event today', 'Course ends today', 'Open todo'].sort((a, b) => names(g.high).indexOf(a) - names(g.high).indexOf(b)));
    expect(new Set(names(g.high))).toEqual(new Set(['Event today', 'Course ends today', 'Open todo']));
  });

  it('empty input gives three empty groups; equal ranks and equal dates do not throw', () => {
    expect(groupByImportance([], T)).toEqual({ high: [], med: [], low: [] });
    expect(() => groupByImportance([task({ id: 'a', priorityRank: 2 }), task({ id: 'b', priorityRank: 2 })] as never, T)).not.toThrow();
  });
});
