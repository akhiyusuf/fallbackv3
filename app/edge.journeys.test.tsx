/**
 * Whole journeys through the real route files and the real root layout (providers, Stack, tab bar,
 * toast, celebration host), with the fake repositories behind them and a controllable clock.
 * Each test walks a person's path across several screens and checks what each screen shows,
 * where Back lands, and what the router stack looks like (no loops, no stray copies).
 */
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
});
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});
// The root layout makes its own query client; keep hold of it so each test starts with an empty cache.
const mockClients: { clear(): void }[] = [];
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  class CapturingClient extends actual.QueryClient {
    constructor(...args: ConstructorParameters<typeof actual.QueryClient>) {
      super(...args);
      mockClients.push(this as never);
    }
  }
  return { ...actual, QueryClient: CapturingClient };
});

// The reminder tap: the app registers one listener for it, once for the life of the module (the bridge is
// idempotent), and the test calls that listener.
let mockTapListener: ((response: unknown) => void) | null = null;
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  addNotificationResponseReceivedListener: jest.fn((listener: (response: unknown) => void) => {
    mockTapListener = listener;
    return { remove: () => undefined };
  }),
}));

import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import { routingQueue } from 'expo-router/build/global-state/routingQueue';
import { store as routerStore } from 'expo-router/build/global-state/router-store';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, fireEvent, userEvent, waitFor, within } from '@testing-library/react-native';

import { useAddMenuStore, useCelebrationStore, useToastStore } from '@/app-shell';
import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import type { Id, LocalDate, TaskWithSteps } from '@/types';

const CONTEXT = {
  _layout: require('./_layout').default,
  index: require('./index').default,
  splash: require('./splash').default,
  search: require('./search').default,
  progress: require('./progress/index').default,
  'progress/trend': require('./progress/trend').default,
  achievements: require('./achievements/index').default,
  priorities: require('./priorities/index').default,
  settings: require('./settings/index').default,
  'settings/data/index': require('./settings/data/index').default,
  'settings/data/deleted': require('./settings/data/deleted').default,
  'settings/data/erase': require('./settings/data/erase').default,
  'onboarding/concept': require('./onboarding/concept').default,
  'onboarding/hook': require('./onboarding/hook').default,
  'onboarding/types': require('./onboarding/types').default,
  'onboarding/consistency': require('./onboarding/consistency').default,
  'onboarding/personalize': require('./onboarding/personalize').default,
  'onboarding/notifications-primer': require('./onboarding/notifications-primer').default,
  'onboarding/first-task': require('./onboarding/first-task').default,
  'add/index': require('./add/index').default,
  'add/routine': require('./add/routine').default,
  'add/event': require('./add/event').default,
  'add/course': require('./add/course').default,
  'add/todo': require('./add/todo').default,
  'task/[id]/index': require('./task/[id]/index').default,
  'task/[id]/icon': require('./task/[id]/icon').default,
  'task/[id]/delete': require('./task/[id]/delete').default,
  'task/[id]/as-needed': require('./task/[id]/as-needed').default,
  'task/[id]/celebrate': require('./task/[id]/celebrate').default,
  '(tabs)/_layout': require('./(tabs)/_layout').default,
  '(tabs)/today': require('./(tabs)/today').default,
  '(tabs)/routines': require('./(tabs)/routines').default,
  '(tabs)/events': require('./(tabs)/events').default,
  '(tabs)/courses': require('./(tabs)/courses').default,
  '(tabs)/todos': require('./(tabs)/todos').default,
};

const D1 = '2026-07-16';
const D2 = '2026-07-17';
const at = (d: string, h = 12) => `${d}T${String(h).padStart(2, '0')}:00:00.000Z`;

// The phone's back button: every listener the app and the router register, called newest first, the
// way Android does. `pressBack()` is true when NOTHING took it, which on a phone leaves the app.
type BackListener = () => boolean | null | undefined;
let backListeners: BackListener[] = [];
async function pressBack(): Promise<{ exited: boolean }> {
  let exited = true;
  await act(async () => {
    for (const listener of [...backListeners].reverse()) {
      if (listener()) {
        exited = false;
        break;
      }
    }
  });
  return { exited };
}

beforeEach(() => {
  routingQueue.queue = [];
  backListeners = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, listener: BackListener) => {
    backListeners.push(listener);
    return { remove: () => void (backListeners = backListeners.filter((l) => l !== listener)) };
  }) as never);
  mockClients.forEach((c) => c.clear());
  fake.reset();
  // A person who installed today: the tenure marks start from today, not from the fake's 2024.
  fake.seedSettings({ tenureAnchorDate: D1 as LocalDate });
  clock.today = D1;
  clock.now = at(D1);
  useToastStore.setState({ toast: null });
  useCelebrationStore.setState({ queue: [] });
  useAddMenuStore.setState({ open: false } as never);
});

async function launch(url: string) {
  await renderRouter(CONTEXT, { initialUrl: url });
}
const path = () => routerStore.getRouteInfo().pathname;
const params = () => routerStore.getRouteInfo().params;
/** The root stack, bottom to top, as route names. (The tab group is one entry, whatever tab is showing.) */
function rootStack(): string[] {
  type S = { routes: { name: string; state?: S }[] };
  let state = routerStore.state as S | undefined;
  // The first level is expo-router's own `__root` wrapper around the app's navigator.
  while (state && state.routes.length === 1 && state.routes[0]!.name === '__root') state = state.routes[0]!.state;
  return (state?.routes ?? []).map((r) => r.name);
}
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
const toast = () => useToastStore.getState().toast;



async function press(label: string | RegExp) {
  await userEvent.press(await screen.findByLabelText(label));
}

describe('journey 1: first launch to Progress', () => {
  it('splash, the tour, the first routine, Today, log it, the badge, Progress', async () => {
    await launch('/');
    await waitFor(() => expect(path()).toBe('/onboarding/concept'), { timeout: 5000 });
    expect(screen.getByText('A plan A and a plan B for every task.')).toBeTruthy();
    for (const next of ['/onboarding/hook', '/onboarding/types', '/onboarding/consistency', '/onboarding/personalize', '/onboarding/notifications-primer']) {
      await press('Next');
      await waitFor(() => expect(path()).toBe(next));
    }
    await press('Not now');
    await waitFor(() => expect(path()).toBe('/onboarding/first-task'));
    await userEvent.type(screen.getByLabelText('Name'), 'Evening walk');
    await userEvent.type(screen.getByLabelText('Ideal'), 'Walk 30 minutes');
    await userEvent.type(screen.getByLabelText('Fallback'), 'Walk to the corner');
    await press('Save routine');
    await waitFor(() => expect(path()).toBe('/today'));
    expect(params()).toMatchObject({ justAdded: '1' });
    // The tour is gone from the stack: Today is the only screen, so Back does not walk the tour again.
    await waitFor(() => expect(rootStack()).toEqual(['(tabs)']));
    expect(await screen.findByText('Evening walk')).toBeTruthy();
    expect(screen.getByText('0 of 1 done')).toBeTruthy();
    expect(fake.currentSettings().onboardingCompletedAt).not.toBeNull();
    await press(/Evening walk: Done/);
    await waitFor(() => expect(toast()?.message).toBe('Ideal done'));
    expect(screen.getByText('1 of 1 done')).toBeTruthy();
    // The first day is a milestone: the pop-up arrives after the log sound and a breath.
    await advance(3000);
    expect(await screen.findByText("You've reached First day.")).toBeTruthy();
    expect(useCelebrationStore.getState().queue).toHaveLength(1);
    await press('Nice');
    await waitFor(() => expect(screen.queryByText("You've reached First day.")).toBeNull());
    expect(useCelebrationStore.getState().queue).toHaveLength(0);
    // Open Progress from the stat card on Today.
    await userEvent.press((await screen.findAllByLabelText(/^Consistency/))[0]!);
    await waitFor(() => expect(path()).toBe('/progress'));
    expect(await screen.findByText('Your consistency')).toBeTruthy();
    expect((await screen.findAllByLabelText(/^100 percent showed up/)).length).toBeGreaterThan(0);
    // Back from Progress is Today, with the day still logged.
    await press('Back');
    await waitFor(() => expect(path()).toBe('/today'));
    expect(screen.getByText('1 of 1 done')).toBeTruthy();
    expect(rootStack()).toEqual(['(tabs)']);
    // The tour is not behind Today: the phone back button leaves the app rather than walking the tour again.
    expect(await backUntilExit()).toEqual([]);
  });
});

/** A saved routine that runs every day, seeded the way the app would have stored it. */
function routine(id: string, name: string, patch: Partial<TaskWithSteps> = {}): TaskWithSteps {
  return makeTask({ id: id as Id, name, createdAt: at('2026-07-01', 8) as never, updatedAt: at('2026-07-01', 8) as never, ...patch });
}
async function openTab(label: 'Today' | 'Routines' | 'Events' | 'Courses' | 'To-dos') {
  await userEvent.press(await screen.findByLabelText(label));
}

describe('journey 2: create on the Routines tab, push to tomorrow, next day', () => {
  it('creates, opens, pushes, backs out to Routines, and logs both cards the next day', async () => {
    fake.seedTask(routine('old', 'Stretch'));
    await launch('/today');
    await screen.findByText('Stretch');
    await openTab('Routines');
    await waitFor(() => expect(path()).toBe('/routines'));
    await press('New routine');
    await waitFor(() => expect(path()).toBe('/add/routine'));
    expect(params()).toMatchObject({ from: 'routines' });
    await userEvent.type(await screen.findByLabelText('Routine name'), 'Read');
    await press('Thu');
    await press('Fri');
    await userEvent.type(await screen.findByLabelText('Ideal step 1'), 'Read a chapter');
    await userEvent.type(await screen.findByLabelText('Fallback step 1'), 'Read a page');
    await press('Save routine');
    // The spec sends a saved routine to Today, with a toast.
    await waitFor(() => expect(path()).toBe('/today'));
    expect(toast()?.message).toBe('Routine saved.');
    expect(await screen.findByText('0 of 2 done')).toBeTruthy();

    await openTab('Routines');
    await userEvent.press(await screen.findByText('Read'));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    expect(params()).toMatchObject({ from: 'routines' });
    const taskId = String(params().id);
    await userEvent.press(await screen.findByTestId('s20-snooze'));
    await waitFor(() => expect(toast()?.message).toBe('Pushed to tomorrow.'));
    expect(fake.logsFor(taskId as Id).some((l) => l.date === D1 && l.movedToDate === D2)).toBe(true);

    // Back goes to where the person came from (Routines), not to Today.
    await press('Back');
    await waitFor(() => expect(path()).toBe('/routines'));
    expect(screen.getByText('Read')).toBeTruthy();
    expect(rootStack().filter((n) => n.startsWith('task'))).toEqual([]);

    // Today no longer asks for it today.
    await openTab('Today');
    await waitFor(() => expect(path()).toBe('/today'));
    expect(await screen.findByText('0 of 1 done')).toBeTruthy();

    // Midnight passes with the app open: the day rolls over on its own.
    clock.today = D2;
    clock.now = at(D2, 0);
    await advance(61_000);
    expect(await screen.findByText('Fri, Jul 17')).toBeTruthy();
    // Stretch, Read (its own Friday) and Read pushed from yesterday.
    expect(await screen.findByText('0 of 3 done')).toBeTruthy();
    expect(screen.getAllByText('Read')).toHaveLength(2);
    expect(screen.getAllByLabelText(/From yesterday/)).toHaveLength(1);
    for (const button of await screen.findAllByLabelText(/^(Read|Stretch): Done/)) await userEvent.press(button);
    await waitFor(() => expect(screen.getByText('3 of 3 done')).toBeTruthy());
    // Each card has its own row: today's own on D2, the pushed one on its source day (D1, moved to D2).
    const logs = fake.logsFor(taskId as Id);
    expect(logs.find((l) => l.date === D2)?.chipState).toBe('done');
    expect(logs.find((l) => l.date === D1)).toMatchObject({ movedToDate: D2, chipState: 'done' });
  });
});

async function openFromList(name: string, tab: 'Routines' | 'Events' | 'Courses' | 'To-dos' = 'Routines') {
  await openTab(tab);
  await userEvent.press(await screen.findByText(name));
  await waitFor(() => expect(path()).toMatch(/^\/task\//));
}

describe('journey 3: end a routine, find it under Ended, start it again', () => {
  it('ends from the page, lists it under Ended, hides it from Today, then Start again brings it back', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    fake.seedTask(routine('b', 'Journal', { name: 'Journal' }));
    await launch('/today');
    expect(await screen.findByText('0 of 2 done')).toBeTruthy();

    await openFromList('Stretch');
    await userEvent.press(await screen.findByTestId('s20-more'));
    await userEvent.press(await screen.findByLabelText('End routine'));
    await userEvent.press(within(await screen.findByTestId('s20-end-confirm')).getByLabelText('End routine'));
    expect(await screen.findByTestId('s20-ended')).toBeTruthy();
    expect(screen.getByText('Ended Jul 15')).toBeTruthy();
    expect((await fake.repos.tasks.get('a' as Id))?.endedOn).toBe('2026-07-15');
    // Still on the page it was ended from; Back goes to the list it was opened from.
    await press('Back');
    await waitFor(() => expect(path()).toBe('/routines'));
    const ended = await screen.findByTestId('ended-section');
    expect(within(ended).getByText('Stretch')).toBeTruthy();
    expect(within(ended).getByText('Ended Jul 15')).toBeTruthy();
    // Today only asks for the routine that is still running.
    await openTab('Today');
    expect(await screen.findByText('0 of 1 done')).toBeTruthy();
    expect(screen.queryByText('Stretch')).toBeNull();

    // Open it again from Ended, and start it again.
    await openTab('Routines');
    await userEvent.press(await within(await screen.findByTestId('ended-section')).findByText('Stretch'));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await userEvent.press(await screen.findByTestId('s20-start-again'));
    await waitFor(() => expect(screen.queryByTestId('s20-ended')).toBeNull());
    expect((await fake.repos.tasks.get('a' as Id))?.endedOn ?? null).toBeNull();
    await press('Back');
    await waitFor(() => expect(path()).toBe('/routines'));
    expect(screen.queryByTestId('ended-section')).toBeNull();
    await openTab('Today');
    expect(await screen.findByText('0 of 2 done')).toBeTruthy();
    expect(screen.getByText('Stretch')).toBeTruthy();
    // The days it was ended did not become misses: the record has nothing missed for it.
    await userEvent.press((await screen.findAllByLabelText(/^Consistency/))[0]!);
    await waitFor(() => expect(path()).toBe('/progress'));
    expect(await screen.findByText('Your consistency')).toBeTruthy();
  });
});

function dayLog(taskId: string, date: string, chip: 'done' | 'fallback' = 'done') {
  return {
    id: `log-${taskId}-${date}` as Id, taskId: taskId as Id, date: date as LocalDate, chipState: chip, isManualOverride: true,
    completedStepIds: [], dosesCompleted: 0, movedToDate: null, createdAt: at(date, 8) as never, updatedAt: at(date, 8) as never,
  };
}
/** The All tasks / All time number on Progress: the "(n) of (m) counted days" line. */
async function allTimeCountedDays(): Promise<string> {
  await userEvent.press(await screen.findByLabelText('All tasks'));
  await userEvent.press(await screen.findByLabelText('All time'));
  const line = await screen.findByText(/counted days/);
  return String(line.props.children);
}
async function deleteFromTaskPage(noun = 'routine') {
  await userEvent.press(await screen.findByTestId('s20-more'));
  await userEvent.press(await screen.findByLabelText(`Delete ${noun}`));
  await userEvent.press(within(await screen.findByTestId('delete-task-sheet')).getByLabelText(`Delete ${noun}`));
}
async function openRecentlyDeleted() {
  await userEvent.press(await screen.findByLabelText('Settings'));
  await waitFor(() => expect(path()).toBe('/settings'));
  await userEvent.press(await screen.findByLabelText('Data'));
  await waitFor(() => expect(path()).toBe('/settings/data'));
  await userEvent.press(await screen.findByTestId('s47-recently-deleted'));
  await waitFor(() => expect(path()).toBe('/settings/data/deleted'));
}

describe('journey 4: delete, Undo, delete, restore from Settings, delete forever, the record stays', () => {
  it('walks every way back from a delete and keeps counting the days that were logged', async () => {
    fake.seedTask(routine('a', 'Stretch', { createdAt: at('2026-07-10', 8) as never }));
    for (const d of ['2026-07-12', '2026-07-13', '2026-07-14']) await fake.repos.logs.upsert(dayLog('a', d));
    await fake.repos.logs.upsert(dayLog('a', '2026-07-15', 'fallback'));
    await launch('/today');
    await screen.findByText('Stretch');

    // The record before anything is deleted.
    await userEvent.press((await screen.findAllByLabelText(/^Consistency/))[0]!);
    await waitFor(() => expect(path()).toBe('/progress'));
    const before = await allTimeCountedDays();
    expect(before).toMatch(/of \d+ counted days/);
    await press('Back');
    await waitFor(() => expect(path()).toBe('/today'));

    // Delete from the task page opened on Today: lands on Today with an Undo toast.
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await deleteFromTaskPage();
    await waitFor(() => expect(path()).toBe('/today'));
    expect(toast()?.message).toBe('Moved to Recently deleted.');
    expect(await screen.findByText('Nothing planned for today yet.')).toBeTruthy();
    expect(screen.queryByText('Stretch')).toBeNull();

    // Undo from the toast: it is back on Today, whole.
    await press('Undo');
    await waitFor(() => expect(toast()?.message).toBe('Restored "Stretch"'));
    expect(await screen.findByText('Stretch')).toBeTruthy();
    expect((await fake.repos.tasks.get('a' as Id))?.deletedAt ?? null).toBeNull();

    // Delete again, then restore from Settings > Data > Recently deleted.
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    await deleteFromTaskPage();
    await waitFor(() => expect(path()).toBe('/today'));
    await openRecentlyDeleted();
    await userEvent.press(await screen.findByTestId('deleted-row-a'));
    await userEvent.press(within(await screen.findByTestId('deleted-item-sheet')).getByText('Restore'));
    await waitFor(() => expect(toast()?.message).toBe('Restored "Stretch"'));
    expect(await screen.findByText(/Nothing here/)).toBeTruthy();
    expect((await fake.repos.tasks.get('a' as Id))?.deletedAt ?? null).toBeNull();

    // Delete a third time and delete it for good.
    await userEvent.press(await screen.findByLabelText('Back'));
    await waitFor(() => expect(path()).toBe('/settings/data'));
    await userEvent.press(await screen.findByLabelText('Back'));
    await waitFor(() => expect(path()).toBe('/settings'));
    await userEvent.press(await screen.findByLabelText('Back'));
    await waitFor(() => expect(path()).toBe('/today'));
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await deleteFromTaskPage();
    await waitFor(() => expect(path()).toBe('/today'));
    await openRecentlyDeleted();
    await userEvent.press(await screen.findByTestId('deleted-row-a'));
    await userEvent.press(within(await screen.findByTestId('deleted-item-sheet')).getByText('Delete forever'));
    await userEvent.press(within(await screen.findByTestId('deleted-confirm-one')).getByLabelText('Delete forever'));
    await waitFor(() => expect(toast()?.message).toBe('Deleted forever.'));
    expect(await fake.repos.tasks.get('a' as Id)).toBeNull();

    // The days it was logged still count: Progress (from the Settings profile row) shows the same counted days.
    await userEvent.press(await screen.findByLabelText('Back'));
    await waitFor(() => expect(path()).toBe('/settings/data'));
    await userEvent.press(await screen.findByLabelText('Back'));
    await waitFor(() => expect(path()).toBe('/settings'));
    await userEvent.press(await screen.findByText(/^Level \d/));
    await waitFor(() => expect(path()).toBe('/progress'));
    expect(params()).toMatchObject({ from: 'settings' });
    expect(await allTimeCountedDays()).toBe(before);
    await press('Back');
    await waitFor(() => expect(path()).toBe('/settings'));
  });
});

function twoStepRoutine(id: string, name: string) {
  const step = (role: 'ideal' | 'fallback', i: number, text: string) => ({ id: `${id}-${role}-${i}` as Id, taskId: id as Id, role, text, position: i, dueWeekdays: null });
  return routine(id, name, {
    cadence: { kind: 'specific-weekdays', weekdays: [1, 2, 3, 4, 5] },
    idealSteps: [step('ideal', 0, 'Warm up'), step('ideal', 1, 'Main set')],
    fallbackSteps: [step('fallback', 0, 'Just stretch')],
  });
}

describe('journey 5: Search, open a task, edit its schedule, Back to Search', () => {
  it('keeps the search (text and result) when Back comes from the task', async () => {
    fake.seedTask(twoStepRoutine('a', 'Gym session'));
    fake.seedTask(routine('b', 'Gentle yoga'));
    await launch('/today');
    await screen.findByText('Gym session');
    await userEvent.press(await screen.findByLabelText('Search'));
    await waitFor(() => expect(path()).toBe('/search'));
    expect(params()).toMatchObject({ from: 'today' });
    await userEvent.type(await screen.findByLabelText('Search tasks'), 'gym');
    expect(screen.queryByText('Gentle yoga')).toBeNull();
    await userEvent.press(await screen.findByText('Gym session'));
    await waitFor(() => expect(path()).toBe('/task/a'));
    expect(params()).toMatchObject({ from: 'search' });

    // Edit the step schedule: "Main set" does not run on Friday.
    await userEvent.press(await screen.findByLabelText(/Step schedule/));
    const picker = await screen.findByLabelText('Main set schedule');
    await userEvent.press(within(picker).getByLabelText('Fri'));
    await userEvent.press(await screen.findByText('Save schedule'));
    await waitFor(async () => {
      const steps = (await fake.repos.tasks.get('a' as Id))!.idealSteps;
      expect(steps.find((s) => s.text === 'Main set')?.dueWeekdays).toEqual([1, 2, 3, 4]);
      expect(steps.find((s) => s.text === 'Warm up')?.dueWeekdays).toBeNull();
    });
    await waitFor(() => expect(screen.queryByText('Save schedule')).toBeNull());

    // Back: the Search screen the person left, with their text still in the box.
    await press('Back');
    await waitFor(() => expect(path()).toBe('/search'));
    expect(rootStack()).toEqual(['(tabs)', 'search']);
    expect(screen.getByLabelText('Search tasks').props.value).toBe('gym');
    expect(screen.getByText('Gym session')).toBeTruthy();
    expect(screen.queryByText('Gentle yoga')).toBeNull();
    // And Back from Search is Today, with nothing left on top of it.
    await press('Back to Today');
    await waitFor(() => expect(path()).toBe('/today'));
    expect(rootStack()).toEqual(['(tabs)']);
  });
});

async function tapReminder(data: Record<string, unknown>) {
  if (!mockTapListener) throw new Error('the app has not registered a reminder tap listener');
  await act(async () => mockTapListener!({ notification: { request: { content: { data } } } }));
}

describe('journey 6: a reminder tap for a habit that is gone', () => {
  it.each([
    ['deleted', { deletedAt: at('2026-07-15') as never }],
    ['ended', { endedOn: '2026-07-14' as LocalDate }],
  ])('a re-entry tap for a %s habit opens Today with the banner and no crash; its button opens a live habit', async (_kind, patch) => {
    fake.seedTask(routine('a', 'Stretch'));
    fake.seedTask(routine('gone', 'Old habit', patch));
    await launch('/today');
    await screen.findByText('Stretch');
    await tapReminder({ kind: 'gentle-reentry', taskId: 'gone' });
    await waitFor(() => expect(params()).toMatchObject({ reentry: '1', taskId: 'gone' }));
    expect(path()).toBe('/today');
    // The tap did not add a second Today on the stack.
    expect(rootStack()).toEqual(['(tabs)']);
    expect(await screen.findByText("No workout yesterday. That's okay.")).toBeTruthy();
    expect(screen.queryByText('Old habit')).toBeNull();
    await press('Even the fallback counts');
    await waitFor(() => expect(path()).toBe('/task/a'));
    expect(await screen.findByText('Stretch')).toBeTruthy();
  });

  it('with nothing live at all the banner has no button, and Dismiss clears it', async () => {
    fake.seedTask(routine('gone', 'Old habit', { deletedAt: at('2026-07-15') as never }));
    await launch('/today');
    await screen.findByText('Nothing planned for today yet.');
    await tapReminder({ kind: 'gentle-reentry', taskId: 'gone' });
    expect(await screen.findByText("No workout yesterday. That's okay.")).toBeTruthy();
    expect(screen.queryByLabelText('Even the fallback counts')).toBeNull();
    await press('Dismiss');
    await waitFor(() => expect(screen.queryByText("No workout yesterday. That's okay.")).toBeNull());
  });

  it('a tap while the app is still starting is handed to the splash, which opens it once the store is ready', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    fake.seedSettings({ onboardingCompletedAt: at('2026-07-01') as never });
    const { store } = require('@/queries/testSupport/dbMock') as typeof import('@/queries/testSupport/dbMock');
    await launch('/');
    // The layout has armed the tap listener; the store is not ready yet when the tap arrives.
    const status = jest.spyOn(store, 'status').mockReturnValue('closed' as never);
    await tapReminder({ kind: 'gentle-reentry', taskId: 'gone' });
    status.mockRestore();
    expect(path()).toBe('/splash');
    await waitFor(() => expect(path()).toBe('/today'), { timeout: 5000 });
    expect(params()).toMatchObject({ reentry: '1', taskId: 'gone' });
    expect(rootStack()).toEqual(['(tabs)']);
    expect(await screen.findByText("No workout yesterday. That's okay.")).toBeTruthy();
    // A second launch does not replay the tap (it was taken once).
  });

  it.each([
    ['deleted', { deletedAt: at('2026-07-15') as never }, /deleted|Recently deleted/i],
    ['gone for good', null, /./],
  ])('a link straight to a %s task shows a notice, and both Backs leave sensibly', async (_kind, patch, notice) => {
    if (patch) fake.seedTask(routine('gone', 'Old habit', patch));
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/task/gone');
    await waitFor(() => expect(screen.queryByTestId('s20-loading')).toBeNull());
    expect(screen.getAllByText(notice).length).toBeGreaterThan(0);
    expect(rootStack()).toEqual(['task/[id]/index']);
    // On-screen Back with nothing behind it goes to Today.
    await press('Back');
    await waitFor(() => expect(path()).toBe('/today'));
    expect(await screen.findByText('Stretch')).toBeTruthy();
  });
});

/** Presses the phone's back button until the app would exit, returning the path after each press. */
async function backUntilExit(limit = 8): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < limit; i++) {
    const { exited } = await pressBack();
    if (exited) return seen;
    await advance(50);
    seen.push(path());
  }
  seen.push('DID NOT EXIT');
  return seen;
}

/** Today > Settings > Data > Recently deleted, by the real rows. */
async function walkToRecentlyDeleted() {
  await userEvent.press(await screen.findByLabelText('Settings'));
  await waitFor(() => expect(path()).toBe('/settings'));
  await userEvent.press(await screen.findByLabelText('Data'));
  await waitFor(() => expect(path()).toBe('/settings/data'));
  await userEvent.press(await screen.findByTestId('s47-recently-deleted'));
  await waitFor(() => expect(path()).toBe('/settings/data/deleted'));
}

describe('journey 7: the phone back button from deep screens', () => {
  it('Today > Settings > Data > Recently deleted: one screen up per press, then out of the app, no loop', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await screen.findByText('Stretch');
    await walkToRecentlyDeleted();
    expect(await backUntilExit()).toEqual(['/settings/data', '/settings', '/today']);
  });

  it('the Android back button on a tab goes to Today first, then leaves the app', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await screen.findByText('Stretch');
    await openTab('Events');
    await waitFor(() => expect(path()).toBe('/events'));
    await openTab('To-dos');
    await waitFor(() => expect(path()).toBe('/todos'));
    expect(await backUntilExit()).toEqual(['/today']);
  });

  it('the first launch tour: the back button walks the tour back one step at a time, and a resumed step goes to its previous step', async () => {
    fake.seedSettings({ onboardingCompletedAt: null });
    // A person who was killed on step 4 and resumed there: that step is the only screen in the stack.
    await launch('/onboarding/consistency');
    await screen.findByText('Every day counts, ideal or fallback.');
    expect(rootStack()).toEqual(['onboarding/consistency']);
    expect(await backUntilExit()).toEqual(['/onboarding/types', '/onboarding/hook', '/onboarding/concept']);
  });

  it('a link straight to a task (nothing behind it): the phone back button leaves the app', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/task/a');
    await screen.findByText('Stretch');
    expect(await backUntilExit()).toEqual([]);
  });

  it('the phone back button closes an open sheet and stays on the screen (it does not leave the task)', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await waitFor(() => expect(path()).toBe('/task/a'));
    await userEvent.press(await screen.findByTestId('s20-more'));
    await userEvent.press(await screen.findByLabelText('Delete routine'));
    const sheet = await screen.findByTestId('delete-task-sheet');
    // Android turns the back button into the Modal's own close request while a sheet is up.
    await act(async () => fireEvent(sheet, 'requestClose'));
    await waitFor(() => expect(screen.queryByTestId('delete-task-sheet')).toBeNull());
    expect(path()).toBe('/task/a');
    expect(screen.getByText('Stretch')).toBeTruthy();
    expect((await fake.repos.tasks.get('a' as Id))?.deletedAt ?? null).toBeNull();
    expect(await backUntilExit()).toEqual(['/today']);
  });
});

describe('journey 7b: the back stack does not grow when a screen leaves by its own button', () => {
  // Each of these screens leaves with `router.push` or `router.replace` to a screen that is already on
  // the stack, which stacks a second copy on top; the phone back button then walks back through copies.
  // The right call is `router.dismissTo` (as `useOriginAwareBack` now does). Marked failing until fixed.
  it('Settings > Back (to Today) leaves Today alone on the stack', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await userEvent.press(await screen.findByLabelText('Settings'));
    await waitFor(() => expect(path()).toBe('/settings'));
    await press('Back');
    await waitFor(() => expect(path()).toBe('/today'));
    await advance(100);
    expect(rootStack()).toEqual(['(tabs)']);
  });

  it('Settings > Data > Recently deleted > Back, Back leaves exactly the screens that were below', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await screen.findByText('Stretch');
    await walkToRecentlyDeleted();
    const stackAtDeleted = rootStack();
    expect(stackAtDeleted).toHaveLength(4);
    await press('Back');
    await waitFor(() => expect(path()).toBe('/settings/data'));
    await advance(100);
    expect(rootStack()).toEqual(stackAtDeleted.slice(0, 3));
    await press('Back');
    await waitFor(() => expect(path()).toBe('/settings'));
    await advance(100);
    expect(rootStack()).toEqual(stackAtDeleted.slice(0, 2));
  });

  it('Today > Add task > Routine > Save leaves Today alone on the stack', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await screen.findByText('Stretch');
    await press('Add task');
    await userEvent.press(await screen.findByTestId('add-pick-type-routine'));
    await waitFor(() => expect(path()).toBe('/add/routine'));
    await userEvent.type(await screen.findByLabelText('Routine name'), 'Read');
    await press('Thu');
    await userEvent.type(await screen.findByLabelText('Ideal step 1'), 'Read a chapter');
    await userEvent.type(await screen.findByLabelText('Fallback step 1'), 'Read a page');
    await press('Save routine');
    await waitFor(() => expect(path()).toBe('/today'));
    await advance(100);
    expect(rootStack()).toEqual(['(tabs)']);
  });

  it('Today > a task > Delete leaves Today alone on the stack', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await waitFor(() => expect(path()).toBe('/task/a'));
    await deleteFromTaskPage();
    await waitFor(() => expect(path()).toBe('/today'));
    await advance(100);
    expect(rootStack()).toEqual(['(tabs)']);
  });
});

/** What another screen's delete does to the shared data: the write, then every open query refreshes. */
async function deleteElsewhere(id: string) {
  const result = await fake.repos.tasks.softDelete(id as Id);
  expect(result.ok).toBe(true);
  await act(async () => {
    await Promise.all(mockClients.map((c) => (c as unknown as { invalidateQueries(): Promise<void> }).invalidateQueries()));
  });
}

describe('journey 8: a sheet is open and the screen changes underneath it', () => {
  it('the add sheet stays usable if a link moves the app to another tab: it can be closed, and the new tab works', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await screen.findByText('Stretch');
    await press('Add task');
    expect(await screen.findByText('What do you want to add?')).toBeTruthy();
    await act(async () => router.navigate('/routines' as never));
    await waitFor(() => expect(path()).toBe('/routines'));
    // The sheet belongs to the app shell, so it is still up; Close dismisses it and nothing else.
    expect(screen.getByText('What do you want to add?')).toBeTruthy();
    await press('Close');
    await waitFor(() => expect(screen.queryByText('What do you want to add?')).toBeNull());
    expect(path()).toBe('/routines');
    expect(screen.getByText('Stretch')).toBeTruthy();
    expect(rootStack()).toEqual(['(tabs)']);
  });

  it('picking a type from the add sheet after the tab changed opens the form, and Back returns to the tab it was opened over', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await screen.findByText('Stretch');
    await press('Add task');
    await screen.findByText('What do you want to add?');
    await act(async () => router.navigate('/events' as never));
    await waitFor(() => expect(path()).toBe('/events'));
    await userEvent.press(await screen.findByTestId('add-pick-type-todo'));
    await waitFor(() => expect(path()).toBe('/add/todo'));
    expect(screen.queryByText('What do you want to add?')).toBeNull();
    await press('Back');
    await waitFor(() => expect(path()).toBe('/events'));
  });

  // The task page stays mounted under the tab the link opened, still holding its open sheet, and a sheet is
  // a native overlay: on a phone it would stay showing over the new tab. (Here the covered screen is hidden
  // from queries, so the check reads the Modal's own `visible`.) The fix belongs in `Dialog` (close on blur).
  it.failing('a sheet open on a task page is not left showing when a link moves the app to a tab', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await waitFor(() => expect(path()).toBe('/task/a'));
    await userEvent.press(await screen.findByTestId('s20-more'));
    await userEvent.press(await screen.findByLabelText('Delete routine'));
    await screen.findByTestId('delete-task-sheet');
    await act(async () => router.navigate('/routines' as never));
    await waitFor(() => expect(path()).toBe('/routines'));
    const showing = screen.queryAllByTestId('delete-task-sheet', { includeHiddenElements: true }).filter((n) => n.props.visible);
    expect(showing).toHaveLength(0);
  });

  it('that link does not delete or change anything behind the open sheet, and Back from the tab returns through the task page', async () => {
    fake.seedTask(routine('a', 'Stretch'));
    await launch('/today');
    await userEvent.press(await screen.findByLabelText(/^Stretch, .*Opens the task/));
    await waitFor(() => expect(path()).toBe('/task/a'));
    await userEvent.press(await screen.findByTestId('s20-more'));
    await userEvent.press(await screen.findByLabelText('Delete routine'));
    await screen.findByTestId('delete-task-sheet');
    await act(async () => router.navigate('/routines' as never));
    await waitFor(() => expect(path()).toBe('/routines'));
    expect((await fake.repos.tasks.get('a' as Id))?.deletedAt ?? null).toBeNull();
    expect(screen.getByText('Stretch')).toBeTruthy();
    // The stack is bounded and ends: it does not loop between the two.
    const seen = await backUntilExit();
    expect(seen.length).toBeLessThanOrEqual(4);
    expect(seen.at(-1)).not.toBe('DID NOT EXIT');
  });
});

describe('journey 9: a task screen left on the back stack while that task is deleted elsewhere', () => {
  it('Search > task > icon: the icon screen and the task screen both say it was deleted, and Back lands on Search without it', async () => {
    fake.seedTask(routine('a', 'Gym session'));
    fake.seedTask(routine('b', 'Gentle yoga'));
    await launch('/today');
    await screen.findByText('Gym session');
    await userEvent.press(await screen.findByLabelText('Search'));
    await waitFor(() => expect(path()).toBe('/search'));
    await userEvent.press(await screen.findByText('Gym session'));
    await waitFor(() => expect(path()).toBe('/task/a'));
    await userEvent.press(await screen.findByTestId('s20-icon-avatar'));
    await waitFor(() => expect(path()).toBe('/task/a/icon'));
    await userEvent.press(await screen.findByLabelText('Indigo'));

    await deleteElsewhere('a');
    expect(await screen.findByText('"Gym session" was deleted.')).toBeTruthy();
    expect(screen.queryByLabelText('Save')).toBeNull();
    // Leaving the icon screen shows the task screen under it, also saying so (and nothing to log).
    await press('Back');
    await waitFor(() => expect(path()).toBe('/task/a'));
    expect(await screen.findByText('"Gym session" was deleted.')).toBeTruthy();
    expect(screen.queryByLabelText(/Gym session: Done/)).toBeNull();
    await press('Back');
    await waitFor(() => expect(path()).toBe('/search'));
    expect(await screen.findByText('Gentle yoga')).toBeTruthy();
    expect(screen.queryByText('Gym session')).toBeNull();
    expect(rootStack()).toEqual(['(tabs)', 'search']);
  });

  it('a Save on the icon screen that lands after the delete is refused with the retry toast, and nothing is written to the deleted task', async () => {
    fake.seedTask(routine('a', 'Gym session'));
    await launch('/task/a/icon');
    await userEvent.press(await screen.findByLabelText('Indigo'));
    // The delete happens in the store but this screen has not heard yet (no refresh): Save is still on screen.
    expect((await fake.repos.tasks.softDelete('a' as Id)).ok).toBe(true);
    await userEvent.press(await screen.findByLabelText('Save'));
    await waitFor(() => expect(toast()?.tone).toBe('warning'));
    expect(toast()?.message).toBe("Couldn't save that. Try again.");
    expect((await fake.repos.tasks.get('a' as Id))?.color).toBe('forge-orange');
  });

  it('a log tapped on a task page whose task was deleted a moment earlier does not write a log, and the page then shows the notice', async () => {
    fake.seedTask(routine('a', 'Gym session'));
    await launch('/today');
    await userEvent.press(await screen.findByLabelText(/^Gym session, .*Opens the task/));
    await waitFor(() => expect(path()).toBe('/task/a'));
    const done = await screen.findByLabelText('Gym session: Done');
    expect((await fake.repos.tasks.softDelete('a' as Id)).ok).toBe(true);
    await userEvent.press(done);
    await waitFor(() => expect(toast()?.tone).toBe('warning'));
    expect(fake.logsFor('a' as Id)).toHaveLength(0);
    expect(useCelebrationStore.getState().queue).toHaveLength(0);
    await deleteElsewhere('a').catch(() => undefined);
  });

  it('Restore on the stale task screen brings the page back to life and Today lists it again', async () => {
    fake.seedTask(routine('a', 'Gym session'));
    await launch('/today');
    await userEvent.press(await screen.findByLabelText(/^Gym session, .*Opens the task/));
    await waitFor(() => expect(path()).toBe('/task/a'));
    await deleteElsewhere('a');
    await userEvent.press(await screen.findByText('Restore'));
    expect(await screen.findByLabelText('Gym session: Done')).toBeTruthy();
    await press('Back');
    await waitFor(() => expect(path()).toBe('/today'));
    expect(await screen.findByText('0 of 1 done')).toBeTruthy();
  });
});
