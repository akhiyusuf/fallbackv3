/**
 * Round 3 spec coverage (review/EDGE-BRIEF.md). PRD F15 and S14 (Filter & Search): the Importance
 * and Necessity filter chips had no test; only the Type chip did. House pattern: RNTL v14.
 */
import { render, screen, userEvent } from '@testing-library/react-native';

const mockUseTasks = jest.fn();
jest.mock('@/queries', () => ({
  useTasks: () => mockUseTasks(),
  useTaskOccurrences: () => ({ data: [] }),
}));

import SearchScreen from '@/features/search/SearchScreen';

type Imp = 'high' | 'med' | 'low' | null;
type Nec = 'must-do' | 'recommended' | 'optional' | null;

function task(name: string, importance: Imp, necessity: Nec, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: name.replace(/\s+/g, '-').toLowerCase(),
    type: 'routine',
    name,
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
    importance,
    necessity,
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

const ALL = [
  task('Stretch', 'high', 'must-do'),
  task('Journal', 'med', 'recommended'),
  task('Cold plunge', 'low', 'optional'),
  task('Read a book', 'high', 'optional'),
];

function names(): string[] {
  return ALL.map((t) => t.name).filter((n) => screen.queryByText(n) !== null);
}

describe('S14 — Importance and Necessity filters (spec coverage, F15)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTasks.mockReturnValue({ data: ALL, isLoading: false, isError: false });
  });

  it('with no filter on, every task shows', async () => {
    await render(<SearchScreen />);
    expect(names().sort()).toEqual(['Cold plunge', 'Journal', 'Read a book', 'Stretch']);
  });

  it('the Importance "High" chip narrows the list to High tasks only', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByText('High'));
    expect(names().sort()).toEqual(['Read a book', 'Stretch']);
  });

  it('the Necessity "Must-do" chip narrows the list to Must-do tasks only', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByText('Must-do'));
    expect(names()).toEqual(['Stretch']);
  });

  it('two chips in one group are OR: High plus Low shows both groups and hides Med', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByText('High'));
    await user.press(screen.getByText('Low'));
    expect(names().sort()).toEqual(['Cold plunge', 'Read a book', 'Stretch']);
  });

  it('chips across groups are AND: Importance High plus Necessity Optional leaves only the task that is both', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByText('High'));
    await user.press(screen.getByText('Optional'));
    expect(names()).toEqual(['Read a book']);
  });

  it('a typed search and a chip combine: the text narrows first, the chip narrows again', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search/i), 'read');
    await user.press(screen.getByText('Optional'));
    expect(names()).toEqual(['Read a book']);
  });

  it('a to-do or event with no importance is hidden by an importance filter but shows with no filter', async () => {
    const unset = task('Renew passport', null, null, { type: 'todo' });
    mockUseTasks.mockReturnValue({ data: [...ALL, unset], isLoading: false, isError: false });
    await render(<SearchScreen />);
    expect(screen.getByText('Renew passport')).toBeTruthy();
    const user = userEvent.setup();
    await user.press(screen.getByText('High'));
    expect(screen.queryByText('Renew passport')).toBeNull();
    expect(screen.getByText('Stretch')).toBeTruthy();
  });

  it('a chip pressed again turns off, and the full list comes back', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByText('Low'));
    expect(names()).toEqual(['Cold plunge']);
    await user.press(screen.getByText('Low'));
    expect(names().sort()).toEqual(['Cold plunge', 'Journal', 'Read a book', 'Stretch']);
  });

  it('a filter that matches nothing shows "No matches." and Clear all brings every task back', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByText('Must-do'));
    await user.press(screen.getByText('Low'));
    expect(screen.getByText('No matches.')).toBeTruthy();
    await user.press(screen.getByText('Clear all'));
    expect(screen.queryByText('No matches.')).toBeNull();
    expect(names().sort()).toEqual(['Cold plunge', 'Journal', 'Read a book', 'Stretch']);
  });

  it('Clear all resets the importance and necessity chips too, not only the text', async () => {
    await render(<SearchScreen />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search/i), 'zzz');
    await user.press(screen.getByText('High'));
    await user.press(screen.getByText('Optional'));
    await user.press(screen.getByText('Clear all'));
    expect(names().sort()).toEqual(['Cold plunge', 'Journal', 'Read a book', 'Stretch']);
  });
});
