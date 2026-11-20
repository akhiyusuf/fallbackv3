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
      mockClients.push(this);
    }
  }
  return { ...actual, QueryClient: CapturingClient };
});

import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import { store as routerStore } from 'expo-router/build/global-state/router-store';
import { renderRouter, screen } from 'expo-router/testing-library';
import { act, userEvent, waitFor, within } from '@testing-library/react-native';

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
function pressBack(): { exited: boolean } {
  let exited = true;
  act(() => {
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
/** Which tab the tab group is on (its focused route), whatever sits above it on the root stack. */
function tabName(): string | undefined {
  type S = { index?: number; routes: { name: string; state?: S }[] };
  let state = routerStore.state as S | undefined;
  while (state && state.routes.length === 1 && state.routes[0]!.name === '__root') state = state.routes[0]!.state;
  const tabs = state?.routes.find((r) => r.name === '(tabs)')?.state;
  return tabs ? tabs.routes[tabs.index ?? 0]?.name : undefined;
}
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
const toast = () => useToastStore.getState().toast;
function texts(): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n) return;
    if (typeof n === 'string') return void out.push(n);
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as { children?: unknown };
    walk(node.children);
  };
  walk(screen.toJSON());
  return out;
}



async function press(label: string | RegExp) {
  await userEvent.press(await screen.findByLabelText(label));
}

describe('journey 1: first launch to Progress', () => {
  it('splash, the tour, the first routine, Today, log it, the badge, Progress', async () => {
    await launch('/');
    await waitFor(() => expect(path()).toBe('/onboarding/concept'), { timeout: 5000 });
    expect(screen.getByText('a plan A and a plan B for every habit.')).toBeTruthy();
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
    await waitFor(async () => {
      await advance(400);
      expect(screen.queryByText("You've reached First day.")).toBeTruthy();
    });
    expect(useCelebrationStore.getState().queue).toHaveLength(1);
    await press('Nice');
    await waitFor(() => expect(screen.queryByText("You've reached First day.")).toBeNull());
    expect(useCelebrationStore.getState().queue).toHaveLength(0);
    // Open Progress from the stat card on Today.
    await userEvent.press((await screen.findAllByLabelText(/^Showing up/))[0]!);
    await waitFor(() => expect(path()).toBe('/progress'));
    expect(await screen.findByText('Your consistency')).toBeTruthy();
    expect((await screen.findAllByLabelText(/^100 percent showed up/)).length).toBeGreaterThan(0);
    // Back from Progress is Today, with the day still logged.
    await press('Back');
    await waitFor(() => expect(path()).toBe('/today'));
    expect(screen.getByText('1 of 1 done')).toBeTruthy();
    expect(rootStack()).toEqual(['(tabs)']);
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
    expect(toast()?.message).toBe('Routine saved');
    expect(await screen.findByText('0 of 2 done')).toBeTruthy();

    await openTab('Routines');
    await userEvent.press(await screen.findByText('Read'));
    await waitFor(() => expect(path()).toMatch(/^\/task\//));
    expect(params()).toMatchObject({ from: 'routines' });
    const taskId = String(params().id);
    await userEvent.press(await screen.findByTestId('s20-snooze'));
    await waitFor(() => expect(toast()?.message).toBe('Pushed to tomorrow'));
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
    const rows = fake.logsFor(taskId as Id).filter((l) => l.date === D2);
    expect(rows).toHaveLength(2);
    expect(rows.every((l) => l.chipState === 'done')).toBe(true);
    expect(rows.map((l) => l.pushedFrom ?? null).sort()).toEqual([null, D1].sort());
  });
});
