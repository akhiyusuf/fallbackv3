/**
 * Recently deleted screen, against the real queries and the in-memory fake repositories: loading,
 * error, empty, one and many items, day counts, the item sheet, Restore / Delete forever / Delete
 * all forever (success, failure, double tap) and the accessibility labels.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, canGoBack: () => true, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';

import { useToastStore } from '@/app-shell';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { err } from '@/types';
import type { Id, Instant, TaskWithSteps } from '@/types';

import RecentlyDeletedScreen, { DELETED_COPY } from './deleted';

const NOW = '2026-07-16T12:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;

function ago(days: number): Instant {
  return new Date(new Date(NOW).getTime() - days * DAY).toISOString() as Instant;
}

function deletedTask(id: string, name: string, daysAgo: number, patch: Partial<TaskWithSteps> = {}): TaskWithSteps {
  return makeTask({ id: id as Id, name, deletedAt: ago(daysAgo), ...patch });
}

let client: QueryClient;
const originalTasks = { ...fake.repos.tasks };

function mount() {
  return render(
    <QueryClientProvider client={client}>
      <RecentlyDeletedScreen />
    </QueryClientProvider>,
  );
}

function toast() {
  return useToastStore.getState().toast;
}

async function rows() {
  return screen.findAllByTestId(/^deleted-row-/);
}

async function firstRow() {
  const [row] = await rows();
  if (!row) throw new Error('no row');
  return row;
}

beforeEach(() => {
  fake.reset();
  Object.assign(fake.repos.tasks, originalTasks);
  clock.today = '2026-07-16';
  clock.now = NOW;
  useToastStore.setState({ toast: null });
  mockReplace.mockClear();
  mockPush.mockClear();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

describe('Recently deleted: states', () => {
  it('always shows the intro line', async () => {
    await mount();
    expect(screen.getByText(DELETED_COPY.intro)).toBeTruthy();
    expect(DELETED_COPY.intro).toContain('30 days');
  });

  it('loading: the intro shows and nothing else (no empty message, no rows, no Delete all)', async () => {
    fake.repos.tasks.listDeleted = () => new Promise(() => undefined);
    await mount();
    expect(screen.getByText(DELETED_COPY.intro)).toBeTruthy();
    expect(screen.queryByText(DELETED_COPY.empty)).toBeNull();
    expect(screen.queryByTestId('deleted-delete-all')).toBeNull();
    expect(screen.queryAllByTestId(/^deleted-row-/)).toHaveLength(0);
  });

  it('error: shows the retry banner, no empty message, and Retry loads the list', async () => {
    fake.seedTask(deletedTask('a', 'Old routine', 2));
    let fail = true;
    fake.repos.tasks.listDeleted = async () => {
      if (fail) throw new Error('disk');
      return originalTasks.listDeleted();
    };
    await mount();
    expect(await screen.findByText(DELETED_COPY.loadFailed)).toBeTruthy();
    expect(screen.queryByText(DELETED_COPY.empty)).toBeNull();
    expect(screen.queryByTestId('deleted-delete-all')).toBeNull();

    fail = false;
    await userEvent.press(screen.getByLabelText('Retry'));
    expect(await screen.findByText('Old routine')).toBeTruthy();
    expect(screen.queryByText(DELETED_COPY.loadFailed)).toBeNull();
  });

  it('empty: says nothing is here and offers no Delete all', async () => {
    await mount();
    expect(await screen.findByText(DELETED_COPY.empty)).toBeTruthy();
    expect(screen.queryByTestId('deleted-delete-all')).toBeNull();
  });

  it('one item: name, type and days left on its row, and Delete all asks about "1 item"', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 0));
    await mount();
    const row = await firstRow();
    expect(within(row).getByText('Morning workout')).toBeTruthy();
    expect(within(row).getByText('Routine · 30 days left')).toBeTruthy();
    await userEvent.press(screen.getByTestId('deleted-delete-all'));
    expect(await screen.findByText('Delete 1 item forever?')).toBeTruthy();
  });

  it('many items: newest deletion first, each with its own type and count; Delete all says "3 items"', async () => {
    fake.seedTask(deletedTask('old', 'Oldest', 20, { type: 'event', cadence: null, eventDate: '2026-08-01' as never }));
    fake.seedTask(deletedTask('new', 'Newest', 1, { type: 'todo', cadence: null }));
    fake.seedTask(deletedTask('mid', 'Middle', 10, { type: 'course', cadence: null }));
    await mount();
    const found = await rows();
    expect(found.map((r) => r.props.testID)).toEqual(['deleted-row-new', 'deleted-row-mid', 'deleted-row-old']);
    expect(within(found[0]!).getByText('To-do · 29 days left')).toBeTruthy();
    expect(within(found[1]!).getByText('Course · 20 days left')).toBeTruthy();
    expect(within(found[2]!).getByText('Event · 10 days left')).toBeTruthy();
    await userEvent.press(screen.getByTestId('deleted-delete-all'));
    expect(await screen.findByText('Delete 3 items forever?')).toBeTruthy();
  });

  it('a long name does not break the row (it is still the row label)', async () => {
    const long = 'A very long routine name that goes on and on and on and on and on and on and on';
    fake.seedTask(deletedTask('a', long, 3));
    await mount();
    expect(await screen.findByText(long)).toBeTruthy();
  });

  it('back goes to Settings > Data', async () => {
    await mount();
    await userEvent.press(await screen.findByLabelText('Back'));
    expect(mockReplace).toHaveBeenCalledWith('/settings/data');
  });
});

describe('Recently deleted: day counts', () => {
  async function sublabelFor(daysAgo: number) {
    fake.seedTask(deletedTask('a', 'Thing', daysAgo));
    await mount();
    const row = await firstRow();
    return within(row).getByText(/Routine ·/).props.children as string;
  }

  it.each([
    [0, 'Routine · 30 days left'],
    [1, 'Routine · 29 days left'],
    [15, 'Routine · 15 days left'],
    [28, 'Routine · 2 days left'],
    [28.5, 'Routine · 2 days left'],
    [29, 'Routine · Last day'],
    [29.9, 'Routine · Last day'],
    [30, 'Routine · Last day'],
  ])('deleted %s days ago reads "%s" (never "0 days left", never negative)', async (daysAgo, expected) => {
    expect(await sublabelFor(daysAgo)).toBe(expected);
  });

  it('an item past its 30 days is removed when the screen loads and is not listed', async () => {
    fake.seedTask(deletedTask('gone', 'Expired', 30.1));
    fake.seedTask(deletedTask('stay', 'Fresh', 5));
    await mount();
    await rows();
    expect(screen.queryByText('Expired')).toBeNull();
    expect(screen.getByText('Fresh')).toBeTruthy();
    expect(await fake.repos.tasks.get('gone' as Id)).toBeNull();
  });
});

describe('Recently deleted: the item sheet', () => {
  it('opens on a row and says when it was deleted and when it is removed for good', async () => {
    const deletedAt = ago(6);
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    await mount();
    await userEvent.press(await firstRow());
    const deleted = new Date(deletedAt);
    const gone = new Date(deleted.getTime() + 30 * DAY);
    expect(await screen.findByText(DELETED_COPY.sheetBody(format(deleted, 'MMM d'), format(gone, 'MMM d')))).toBeTruthy();
    const sheet = screen.getByTestId('deleted-item-sheet');
    expect(within(sheet).getByText('Restore')).toBeTruthy();
    expect(within(sheet).getByText('Delete forever')).toBeTruthy();
    expect(within(sheet).getByLabelText('Close')).toBeTruthy();
  });

  it('Close leaves the item where it was', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    await mount();
    await userEvent.press(await firstRow());
    await userEvent.press(within(await screen.findByTestId('deleted-item-sheet')).getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByText('Restore')).toBeNull());
    expect(screen.getByText('Morning workout')).toBeTruthy();
    expect(toast()).toBeNull();
  });

  it('every pressable has an accessibility label or visible text that names it', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    await mount();
    const row = await firstRow();
    expect(row.props.accessibilityLabel).toBe('Morning workout, Routine, 24 days left. Restore or delete forever');
    expect(screen.getByLabelText('Back')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete all forever' })).toBeTruthy();
    await userEvent.press(row);
    const sheet = await screen.findByTestId('deleted-item-sheet');
    expect(within(sheet).getByRole('button', { name: 'Restore' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Delete forever' })).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});

describe('Recently deleted: Restore', () => {
  async function openRestore() {
    await userEvent.press(await firstRow());
    const sheet = await screen.findByTestId('deleted-item-sheet');
    return within(sheet).getByText('Restore');
  }

  it('brings it back with a success toast, and it leaves the list', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    await mount();
    await userEvent.press(await openRestore());
    await waitFor(() => expect(toast()?.message).toBe('Restored “Morning workout”'));
    expect(toast()?.tone).toBe('success');
    expect((await fake.repos.tasks.get('a' as Id))?.deletedAt).toBeNull();
    expect(await screen.findByText(DELETED_COPY.empty)).toBeTruthy();
  });

  it('a failed restore shows the warning, keeps the item in the list', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    fake.repos.tasks.restore = async () => err({ code: 'WRITE_FAILED', message: 'nope' });
    await mount();
    await userEvent.press(await openRestore());
    await waitFor(() => expect(toast()?.message).toBe("Couldn't do that. Try again."));
    expect(toast()?.tone).toBe('warning');
    expect(await screen.findByText('Morning workout')).toBeTruthy();
    expect((await fake.repos.tasks.get('a' as Id))?.deletedAt).not.toBeNull();
  });

  it('a restore that throws is also a warning, not a crash', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    fake.repos.tasks.restore = async () => {
      throw new Error('db closed');
    };
    await mount();
    await userEvent.press(await openRestore());
    await waitFor(() => expect(toast()?.message).toBe("Couldn't do that. Try again."));
    expect(toast()?.tone).toBe('warning');
  });

  it('an item that is already gone (removed elsewhere) is a warning and the list refreshes without it', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    await mount();
    const press = await openRestore();
    await act(async () => {
      await originalTasks.deleteForever('a' as Id);
    });
    await userEvent.press(press);
    await waitFor(() => expect(toast()?.message).toBe("Couldn't do that. Try again."));
    expect(await screen.findByText(DELETED_COPY.empty)).toBeTruthy();
  });

  it('a double tap runs the restore once and keeps the success message', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    const spy = jest.fn(originalTasks.restore);
    fake.repos.tasks.restore = spy;
    await mount();
    const button = await openRestore();
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await waitFor(() => expect(toast()?.message).toBe('Restored “Morning workout”'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(toast()?.tone).toBe('success');
  });
});

describe('Recently deleted: Delete forever', () => {
  async function openConfirm() {
    await userEvent.press(await firstRow());
    const sheet = await screen.findByTestId('deleted-item-sheet');
    await userEvent.press(within(sheet).getByText('Delete forever'));
    return screen.findByTestId('deleted-confirm-one');
  }

  it('asks first: names the item, says it cannot be undone and that XP stays', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    await mount();
    const confirm = await openConfirm();
    expect(within(confirm).getByText('Delete “Morning workout” forever?')).toBeTruthy();
    expect(within(confirm).getByText(DELETED_COPY.confirmOneBody)).toBeTruthy();
    expect(DELETED_COPY.confirmOneBody).toContain('XP you earned with it stays');
    // Nothing is removed until it is confirmed.
    expect(await fake.repos.tasks.get('a' as Id)).not.toBeNull();
  });

  it('Cancel keeps it', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    await mount();
    const confirm = await openConfirm();
    await userEvent.press(within(confirm).getByLabelText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Delete “Morning workout” forever?')).toBeNull());
    expect(await fake.repos.tasks.get('a' as Id)).not.toBeNull();
    expect(screen.getByText('Morning workout')).toBeTruthy();
    expect(toast()).toBeNull();
  });

  it('confirming removes it for good with a neutral "Deleted for good" toast', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    fake.seedTask(deletedTask('b', 'Other', 12));
    await mount();
    const confirm = await openConfirm();
    await userEvent.press(within(confirm).getByText('Delete forever'));
    await waitFor(() => expect(toast()?.message).toBe('Deleted for good'));
    expect(toast()?.tone).toBe('neutral');
    expect(await fake.repos.tasks.get('a' as Id)).toBeNull();
    expect(await fake.repos.tasks.get('b' as Id)).not.toBeNull();
    await waitFor(() => expect(screen.queryByText('Morning workout')).toBeNull());
    expect(screen.getByText('Other')).toBeTruthy();
  });

  it('a failed delete shows the warning and the item stays', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    fake.repos.tasks.deleteForever = async () => err({ code: 'WRITE_FAILED', message: 'nope' });
    await mount();
    const confirm = await openConfirm();
    await userEvent.press(within(confirm).getByText('Delete forever'));
    await waitFor(() => expect(toast()?.message).toBe("Couldn't do that. Try again."));
    expect(toast()?.tone).toBe('warning');
    expect(await screen.findByText('Morning workout')).toBeTruthy();
  });

  it('a double tap on the confirm runs it once and keeps "Deleted for good"', async () => {
    fake.seedTask(deletedTask('a', 'Morning workout', 6));
    const spy = jest.fn(originalTasks.deleteForever);
    fake.repos.tasks.deleteForever = spy;
    await mount();
    const confirm = await openConfirm();
    const button = within(confirm).getByText('Delete forever');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await waitFor(() => expect(toast()?.message).toBe('Deleted for good'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(toast()?.message).toBe('Deleted for good');
  });
});

describe('Recently deleted: Delete all forever', () => {
  it('with several items: titled with the count, removes all of them, neutral toast', async () => {
    fake.seedTask(deletedTask('a', 'One', 1));
    fake.seedTask(deletedTask('b', 'Two', 2));
    fake.seedTask(makeTask({ id: 'live' as Id, name: 'Still here' }));
    await mount();
    await rows();
    await userEvent.press(screen.getByTestId('deleted-delete-all'));
    const confirm = await screen.findByTestId('deleted-confirm-all');
    expect(within(confirm).getByText('Delete 2 items forever?')).toBeTruthy();
    expect(within(confirm).getByText(DELETED_COPY.confirmAllBody)).toBeTruthy();
    await userEvent.press(within(confirm).getByText('Delete all forever'));
    await waitFor(() => expect(toast()?.message).toBe('Deleted for good'));
    expect(toast()?.tone).toBe('neutral');
    expect(await screen.findByText(DELETED_COPY.empty)).toBeTruthy();
    // Live tasks are never touched.
    expect(await fake.repos.tasks.get('live' as Id)).not.toBeNull();
    expect(await fake.repos.tasks.get('a' as Id)).toBeNull();
  });

  it('Cancel removes nothing', async () => {
    fake.seedTask(deletedTask('a', 'One', 1));
    await mount();
    await rows();
    await userEvent.press(screen.getByTestId('deleted-delete-all'));
    await userEvent.press(within(await screen.findByTestId('deleted-confirm-all')).getByLabelText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Delete 1 item forever?')).toBeNull());
    expect(await fake.repos.tasks.get('a' as Id)).not.toBeNull();
    expect(toast()).toBeNull();
  });

  it('a failed purge shows the warning and everything stays', async () => {
    fake.seedTask(deletedTask('a', 'One', 1));
    const real = originalTasks.purgeDeleted;
    fake.repos.tasks.purgeDeleted = async (cutoff) => (cutoff === null ? err({ code: 'WRITE_FAILED', message: 'nope' }) : real(cutoff));
    await mount();
    await rows();
    await userEvent.press(screen.getByTestId('deleted-delete-all'));
    await userEvent.press(within(await screen.findByTestId('deleted-confirm-all')).getByText('Delete all forever'));
    await waitFor(() => expect(toast()?.message).toBe("Couldn't do that. Try again."));
    expect(toast()?.tone).toBe('warning');
    expect(await screen.findByText('One')).toBeTruthy();
  });

  it('a double tap runs it once', async () => {
    fake.seedTask(deletedTask('a', 'One', 1));
    const real = originalTasks.purgeDeleted;
    const spy = jest.fn(real);
    fake.repos.tasks.purgeDeleted = spy;
    await mount();
    await rows();
    await userEvent.press(screen.getByTestId('deleted-delete-all'));
    const button = within(await screen.findByTestId('deleted-confirm-all')).getByText('Delete all forever');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await waitFor(() => expect(toast()?.message).toBe('Deleted for good'));
    // Once for the confirmed purge (cutoff null); the screen's own load purges with a cutoff.
    expect(spy.mock.calls.filter(([cutoff]) => cutoff === null)).toHaveLength(1);
  });
});
