/**
 * Deleting is not final (Recently deleted), as the task screens see it: the delete sheet's wording,
 * where each origin lands afterwards, the Undo toast, failure states, and what a task screen shows
 * for a task that is already in Recently deleted (a link, or a screen left on the back stack).
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, fireEvent, userEvent, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useToastStore } from '@/app-shell';
import { DELETE_COPY } from '@/features/task/DeleteTaskSheet';
import { DELETED_NOTICE_COPY, GONE_NOTICE_COPY } from '@/features/task/DeletedTaskNotice';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { Text } from '@/ui/AppText';
import { err } from '@/types';
import type { Id, Instant, TaskWithSteps } from '@/types';

const CONTEXT = { ...ROUTER_CONTEXT, 'settings/data/deleted': () => <Text>MARKER_RECENTLY_DELETED</Text> };
const NOW = '2026-07-16T12:00:00.000Z';
const originalTasks = { ...fake.repos.tasks };

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function toast() {
  return useToastStore.getState().toast;
}

beforeEach(() => {
  fake.reset();
  Object.assign(fake.repos.tasks, originalTasks);
  // The shared fake stamps a fixed 2024 deletion time; a real one stamps "now".
  fake.repos.tasks.softDelete = async (id) => {
    const t = await originalTasks.get(id);
    if (!t || t.deletedAt !== null) return err({ code: 'NOT_FOUND', message: 'not found or already deleted' });
    return originalTasks.update(id, { deletedAt: NOW as Instant });
  };
  clock.today = '2026-07-16';
  clock.now = NOW;
  useToastStore.setState({ toast: null });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

async function openDelete(noun = 'routine') {
  await userEvent.press(screen.getByLabelText('More actions'));
  await userEvent.press(await screen.findByLabelText(`Delete ${noun}`));
  return screen.findByTestId('delete-task-sheet');
}

async function confirm(noun = 'routine') {
  const sheet = await openDelete(noun);
  await userEvent.press(within(sheet).getByLabelText(`Delete ${noun}`));
}

describe('Delete sheet: wording', () => {
  it('says it goes to Recently deleted for 30 days, that its days still count, and that it can be ended instead', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByText('Morning workout');
    const sheet = await openDelete();
    expect(within(sheet).getByText('Delete this routine?')).toBeTruthy();
    expect(
      within(sheet).getByText(
        "“Morning workout” goes to Recently deleted for 30 days. The days you've logged still count. Only stopping? End the routine instead and it stays in your list.",
      ),
    ).toBeTruthy();
    expect(within(sheet).queryByText(/can't be undone/)).toBeNull();
  });

  it('uses the to-do noun for a to-do', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, type: 'todo', name: 'Call mum', cadence: null, idealSteps: [], fallbackSteps: [] }));
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByText('Call mum');
    const sheet = await openDelete('to-do');
    expect(within(sheet).getByText('Delete this to-do?')).toBeTruthy();
    // A to-do can't be ended, so there is no "End it instead".
    expect(within(sheet).getByText("“Call mum” goes to Recently deleted for 30 days. The days you've logged still count.")).toBeTruthy();
  });
});

describe('Delete sheet: confirmed delete', () => {
  it.each([
    ['routine', 'today', 'MARKER_TODAY'],
    ['routine', 'routines', 'MARKER_ROUTINES'],
    ['event', 'events', 'MARKER_EVENTS'],
    ['course', 'courses', 'MARKER_COURSES'],
    ['todo', 'todos', 'MARKER_TODOS'],
    ['routine', 'search', 'MARKER_ROUTINES'],
    ['event', 'search', 'MARKER_EVENTS'],
    ['course', undefined, 'MARKER_COURSES'],
    ['todo', undefined, 'MARKER_TODOS'],
  ] as const)('a %s opened from %s lands on %s, with the Undo toast, and is in Recently deleted', async (type, from, marker) => {
    const noun = type === 'todo' ? 'to-do' : type;
    fake.seedTask(makeTask({ id: 'task-1' as Id, type, name: 'Thing', ...(type === 'routine' ? {} : { cadence: null, idealSteps: [], fallbackSteps: [] }) }));
    await renderRouter(CONTEXT, { initialUrl: `/task/task-1${from ? `?from=${from}` : ''}`, wrapper });
    await screen.findByText('Thing');
    await confirm(noun);
    expect(await screen.findByText(marker)).toBeTruthy();
    expect(toast()?.message).toBe('Moved to Recently deleted');
    expect(toast()?.action?.label).toBe('Undo');
    expect((await fake.repos.tasks.get('task-1' as Id))?.deletedAt).toBe(NOW);
    // The task screen does not flash its "was deleted" notice while leaving.
    expect(screen.queryByTestId('task-deleted-notice')).toBeNull();
  });

  it('from the as-needed page it lands on Routines with the Undo toast', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id, isAsNeeded: true, cadence: null }));
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1/as-needed', wrapper });
    await screen.findByText('Morning workout');
    await confirm();
    expect(await screen.findByText('MARKER_ROUTINES')).toBeTruthy();
    expect(toast()?.message).toBe(DELETE_COPY.movedToast);
    expect(screen.queryByTestId('task-deleted-notice')).toBeNull();
  });

  it('a double tap on Delete runs one delete, one toast, and never shows the retry banner', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    const spy = jest.fn(fake.repos.tasks.softDelete);
    fake.repos.tasks.softDelete = spy;
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1?from=today', wrapper });
    await screen.findByText('Morning workout');
    const sheet = await openDelete();
    const button = within(sheet).getByLabelText('Delete routine');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Couldn't delete. Try again.")).toBeNull();
    expect(toast()?.message).toBe('Moved to Recently deleted');
  });
});

describe('Delete sheet: Undo', () => {
  async function deleteAndGetUndo() {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1?from=today', wrapper });
    await screen.findByText('Morning workout');
    await confirm();
    await screen.findByText('MARKER_TODAY');
    const action = toast()?.action;
    if (!action) throw new Error('no Undo on the toast');
    return action;
  }

  it('restores the task and says so (the sheet is already gone from the screen)', async () => {
    const undo = await deleteAndGetUndo();
    await act(async () => undo.onPress());
    await waitFor(() => expect(toast()?.message).toBe('Restored “Morning workout”'));
    expect((await fake.repos.tasks.get('task-1' as Id))?.deletedAt).toBeNull();
    expect((await fake.repos.tasks.list()).map((t) => t.id)).toContain('task-1');
  });

  it('a failed restore warns and points to Settings > Data', async () => {
    const undo = await deleteAndGetUndo();
    fake.repos.tasks.restore = async () => err({ code: 'WRITE_FAILED', message: 'nope' });
    await act(async () => undo.onPress());
    await waitFor(() => expect(toast()?.message).toBe("Couldn't restore. Try again from Settings > Data."));
    expect(toast()?.tone).toBe('warning');
    expect((await fake.repos.tasks.get('task-1' as Id))?.deletedAt).toBe(NOW);
  });

  it('a restore that throws gives the same warning', async () => {
    const undo = await deleteAndGetUndo();
    fake.repos.tasks.restore = async () => {
      throw new Error('db closed');
    };
    await act(async () => undo.onPress());
    await waitFor(() => expect(toast()?.message).toBe("Couldn't restore. Try again from Settings > Data."));
    expect(toast()?.tone).toBe('warning');
  });
});

describe('Delete sheet: a failed delete', () => {
  it('shows the retry banner, stays on the task, shows no toast; Retry then succeeds and leaves', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    let failures = 1;
    const working = fake.repos.tasks.softDelete;
    fake.repos.tasks.softDelete = async (id) => (failures-- > 0 ? err({ code: 'WRITE_FAILED', message: 'nope' }) : working(id));
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1?from=today', wrapper });
    await screen.findByText('Morning workout');
    await confirm();
    expect(await screen.findByText("Couldn't delete. Try again.")).toBeTruthy();
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
    expect(toast()).toBeNull();
    expect((await fake.repos.tasks.get('task-1' as Id))?.deletedAt).toBeNull();

    await userEvent.press(screen.getByLabelText('Retry'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
    expect(toast()?.message).toBe('Moved to Recently deleted');
  });

  it('a delete that throws is the same retry banner, not a crash', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    fake.repos.tasks.softDelete = async () => {
      throw new Error('db closed');
    };
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1?from=today', wrapper });
    await screen.findByText('Morning workout');
    await confirm();
    expect(await screen.findByText("Couldn't delete. Try again.")).toBeTruthy();
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
  });
});

function deletedTask(patch: Partial<TaskWithSteps> = {}) {
  return makeTask({ id: 'task-1' as Id, deletedAt: NOW as Instant, ...patch });
}

describe('A task screen for a deleted task', () => {
  it('the task page says it was deleted, offers Restore and Recently deleted, and has no way to log or edit', async () => {
    fake.seedTask(deletedTask());
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1', wrapper });
    expect(await screen.findByText(DELETED_NOTICE_COPY.headline('Morning workout'))).toBeTruthy();
    expect(screen.getByText(DELETED_NOTICE_COPY.body)).toBeTruthy();
    expect(screen.queryByLabelText('More actions')).toBeNull();
    expect(screen.queryByLabelText('Done')).toBeNull();
    expect(screen.queryByLabelText('Skip')).toBeNull();
    expect(screen.queryByTestId('s20-todo-done')).toBeNull();
    expect(screen.getByLabelText('Restore')).toBeTruthy();
  });

  it('Restore brings the normal page back and says so', async () => {
    fake.seedTask(deletedTask());
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await userEvent.press(await screen.findByLabelText('Restore'));
    expect(await screen.findByLabelText('More actions')).toBeTruthy();
    expect(toast()?.message).toBe('Restored “Morning workout”');
    expect(toast()?.tone).toBe('success');
    expect(screen.queryByTestId('task-deleted-notice')).toBeNull();
  });

  it('a failed Restore warns and the notice stays', async () => {
    fake.seedTask(deletedTask());
    fake.repos.tasks.restore = async () => err({ code: 'WRITE_FAILED', message: 'nope' });
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await userEvent.press(await screen.findByLabelText('Restore'));
    await waitFor(() => expect(toast()?.message).toBe("Couldn't do that. Try again."));
    expect(toast()?.tone).toBe('warning');
    expect(screen.getByTestId('task-deleted-notice')).toBeTruthy();
  });

  it('"Open Recently deleted" goes to that screen', async () => {
    fake.seedTask(deletedTask());
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await userEvent.press(await screen.findByLabelText('Open Recently deleted'));
    expect(await screen.findByText('MARKER_RECENTLY_DELETED')).toBeTruthy();
  });

  it('the as-needed page says it too and has no "Log used it"', async () => {
    fake.seedTask(deletedTask({ isAsNeeded: true, cadence: null }));
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1/as-needed', wrapper });
    expect(await screen.findByText(DELETED_NOTICE_COPY.headline('Morning workout'))).toBeTruthy();
    expect(screen.queryByLabelText('Log used it')).toBeNull();
    expect(screen.queryByLabelText('More actions')).toBeNull();
  });

  it('the icon and colour page says it too and has no Save', async () => {
    fake.seedTask(deletedTask());
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1/icon', wrapper });
    expect(await screen.findByText(DELETED_NOTICE_COPY.headline('Morning workout'))).toBeTruthy();
    expect(screen.queryByLabelText('Save')).toBeNull();
  });

  it('a delete link (S22) for an already deleted task shows the notice, not the delete sheet', async () => {
    fake.seedTask(deletedTask());
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1/delete', wrapper });
    expect(await screen.findByText(DELETED_NOTICE_COPY.headline('Morning workout'))).toBeTruthy();
    expect(screen.queryByTestId('delete-task-sheet')).toBeNull();
  });

  it('a task page that is open when the task is deleted elsewhere (the assistant) switches to the notice', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(CONTEXT, { initialUrl: '/task/task-1', wrapper });
    await screen.findByText('Morning workout');
    await act(async () => {
      await fake.repos.tasks.softDelete('task-1' as Id);
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tasks' });
    });
    expect(await screen.findByText(DELETED_NOTICE_COPY.headline('Morning workout'))).toBeTruthy();
    expect(screen.queryByLabelText('More actions')).toBeNull();
  });

  it('a task that is gone for good (deleted forever or expired) says so instead of loading forever', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/task/nope', wrapper });
    expect(await screen.findByText(GONE_NOTICE_COPY.headline)).toBeTruthy();
    expect(screen.queryByTestId('s20-loading')).toBeNull();
    await userEvent.press(screen.getByLabelText('Go to Today'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
  });

  it('the as-needed and icon pages say the same for a task that is gone', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/task/nope/as-needed', wrapper });
    expect(await screen.findByText(GONE_NOTICE_COPY.headline)).toBeTruthy();
  });

  it('the icon page says the same for a task that is gone', async () => {
    await renderRouter(CONTEXT, { initialUrl: '/task/nope/icon', wrapper });
    expect(await screen.findByText(GONE_NOTICE_COPY.headline)).toBeTruthy();
  });
});
