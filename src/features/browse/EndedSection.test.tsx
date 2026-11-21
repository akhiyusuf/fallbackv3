/**
 * Ended habits in the browse lists, through the real screens and the fake repos: an ended routine
 * or repeating event sits only in "Paused"; an ended course counts as past; opening one reaches the
 * task page with its Start again; old rows with no endedOn still behave.
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
import { render, userEvent, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import type { Id, LocalDate } from '@/types';

import RoutinesBrowseScreen from './RoutinesBrowseScreen';
import EventsBrowseScreen from './EventsBrowseScreen';
import CoursesBrowseScreen from './CoursesBrowseScreen';
import { ENDED_COPY, EndedSection } from './EndedSection';

const CONTEXT = { ...ROUTER_CONTEXT, routines: RoutinesBrowseScreen, events: EventsBrowseScreen, courses: CoursesBrowseScreen };

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fake.reset();
  clock.today = '2026-07-16';
  clock.now = '2026-07-16T12:00:00.000Z';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

const D = (s: string) => s as LocalDate;
const NONE = { cadence: null, idealSteps: [], fallbackSteps: [] } as const;
const repeatingEvent = (id: string, name: string, patch = {}) =>
  makeTask({ id: id as Id, type: 'event', name, eventDate: null, cadence: { kind: 'daily' }, idealSteps: [], fallbackSteps: [], ...patch });

describe('Routines', () => {
  it('an ended routine shows only under Ended (with "Paused since Jul 10"), not in Due, Other or As needed', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, name: 'Running one' }));
    fake.seedTask(makeTask({ id: 'b' as Id, name: 'Stopped one', endedOn: D('2026-07-10') }));
    fake.seedTask(makeTask({ id: 'c' as Id, name: 'Stopped as needed', isAsNeeded: true, cadence: null, endedOn: D('2026-07-10') }));
    await renderRouter(CONTEXT, { initialUrl: '/routines', wrapper });
    const section = await screen.findByTestId('ended-section');
    expect(within(section).getByText('Paused')).toBeTruthy();
    expect(within(section).getByText('Stopped one')).toBeTruthy();
    expect(within(section).getByText('Stopped as needed')).toBeTruthy();
    expect(within(section).getAllByText(/Paused since Jul 10/).length).toBe(2);
    expect(screen.getAllByText('Stopped one')).toHaveLength(1);
    expect(screen.getAllByText('Stopped as needed')).toHaveLength(1);
    expect(screen.getByText('Running one')).toBeTruthy();
    expect(within(section).queryByText('Running one')).toBeNull();
  });

  it('no Ended section when nothing is ended, and old rows with endedOn missing count as running', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, name: 'Old row', endedOn: undefined as unknown as null }));
    await renderRouter(CONTEXT, { initialUrl: '/routines', wrapper });
    await screen.findByText('Old row');
    expect(screen.queryByTestId('ended-section')).toBeNull();
  });

  it('opening an ended routine shows its Ended card; Start again puts it back in the list', async () => {
    fake.seedTask(makeTask({ id: 'b' as Id, name: 'Stopped one', endedOn: D('2026-07-10') }));
    await renderRouter(CONTEXT, { initialUrl: '/routines', wrapper });
    await userEvent.press(await screen.findByText('Stopped one'));
    await userEvent.press(await screen.findByTestId('s20-start-again'));
    await waitFor(() => expect(screen.queryByTestId('s20-ended')).toBeNull());
    await userEvent.press(screen.getByLabelText('Back'));
    await screen.findByText('Stopped one');
    await waitFor(() => expect(screen.queryByTestId('ended-section')).toBeNull());
  });

  it('ending a routine from its page moves it into Ended on the list', async () => {
    fake.seedTask(makeTask({ id: 'a' as Id, name: 'Running one' }));
    await renderRouter(CONTEXT, { initialUrl: '/routines', wrapper });
    await userEvent.press(await screen.findByText('Running one'));
    await userEvent.press(await screen.findByTestId('s20-more'));
    await userEvent.press(await screen.findByLabelText('Pause routine'));
    await userEvent.press(within(await screen.findByTestId('s20-end-confirm')).getByLabelText('Pause routine'));
    await screen.findByTestId('s20-ended');
    await userEvent.press(screen.getByLabelText('Back'));
    const section = await screen.findByTestId('ended-section');
    expect(within(section).getByText('Running one')).toBeTruthy();
  });
});

describe('Events', () => {
  it('an ended repeating event shows only under Ended, not under Today or Upcoming; one-offs are untouched', async () => {
    fake.seedTask(repeatingEvent('e1', 'Weekly standup'));
    fake.seedTask(repeatingEvent('e2', 'Old club', { endedOn: D('2026-07-01') }));
    fake.seedTask(makeTask({ id: 'e3' as Id, type: 'event', name: 'Dentist', eventDate: D('2026-08-01'), ...NONE }));
    await renderRouter(CONTEXT, { initialUrl: '/events', wrapper });
    const section = await screen.findByTestId('ended-section');
    expect(within(section).getByText('Old club')).toBeTruthy();
    expect(within(section).getByText('Paused since Jul 1')).toBeTruthy();
    expect(screen.getAllByText('Old club')).toHaveLength(1);
    expect(screen.getByText('Weekly standup')).toBeTruthy();
    expect(screen.getByText('Dentist')).toBeTruthy();
    expect(within(section).queryByText('Weekly standup')).toBeNull();
  });

  it('no Ended section when none is ended', async () => {
    fake.seedTask(repeatingEvent('e1', 'Weekly standup'));
    await renderRouter(CONTEXT, { initialUrl: '/events', wrapper });
    await screen.findByText('Weekly standup');
    expect(screen.queryByTestId('ended-section')).toBeNull();
  });
});

describe('Courses', () => {
  const course = (id: string, name: string, patch = {}) =>
    makeTask({ id: id as Id, type: 'course', name, startDate: D('2026-07-01'), endDate: D('2026-09-01'), ...NONE, ...patch });

  // Twenty-eighth pass: a paused course is neither running nor finished. It sits in its own Paused
  // section on the Active lens, never under Past.
  it('a paused course is in the Paused section on Active, not under Past; a running one stays Active', async () => {
    fake.seedTask(course('c1', 'Running course'));
    fake.seedTask(course('c2', 'Stopped course', { endedOn: D('2026-07-10') }));
    await renderRouter(CONTEXT, { initialUrl: '/courses', wrapper });
    await screen.findByText('Running course');
    expect(await screen.findByTestId('ended-section')).toBeTruthy();
    expect(within(screen.getByTestId('ended-section')).getByText('Stopped course')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Past'));
    expect(screen.queryByText('Stopped course')).toBeNull();
  });
});

describe('EndedSection', () => {
  it('renders nothing for no tasks', async () => {
    await render(<EndedSection tasks={[]} onOpen={() => {}} />, { wrapper });
    expect(screen.queryByTestId('ended-section')).toBeNull();
  });

  it('orders by end date, newest first', async () => {
    await render(
      <EndedSection
        onOpen={() => {}}
        tasks={[makeTask({ id: 'x' as Id, name: 'Older', endedOn: D('2026-06-01') }), makeTask({ id: 'y' as Id, name: 'Newer', endedOn: D('2026-07-01') })]}
      />,
      { wrapper },
    );
    const names = screen.getAllByText(/^(Older|Newer)$/).map((n) => n.props.children);
    expect(names).toEqual(['Newer', 'Older']);
    expect(ENDED_COPY.meta(D('2026-06-01'))).not.toMatch(/[—–]/);
  });
});
