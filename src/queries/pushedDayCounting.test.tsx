jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
  };
});

jest.mock('@/db', () => require('./testSupport/dbMock'));

jest.mock('@/lib/date', () => {
  const actual = jest.requireActual('@/lib/date');
  const { clock } = require('./testSupport/clockMock');
  return { ...actual, today: () => clock.today, now: () => clock.now };
});

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { Instant, LocalDate, Step, TaskWithSteps } from '@/types';




import { fake, repos } from './testSupport/dbMock';
import { clock } from './testSupport/clockMock';

import { useConsistency } from './reads';

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: true },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(client: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

const activeUnmounts: Array<() => void> = [];
const activeClients: QueryClient[] = [];

async function rh<T>(hook: () => T, client: QueryClient) {
  activeClients.push(client);
  const r = await renderHook(hook, { wrapper: makeWrapper(client) });
  activeUnmounts.push(r.unmount);
  return r;
}

afterEach(async () => {
  await act(async () => {
    activeUnmounts.forEach((fn) => fn());
  });
  activeUnmounts.length = 0;
  activeClients.forEach((c) => c.clear());
  activeClients.length = 0;
});

beforeEach(() => {
  fake.reset();
  clock.today = '2024-06-01';
  clock.now = '2024-06-01T12:00:00.000Z';
});

/** Runs one mutation hook and returns what it resolved to. */
async function mutate<TArg, TRes>(useHook: () => { mutateAsync: (a: TArg) => Promise<TRes> }, arg: TArg): Promise<TRes> {
  const { result } = await rh(useHook, freshClient());
  let out!: TRes;
  await act(async () => {
    out = await result.current.mutateAsync(arg);
  });
  return out;
}

/** Reads one query on a NEW client, so it is fetched from the repositories as they stand now. */
async function readNow<T>(useHook: () => { data: T | undefined; isSuccess: boolean; isError: boolean }): Promise<T> {
  const { result } = await rh(useHook, freshClient());
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result.current.data as T;
}
/**
 * Thirtieth pass, the human's own phone: one daily Workout. Done on day 1, pushed to tomorrow on
 * day 2, nothing done on day 3, looked at on day 4. Workout alone read 33% ("1 of 3 counted days")
 * and All tasks read 50% ("1 full day, 1 missed") for the same single habit. A pushed habit now
 * counts for the day it was pushed from, so both read the same days.
 */
const TASK_ID = 'workout' as TaskWithSteps['id'];
function workout(): TaskWithSteps {
  const ideal: Step = { id: 'w-ideal' as Step['id'], taskId: TASK_ID, role: 'ideal', text: 'Full workout', position: 0, dueWeekdays: null };
  const fb: Step = { id: 'w-fb' as Step['id'], taskId: TASK_ID, role: 'fallback', text: '10 push-ups', position: 0, dueWeekdays: null };
  return {
    id: TASK_ID, type: 'routine', name: 'Workout', note: null, icon: 'Repeat', color: 'forge-orange', isAsNeeded: false,
    cadence: { kind: 'daily' }, eventDate: null, timeOfDay: null, startDate: null, endDate: null, dosesPerDay: 1, isTracked: true,
    importance: null, necessity: null, todoDoneAt: null, priorityRank: null, isNote: false, snoozable: true,
    createdAt: '2024-06-01T08:00:00.000Z' as Instant, updatedAt: '2024-06-01T08:00:00.000Z' as Instant, deletedAt: null, endedOn: null,
    idealSteps: [ideal], fallbackSteps: [fb],
  } as TaskWithSteps;
}
async function row(date: string, chip: 'done' | 'fallback' | 'todo', movedToDate: string | null = null) {
  await repos.logs.upsert({
    id: `w-${date}` as never, taskId: TASK_ID, date: date as LocalDate, chipState: chip, isManualOverride: chip !== 'todo',
    completedStepIds: [], dosesCompleted: 0, movedToDate: movedToDate as LocalDate | null,
    createdAt: `${date}T10:00:00.000Z` as Instant, updatedAt: `${date}T10:00:00.000Z` as Instant,
  });
}
async function bothViews(window: 'last-30' | 'all-time' = 'last-30') {
  const one = await readNow(() => useConsistency({ scope: 'per-task', window, taskId: TASK_ID }));
  const all = await readNow(() => useConsistency({ scope: 'aggregate', window }));
  return { one, all };
}

describe('one habit, pushed to tomorrow: Workout alone and All tasks read the same days', () => {
  beforeEach(async () => {
    fake.seedTask(workout());
    await row('2024-06-01', 'done');
    clock.today = '2024-06-04';
    clock.now = '2024-06-04T12:00:00.000Z';
  });

  it('pushed and not done the next day: day 2 is missed, day 3 is missed, both views 33%', async () => {
    await row('2024-06-02', 'todo', '2024-06-03');
    for (const window of ['last-30', 'all-time'] as const) {
      const { one, all } = await bothViews(window);
      expect(one.percent).toBe(33);
      expect(all.percent).toBe(33);
      expect(one.breakdown).toMatchObject({ ideal: 1, fallback: 0, missed: 2 });
      expect(all.days).toEqual({ full: 1, partial: 0, missed: 2 });
      expect(one.countedDates).toEqual(['2024-06-01', '2024-06-02', '2024-06-03']);
      expect(all.countedDates).toEqual(['2024-06-01', '2024-06-02', '2024-06-03']);
    }
  });

  it('pushed and done the next day: day 2 was kept (full), day 3 own missed', async () => {
    await row('2024-06-02', 'done', '2024-06-03');
    const { one, all } = await bothViews();
    expect(one.percent).toBe(67);
    expect(all.percent).toBe(67);
    expect(all.days).toEqual({ full: 2, partial: 0, missed: 1 });
  });

  it('pushed, and only day 3 own done: day 2 missed, day 3 full, still the same in both', async () => {
    await row('2024-06-02', 'todo', '2024-06-03');
    await row('2024-06-03', 'fallback');
    const { one, all } = await bothViews();
    expect(one.percent).toBe(67);
    expect(all.percent).toBe(67);
    expect(one.breakdown).toMatchObject({ ideal: 1, fallback: 1, missed: 1 });
    expect(all.days).toEqual({ full: 2, partial: 0, missed: 1 });
  });

  it('pushed today to tomorrow: nothing about it counts yet', async () => {
    await row('2024-06-02', 'done');
    await row('2024-06-03', 'done');
    await row('2024-06-04', 'todo', '2024-06-05');
    const { one, all } = await bothViews();
    expect(one.percent).toBe(100);
    expect(all.percent).toBe(100);
    expect(all.days).toEqual({ full: 3, partial: 0, missed: 0 });
  });
});
