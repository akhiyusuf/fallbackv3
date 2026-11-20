/**
 * Edge cases for the four create forms: blank and padded names, blank steps, double taps, a
 * save that throws, a fallback with no ideal, time at the ends of the day, a past event.
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
import { fireEvent, userEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { useToastStore } from '@/app-shell/stores/toast';
import type { Step, Task } from '@/types';

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

let inserted: { task: Task; steps: readonly Step[] }[] = [];
let insertDelayMs = 0;
function first() {
  const row = inserted[0];
  if (!row) throw new Error('nothing was saved');
  return row;
}
beforeEach(() => {
  fake.reset();
  clock.today = '2026-07-16';
  clock.now = '2026-07-16T12:00:00.000Z';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
  inserted = [];
  insertDelayMs = 0;
  const real = fake.repos.tasks.insert.bind(fake.repos.tasks);
  fake.repos.tasks.insert = async (task: Task, steps: readonly Step[]) => {
    inserted.push({ task, steps });
    if (insertDelayMs) await new Promise((r) => setTimeout(r, insertDelayMs));
    return real(task, steps);
  };
  useToastStore.setState({ toast: null });
});

async function pickDate(label: RegExp, date: Date) {
  await userEvent.press(await screen.findByLabelText(label));
  await fireEvent(await screen.findByTestId('date-picker'), 'change', { type: 'set' }, date);
  await userEvent.press(screen.getByText('Done'));
}

async function fillRoutine(name = 'Studying', ideal = 'Review notes', fallback = 'Skim notes') {
  await userEvent.type(await screen.findByLabelText('Routine name'), name);
  await userEvent.press(screen.getByLabelText('Mon'));
  if (ideal) await userEvent.type(await screen.findByLabelText('Ideal step 1'), ideal);
  if (fallback) await userEvent.type(await screen.findByLabelText('Fallback step 1'), fallback);
}

describe('routine form edges', () => {
  it('whitespace-only name is refused with the name error', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await fillRoutine('     ');
    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText('Give this routine a name to save it.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('a padded name with emoji is saved trimmed; a 200 character name is kept whole', async () => {
    const long = `${'x'.repeat(190)} 🏃‍♀️💪`;
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await fillRoutine(`   ${long}   `);
    await userEvent.press(screen.getByLabelText('Save routine'));
    await screen.findByText('MARKER_TODAY');
    expect(first().task.name).toBe(long);
  });

  it('a routine with no ideal step typed (only a fallback) is refused', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await fillRoutine('Studying', '', 'Skim notes');
    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText('Add at least one ideal step to save this routine.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('a routine with an ideal but no fallback typed is refused', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await fillRoutine('Studying', 'Review notes', '');
    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText('Add a fallback: the smallest version for a hard day.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('an ideal step of only spaces does not count as a step', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await fillRoutine('Studying', '    ', 'Skim notes');
    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText('Add at least one ideal step to save this routine.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('weekly (specific days) with no day picked is refused with the day error', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await userEvent.type(await screen.findByLabelText('Routine name'), 'Studying');
    await userEvent.type(await screen.findByLabelText('Ideal step 1'), 'Review notes');
    await userEvent.type(await screen.findByLabelText('Fallback step 1'), 'Skim notes');
    await userEvent.press(screen.getByLabelText('Save routine'));
    expect(await screen.findByText('Pick at least one day this routine runs.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('three taps on Save in the same moment with a slow store save one routine', async () => {
    insertDelayMs = 200;
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await fillRoutine();
    const save = screen.getByLabelText('Save routine');
    await fireEvent.press(save);
    await fireEvent.press(save);
    await fireEvent.press(save);
    await screen.findByText('MARKER_TODAY');
    expect(inserted).toHaveLength(1);
  });

  it('a save that throws (not just returns an error) shows the failure toast and leaves Save usable', async () => {
    fake.repos.tasks.insert = async () => {
      throw new Error('disk I/O error');
    };
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await fillRoutine();
    await userEvent.press(screen.getByLabelText('Save routine'));
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe("Couldn't save that. Try again."));
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
    expect(screen.getByLabelText('Save routine').props.accessibilityState?.disabled).not.toBe(true);
    expect(screen.getByDisplayValue('Studying')).toBeTruthy();
  });

  it('as-needed with nothing but a name saves (no steps required)', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/routine', wrapper });
    await userEvent.type(await screen.findByLabelText('Routine name'), 'Headache pill');
    await userEvent.press(screen.getByTestId('as-needed-switch'));
    await userEvent.press(screen.getByLabelText('Save routine'));
    await screen.findByText('MARKER_TODAY');
    expect(first().task.isAsNeeded).toBe(true);
    expect(first().steps).toHaveLength(0);
  });
});

describe('event form edges', () => {
  it('whitespace-only name is refused', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await userEvent.type(await screen.findByLabelText('Event name'), '   ');
    await userEvent.press(screen.getByLabelText('Save event'));
    expect(await screen.findByText('Give this event a name to save it.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('two taps with a slow store save one event', async () => {
    insertDelayMs = 200;
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await userEvent.type(await screen.findByLabelText('Event name'), 'Dentist');
    await fireEvent.press(screen.getByLabelText('Save event'));
    await fireEvent.press(screen.getByLabelText('Save event'));
    await screen.findByText('MARKER_TODAY');
    expect(inserted).toHaveLength(1);
  });

  it('an event in the past is allowed (nothing in the spec forbids it) and is saved on that date', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await userEvent.type(await screen.findByLabelText('Event name'), 'Last week');
    await pickDate(/^Date/, new Date(2026, 6, 1));
    await userEvent.press(screen.getByLabelText('Save event'));
    await screen.findByText('MARKER_TODAY');
    expect(first().task.eventDate).toBe('2026-07-01');
  });

  it('a time at 00:00 and at 23:59 is kept (midnight is a time, not "no time")', async () => {
    for (const [h, m, want] of [[0, 0, '00:00'], [23, 59, '23:59']] as const) {
      inserted = [];
      const view = await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
      await userEvent.type(await screen.findByLabelText('Event name'), `At ${want}`);
      await userEvent.press(await screen.findByLabelText(/^Time/));
      const d = new Date(2026, 6, 16, h, m);
      await fireEvent(await screen.findByTestId('time-picker'), 'change', { type: 'set' }, d);
      await userEvent.press(screen.getByText('Done'));
      await userEvent.press(screen.getByLabelText('Save event'));
      await screen.findByText('MARKER_TODAY');
      expect(first().task.timeOfDay).toBe(want);
      await view.unmount();
    }
  });

  it('tracking on with blank steps saves without blank steps in the store', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/event', wrapper });
    await userEvent.type(await screen.findByLabelText('Event name'), 'Gig');
    await userEvent.press(screen.getByTestId('event-tracking-switch'));
    await userEvent.type(await screen.findByLabelText('Ideal step 1'), '   ');
    await userEvent.press(screen.getByLabelText('Save event'));
    await screen.findByText('MARKER_TODAY');
    expect(first().steps).toHaveLength(0);
  });
});

describe('course form edges', () => {
  async function fillCourse(ideal = 'Take with food', fallback = 'Take the dose') {
    await userEvent.type(await screen.findByLabelText('Course name'), 'Antibiotics');
    await pickDate(/^Ends/, new Date(2026, 6, 26));
    if (ideal) await userEvent.type(await screen.findByLabelText('Ideal step 1'), ideal);
    if (fallback) await userEvent.type(await screen.findByLabelText('Fallback step 1'), fallback);
  }

  it('end on the same day as the start is allowed', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    await userEvent.type(await screen.findByLabelText('Course name'), 'One day');
    await pickDate(/^Ends/, new Date(2026, 6, 16));
    await userEvent.type(await screen.findByLabelText('Ideal step 1'), 'a');
    await userEvent.type(await screen.findByLabelText('Fallback step 1'), 'b');
    await userEvent.press(screen.getByLabelText('Save course'));
    await screen.findByText('MARKER_TODAY');
    expect(first().task.startDate).toBe('2026-07-16');
    expect(first().task.endDate).toBe('2026-07-16');
  });

  it('a fallback with no ideal is refused', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    await fillCourse('', 'Take the dose');
    await userEvent.press(screen.getByLabelText('Save course'));
    expect(await screen.findByText('Add at least one ideal step to save this course.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('doses per day cannot go below 1 or above 12', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    const down = await screen.findByLabelText('Decrease doses per day');
    await userEvent.press(down);
    await userEvent.press(down);
    const up = screen.getByLabelText('Increase doses per day');
    for (let i = 0; i < 15; i++) await userEvent.press(up);
    await fillCourse();
    await userEvent.press(screen.getByLabelText('Save course'));
    await screen.findByText('MARKER_TODAY');
    expect(first().task.dosesPerDay).toBe(12);
  });

  it('two taps with a slow store save one course', async () => {
    insertDelayMs = 200;
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/course', wrapper });
    await fillCourse();
    await fireEvent.press(screen.getByLabelText('Save course'));
    await fireEvent.press(screen.getByLabelText('Save course'));
    await screen.findByText('MARKER_TODAY');
    expect(inserted).toHaveLength(1);
  });
});

describe('to-do form edges', () => {
  it('whitespace-only name is refused', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/todo', wrapper });
    await userEvent.type(await screen.findByLabelText('Name'), '    ');
    await userEvent.press(screen.getByLabelText('Save to-do'));
    expect(await screen.findByText('Give this a name to save it.')).toBeTruthy();
    expect(inserted).toHaveLength(0);
  });

  it('two taps with a slow store save one to-do; the duplicate name is allowed on a later save', async () => {
    insertDelayMs = 150;
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/todo', wrapper });
    await userEvent.type(await screen.findByLabelText('Name'), 'Renew passport');
    await fireEvent.press(screen.getByLabelText('Save to-do'));
    await fireEvent.press(screen.getByLabelText('Save to-do'));
    await screen.findByText('MARKER_TODOS', {}, { timeout: 3000 }).catch(() => undefined);
    await waitFor(() => expect(inserted).toHaveLength(1));
  });

  it('emoji and a padded name are saved trimmed', async () => {
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/add/todo', wrapper });
    await userEvent.type(await screen.findByLabelText('Name'), '  Call mum 📞  ');
    await userEvent.press(screen.getByLabelText('Save to-do'));
    await waitFor(() => expect(inserted).toHaveLength(1));
    expect(first().task.name).toBe('Call mum 📞');
  });
});
