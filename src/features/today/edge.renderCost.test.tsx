/**
 * Round 4, UI speed with 150 habits. Real read hooks over the fake repositories, the real Today
 * and Routines screens: how many rows re-render when one habit is logged, how many repository
 * reads a mount costs (each Routines card draws a week strip), and how long a mount takes.
 */
import React, { Profiler } from 'react';
import { act, render, screen, waitFor, userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') }));
jest.mock('@/db', () => require('@/queries/testSupport/dbMock'));
jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('@/queries/testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

const mockIconCalls = { n: 0 };
jest.mock('@/features/browse/resolveIcon', () => {
  const actual = jest.requireActual('@/features/browse/resolveIcon');
  return { ...actual, taskIconProps: (t: never) => { mockIconCalls.n += 1; return actual.taskIconProps(t); } };
});

import { clock } from '@/queries/testSupport/clockMock';
import { fake, repos } from '@/queries/testSupport/dbMock';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { TaskCard } from '@/features/task/TaskCard';
import type { DayLog, Id, TaskWithSteps } from '@/types';
import TodayScreen from './TodayScreen';
import RoutinesBrowseScreen from '@/features/browse/RoutinesBrowseScreen';

const N = 150;

function seed(n: number) {
  for (let i = 0; i < n; i++) {
    const id = `h${String(i).padStart(3, '0')}` as Id;
    fake.seedTask(
      makeTask({
        id,
        name: `Habit ${String(i).padStart(3, '0')}`,
        createdAt: '2026-01-01T00:00:00.000Z' as TaskWithSteps['createdAt'],
        idealSteps: [{ id: `${id}-i` as Id, taskId: id, role: 'ideal', text: 'Ideal', position: 0, dueWeekdays: null }],
        fallbackSteps: [{ id: `${id}-f` as Id, taskId: id, role: 'fallback', text: 'Fallback', position: 0, dueWeekdays: null }],
      }),
    );
  }
}

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60_000, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } } });
}

function reads() {
  return {
    tasksGet: jest.spyOn(repos.tasks, 'get'),
    tasksList: jest.spyOn(repos.tasks, 'list'),
    logsForTask: jest.spyOn(repos.logs, 'listForTask'),
    logsRange: jest.spyOn(repos.logs, 'listRange'),
    offRange: jest.spyOn(repos.offDays, 'listRange'),
  };
}
const total = (r: ReturnType<typeof reads>) => Object.values(r).reduce((s, m) => s + m.mock.calls.length, 0);

const commits: number[] = [];
function onRender(_id: string, _phase: string, actual: number) {
  commits.push(actual);
}
function mkLog(taskId: string, date: string, chipState: 'done' | 'fallback'): DayLog {
  return { id: `${taskId}:${date}`, taskId, date, chipState, isManualOverride: true, completedStepIds: [], dosesCompleted: 1, movedToDate: null, createdAt: `${date}T09:00:00.000Z`, updatedAt: `${date}T09:00:00.000Z` } as unknown as DayLog;
}
const settle = (ms = 400) => act(async () => { await new Promise((res) => setTimeout(res, ms)); });
const counts = (r: ReturnType<typeof reads>) => Object.fromEntries(Object.entries(r).map(([k, m]) => [k, m.mock.calls.length]));

beforeEach(() => {
  clock.today = '2026-07-16';
  clock.now = '2026-07-16T12:00:00.000Z';
  fake.reset();
  commits.length = 0;
  mockIconCalls.n = 0;
});
afterEach(() => jest.restoreAllMocks());

/**
 * Budgets, measured on this machine before and after (jest, dev React, 150 daily routines):
 *   Routines mount:            454 repository reads, 152 commits  ->  7 reads, 3 commits
 *   Routines after one log:    450 reads                          ->  3 reads
 *   Today, one habit logged:   150 row renders                    ->  1
 * The budgets leave a little room; a regression to one query per card, or to every row redrawing,
 * is far outside them.
 */
describe('render cost with 150 habits', () => {
  async function mountRoutines(c: QueryClient) {
    await render(
      <QueryClientProvider client={c}>
        <Profiler id="screen" onRender={onRender}>
          <RoutinesBrowseScreen />
        </Profiler>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByText('Habit 000').length).toBeGreaterThan(0), { timeout: 30000 });
    await settle(600);
  }

  it('Routines: the 150 week strips cost a handful of reads, not one query per card', async () => {
    seed(N);
    const r = reads();
    await mountRoutines(client());
    console.log('ROUTINES mount: reads', JSON.stringify(counts(r)), 'commits', commits.length, 'render ms', commits.reduce((a, b) => a + b, 0).toFixed(0));
    expect(screen.getAllByLabelText(/^Last seven days/).length).toBe(N);
    expect(r.tasksGet).not.toHaveBeenCalled();
    expect(r.logsForTask).not.toHaveBeenCalled();
    expect(total(r)).toBeLessThanOrEqual(12);
    expect(commits.length).toBeLessThanOrEqual(6);
  }, 120000);

  it('Routines: a log elsewhere refreshes the strips with a handful of reads and redraws only the card that changed', async () => {
    seed(N);
    const c = client();
    await mountRoutines(c);
    const r = reads();
    mockIconCalls.n = 0;
    const strips = () => screen.getAllByLabelText(/^Last seven days/).map((n) => String(n.props.accessibilityLabel));
    const labelsBefore = strips();
    await act(async () => { await repos.logs.upsert(mkLog('h007', '2026-07-16', 'done')); });
    await act(async () => { await c.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'taskOccurrences' || q.queryKey[0] === 'today' }); });
    await settle();
    const labelsAfter = strips();
    console.log('ROUTINES after a log: reads', total(r), 'card renders', mockIconCalls.n);
    expect(total(r)).toBeLessThanOrEqual(10);
    expect(r.tasksGet).not.toHaveBeenCalled();
    expect(mockIconCalls.n).toBeLessThanOrEqual(5);
    // Exactly one strip changed (habit 007, today ticked as ideal); the other 149 read the same.
    const changed = labelsAfter.map((l, i) => (l === labelsBefore[i] ? -1 : i)).filter((i) => i >= 0);
    expect(changed).toHaveLength(1);
    expect(labelsAfter[changed[0]]).toMatch(/ ideal$/);
  }, 120000);

  it('Routines: the batched strips say exactly what a card reading its own strip says', async () => {
    seed(8);
    await repos.logs.upsert(mkLog('h001', '2026-07-15', 'done'));
    await repos.logs.upsert(mkLog('h001', '2026-07-13', 'fallback'));
    await repos.offDays.mark({ id: 'off1', date: '2026-07-12', taskId: 'h001', priorChipState: null, createdAt: '2026-07-12T09:00:00.000Z' } as never);
    const c = client();
    await mountRoutines(c);
    const batched = screen.getAllByLabelText(/^Last seven days/).map((n) => String(n.props.accessibilityLabel));
    expect(batched).toHaveLength(8);
    // The same habits drawn one by one, outside a provider: each runs its own query.
    const tasks = await repos.tasks.list();
    const own: string[] = [];
    for (const t of tasks) {
      const view = await render(
        <QueryClientProvider client={client()}>
          <TaskCard task={t} meta={['x']} onPress={() => {}} />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(screen.getAllByLabelText(/^Last seven days/).length).toBeGreaterThan(0));
      await settle(100);
      own.push(String(screen.getAllByLabelText(/^Last seven days/)[0].props.accessibilityLabel));
      await view.unmount();
    }
    expect([...batched].sort()).toEqual([...own].sort());
    expect(batched.some((l) => / ideal/.test(l) && / fallback/.test(l) && / off day/.test(l))).toBe(true);
  }, 120000);

  it('Routines: a card outside the list (Search) still reads its own strip', async () => {
    seed(1);
    const r = reads();
    const [t] = await repos.tasks.list();
    await render(
      <QueryClientProvider client={client()}>
        <TaskCard task={t} meta={['x']} onPress={() => {}} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(r.tasksGet).toHaveBeenCalledTimes(1));
  });

  it('Today: logging one habit redraws that one row, not all 150', async () => {
    seed(N);
    const r = reads();
    const c = client();
    await render(
      <QueryClientProvider client={c}>
        <Profiler id="screen" onRender={onRender}>
          <TodayScreen />
        </Profiler>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('0 of 150 done')).toBeTruthy(), { timeout: 30000 });
    await settle();
    console.log('TODAY mount: row renders', mockIconCalls.n, 'reads', JSON.stringify(counts(r)));
    expect(mockIconCalls.n).toBe(N);
    const user = userEvent.setup();
    mockIconCalls.n = 0;
    commits.length = 0;
    await user.press(screen.getByLabelText('Habit 000: Done'));
    await waitFor(() => expect(screen.getByText('1 of 150 done')).toBeTruthy(), { timeout: 30000 });
    await settle();
    console.log('TODAY one log: row renders', mockIconCalls.n, 'commits', commits.length, 'render ms', commits.map((x) => x.toFixed(0)).join(','));
    expect(mockIconCalls.n).toBeLessThanOrEqual(3);
    expect(screen.getByText('1 of 150 done')).toBeTruthy();
    // and the row that was logged shows its state, the others still offer their buttons
    expect(screen.queryByLabelText('Habit 000: Done')).toBeNull();
    expect(screen.getByLabelText('Habit 001: Done')).toBeTruthy();
  }, 120000);

  it('Today: undo and a second log on the same screen still act on the latest rows', async () => {
    seed(12);
    await render(
      <QueryClientProvider client={client()}>
        <TodayScreen />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('0 of 12 done')).toBeTruthy());
    const user = userEvent.setup();
    await user.press(screen.getByLabelText('Habit 000: Done'));
    await waitFor(() => expect(screen.getByText('1 of 12 done')).toBeTruthy());
    await user.press(screen.getByLabelText('Habit 003: Fallback'));
    await waitFor(() => expect(screen.getByText('2 of 12 done')).toBeTruthy());
    expect(mockIconCalls.n).toBeLessThan(12 + 8);
  }, 120000);
});
