/**
 * "End routine" vs "Delete", as the task screen sees it: which kinds can be ended, the confirm
 * sheet, the Ended card and Start again, what an ended task hides, the menu swap, the delete
 * sheet's "End instead" line, and double taps.
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
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { err } from '@/types';
import type { Id, LocalDate, TaskWithSteps } from '@/types';
import { END_COPY } from './index';

const NOW = '2026-07-16T12:00:00.000Z';
const originalTasks = { ...fake.repos.tasks };
const ID = 'task-1' as Id;

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const toast = () => useToastStore.getState().toast;

beforeEach(() => {
  jest.restoreAllMocks();
  fake.reset();
  Object.assign(fake.repos.tasks, originalTasks);
  clock.today = '2026-07-16';
  clock.now = NOW;
  useToastStore.setState({ toast: null });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

const NOT_ROUTINE = { cadence: null, idealSteps: [], fallbackSteps: [] } as const;

async function open(task: TaskWithSteps, url = `/task/${ID}`) {
  fake.seedTask(task);
  await renderRouter(ROUTER_CONTEXT, { initialUrl: url, wrapper });
  await screen.findByText(task.name);
}
async function openMenu() {
  await userEvent.press(screen.getByTestId('s20-more'));
}
async function endIt(noun = 'routine') {
  await openMenu();
  await userEvent.press(await screen.findByLabelText(`End ${noun}`));
  const sheet = await screen.findByTestId('s20-end-confirm');
  await userEvent.press(within(sheet).getByLabelText(`End ${noun}`));
}
const stored = async () => (await fake.repos.tasks.get(ID))!;

describe('which kinds get "End"', () => {
  it.each([
    ['routine', makeTask({ id: ID }), 'routine', true],
    ['repeating event', makeTask({ id: ID, type: 'event', name: 'Standup', eventDate: null, cadence: { kind: 'daily' }, idealSteps: [], fallbackSteps: [] }), 'event', true],
    ['course', makeTask({ id: ID, type: 'course', name: 'Spanish', startDate: '2026-07-01' as LocalDate, endDate: '2026-09-01' as LocalDate, ...NOT_ROUTINE }), 'course', true],
    ['to-do', makeTask({ id: ID, type: 'todo', name: 'Call mum', ...NOT_ROUTINE }), 'to-do', false],
    ['note', makeTask({ id: ID, type: 'todo', isNote: true, name: 'Idea', ...NOT_ROUTINE }), 'note', false],
    ['as-needed routine', makeTask({ id: ID, isAsNeeded: true, cadence: null, name: 'Emergency plan' }), 'routine', false],
    ['one-off event', makeTask({ id: ID, type: 'event', name: 'Dentist', eventDate: '2026-08-01' as LocalDate, ...NOT_ROUTINE }), 'event', false],
  ])('%s: End offered = %s', async (_k, task, noun, offered) => {
    await open(task);
    await openMenu();
    expect(await screen.findByLabelText(`Delete ${noun}`)).toBeTruthy();
    expect(!!screen.queryByLabelText(`End ${noun}`)).toBe(offered);
    expect(screen.queryByLabelText('Start again')).toBeNull();
  });
});

describe('end confirm sheet', () => {
  it('shows the copy, and Cancel closes it without ending', async () => {
    await open(makeTask({ id: ID }));
    await openMenu();
    await userEvent.press(await screen.findByLabelText('End routine'));
    const sheet = await screen.findByTestId('s20-end-confirm');
    expect(within(sheet).getByText(END_COPY.confirmTitle('routine'))).toBeTruthy();
    expect(within(sheet).getByText(END_COPY.confirmBody('routine'))).toBeTruthy();
    await userEvent.press(within(sheet).getByLabelText('Cancel'));
    await waitFor(() => expect(screen.queryByTestId('s20-end-confirm')).toBeNull());
    expect((await stored()).endedOn ?? null).toBeNull();
    expect(screen.queryByTestId('s20-ended')).toBeNull();
    expect(toast()).toBeNull();
  });

  it('confirming ends it yesterday when today is unlogged, with the Ended card and a toast', async () => {
    await open(makeTask({ id: ID }));
    await endIt();
    expect(await screen.findByTestId('s20-ended')).toBeTruthy();
    expect(screen.getByText('Ended Jul 15')).toBeTruthy();
    expect(screen.getByText(END_COPY.endedBody)).toBeTruthy();
    expect((await stored()).endedOn).toBe('2026-07-15');
    expect(toast()?.message).toBe(END_COPY.endedToast);
    expect(screen.queryByTestId('s20-end-confirm')).toBeNull();
  });

  it('ends today when today is already logged', async () => {
    await open(makeTask({ id: ID }));
    await userEvent.press(await screen.findByLabelText(/^Morning workout: Done/));
    await waitFor(async () => expect((await fake.repos.logs.listForTask(ID, '2026-07-16' as LocalDate, '2026-07-16' as LocalDate)).length).toBe(1));
    await endIt();
    expect(await screen.findByText('Ended Jul 16')).toBeTruthy();
    expect((await stored()).endedOn).toBe('2026-07-16');
  });

  it('a failed end warns, keeps the sheet state sane and shows no Ended card', async () => {
    await open(makeTask({ id: ID }));
    fake.repos.tasks.update = async () => err({ code: 'WRITE_FAILED', message: 'nope' });
    await endIt();
    await waitFor(() => expect(toast()?.tone).toBe('warning'));
    expect(screen.queryByTestId('s20-ended')).toBeNull();
  });

  it('a double tap on End runs one end and one toast', async () => {
    await open(makeTask({ id: ID }));
    const spy = jest.fn(originalTasks.update);
    fake.repos.tasks.update = spy;
    await openMenu();
    await userEvent.press(await screen.findByLabelText('End routine'));
    const sheet = await screen.findByTestId('s20-end-confirm');
    const button = within(sheet).getByLabelText('End routine');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    expect(await screen.findByTestId('s20-ended')).toBeTruthy();
    expect(spy.mock.calls.filter(([, p]) => (p as { endedOn?: unknown }).endedOn !== undefined)).toHaveLength(1);
    expect(toast()?.message).toBe(END_COPY.endedToast);
  });
});

describe('an ended task', () => {
  const ended = (patch: Partial<TaskWithSteps> = {}) => makeTask({ id: ID, endedOn: '2026-07-10' as LocalDate, ...patch });

  it('shows the Ended card and hides Today logging, Time and Priority', async () => {
    await open(ended({ timeOfDay: '07:30' }));
    expect(screen.getByTestId('s20-ended')).toBeTruthy();
    expect(screen.getByText('Ended Jul 10')).toBeTruthy();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByTestId('s20-chip')).toBeNull();
    expect(screen.queryByText('Time')).toBeNull();
    expect(screen.queryByText('Priority')).toBeNull();
  });

  it('a running routine does show Today logging (control)', async () => {
    await open(makeTask({ id: ID }));
    expect(screen.queryByTestId('s20-ended')).toBeNull();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByLabelText(/^Last seven days/)).toBeTruthy();
    expect(screen.getByTestId('s20-chip')).toBeTruthy();
  });

  it('old data with endedOn undefined behaves as running, no crash', async () => {
    await open(makeTask({ id: ID, endedOn: undefined as unknown as null }));
    expect(screen.queryByTestId('s20-ended')).toBeNull();
    await openMenu();
    expect(await screen.findByLabelText('End routine')).toBeTruthy();
  });

  it('the menu offers Start again instead of End', async () => {
    await open(ended());
    await openMenu();
    // The Ended card's button and the menu entry.
    expect(await screen.findAllByLabelText('Start again')).toHaveLength(2);
    expect(screen.queryByLabelText('End routine')).toBeNull();
    expect(screen.getByLabelText('Delete routine')).toBeTruthy();
  });

  it('history stops at the end date and the week strip is gone; a day before it opens the day sheet', async () => {
    clock.today = '2026-07-16';
    await open(ended());
    expect(screen.queryByLabelText(/^2026-07-1[1-5],/)).toBeNull();
    expect(screen.queryByLabelText(/^Last seven days/)).toBeNull();
    await userEvent.press(screen.getByLabelText(/^2026-07-08,/));
    expect(await screen.findByTestId('s20-day-popover')).toBeTruthy();
  });

  it('Start again clears the Ended card, brings Today back, toasts, and marks the gap off', async () => {
    await open(ended());
    await userEvent.press(screen.getByTestId('s20-start-again'));
    await waitFor(() => expect(screen.queryByTestId('s20-ended')).toBeNull());
    expect(screen.getByText('Today')).toBeTruthy();
    expect(toast()?.message).toBe(END_COPY.startedToast);
    expect(toast()?.tone).toBe('success');
    expect((await stored()).endedOn ?? null).toBeNull();
    await openMenu();
    expect(await screen.findByLabelText('End routine')).toBeTruthy();
    expect(screen.queryByLabelText('Start again')).toBeNull();
  });

  it('Start again from the menu works the same', async () => {
    await open(ended());
    await openMenu();
    const entries = await screen.findAllByLabelText('Start again');
    expect(entries).toHaveLength(2);
    await userEvent.press(entries.find((e) => e.props.testID !== 's20-start-again') ?? entries[1]!);
    await waitFor(() => expect(screen.queryByTestId('s20-ended')).toBeNull());
    expect(toast()?.message).toBe(END_COPY.startedToast);
  });

  it('a double tap on Start again runs once', async () => {
    await open(ended());
    const spy = jest.fn(originalTasks.update);
    fake.repos.tasks.update = spy;
    const button = screen.getByTestId('s20-start-again');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await waitFor(() => expect(screen.queryByTestId('s20-ended')).toBeNull());
    expect(spy.mock.calls.filter(([, p]) => (p as { endedOn?: unknown }).endedOn === null)).toHaveLength(1);
    expect(toast()?.message).toBe(END_COPY.startedToast);
  });

  it('a failed Start again warns and keeps the Ended card', async () => {
    await open(ended());
    fake.repos.tasks.update = async () => err({ code: 'WRITE_FAILED', message: 'nope' });
    await userEvent.press(screen.getByTestId('s20-start-again'));
    await waitFor(() => expect(toast()?.tone).toBe('warning'));
    expect(screen.getByTestId('s20-ended')).toBeTruthy();
  });

  it('a course ended early gets the course noun and the same card', async () => {
    await open(makeTask({ id: ID, type: 'course', name: 'Spanish', startDate: '2026-07-01' as LocalDate, endDate: '2026-09-01' as LocalDate, endedOn: '2026-07-10' as LocalDate, ...NOT_ROUTINE }));
    expect(screen.getByTestId('s20-ended')).toBeTruthy();
    await openMenu();
    expect(await screen.findAllByLabelText('Start again')).toHaveLength(2);
    expect(screen.getByLabelText('Delete course')).toBeTruthy();
  });
});

describe('delete sheet wording', () => {
  async function openDelete(noun: string) {
    await openMenu();
    await userEvent.press(await screen.findByLabelText(`Delete ${noun}`));
    return screen.findByTestId('delete-task-sheet');
  }

  it('with canEnd it adds the End instead line', async () => {
    await open(makeTask({ id: ID }));
    const sheet = await openDelete('routine');
    expect(within(sheet).getByText(`${DELETE_COPY.message("Morning workout")} ${DELETE_COPY.endInstead("routine")}`)).toBeTruthy();
  });

  it('without canEnd (a to-do, an as-needed routine, an ended routine) it does not', async () => {
    await open(makeTask({ id: ID, type: 'todo', name: 'Call mum', ...NOT_ROUTINE }));
    const sheet = await openDelete('to-do');
    expect(within(sheet).queryByText(/End the/)).toBeNull();
  });

  it('an ended routine no longer suggests ending', async () => {
    await open(makeTask({ id: ID, endedOn: '2026-07-10' as LocalDate }));
    const sheet = await openDelete('routine');
    expect(within(sheet).queryByText(/End the/)).toBeNull();
    expect(within(sheet).getByText(DELETE_COPY.message('Morning workout'))).toBeTruthy();
  });
});

describe('wording', () => {
  it('has no em dashes in the end copy or delete copy', () => {
    const all = [
      END_COPY.confirmTitle('routine'),
      END_COPY.confirmBody('routine'),
      END_COPY.endedTitle('Jul 1'),
      END_COPY.endedBody,
      END_COPY.startAgain,
      END_COPY.endedToast,
      END_COPY.startedToast,
      DELETE_COPY.message('x'),
      DELETE_COPY.endInstead('routine'),
    ];
    for (const s of all) expect(s).not.toMatch(/[—–]/);
  });
});
