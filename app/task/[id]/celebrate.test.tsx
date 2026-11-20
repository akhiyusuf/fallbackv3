/**
 * S24 — completion feedback. A daily log no longer opens a screen: the route replays the log's
 * feedback (toast with XP) and returns to the task. Only a level-up or badge is queued for the
 * milestone pop-up.
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
import { waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import { useToastStore } from '@/app-shell/stores/toast';
import { useCelebrationStore } from '@/app-shell';
import type { Id } from '@/types';

let client: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  fake.reset();
  clock.today = '2026-07-16';
  clock.now = '2026-07-16T12:00:00.000Z';
  useToastStore.setState({ toast: null });
  useCelebrationStore.setState({ queue: [] });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }, mutations: { retry: false } },
  });
});

describe('S24 Completion Celebration', () => {
  it('ideal variant: "Ideal done" toast with +10 XP, then back on the task', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=ideal&xp=10&levelUp=0', wrapper });
    expect(await screen.findByText('Morning workout')).toBeTruthy();
    const toast = useToastStore.getState().toast;
    expect(toast?.message).toBe('Ideal done.');
    expect(toast?.tone).toBe('success');
    expect(toast?.detail).toBe('+10 XP');
    expect(useCelebrationStore.getState().queue).toEqual([]);
  });

  it('fallback variant: "Fallback done" toast with +6 XP and no pop-up', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=fallback&xp=6&levelUp=0', wrapper });
    expect(await screen.findByText('Morning workout')).toBeTruthy();
    const toast = useToastStore.getState().toast;
    expect(toast?.message).toBe('Fallback done.');
    expect(toast?.detail).toBe('+6 XP');
    expect(useCelebrationStore.getState().queue).toEqual([]);
  });

  it('a daily log with no level-up or badge stays on the task with no pop-up', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=ideal&xp=10&levelUp=0&from=today', wrapper });
    expect(await screen.findByText('Morning workout')).toBeTruthy();
    expect(screen.queryByText('MARKER_TODAY')).toBeNull();
    expect(useCelebrationStore.getState().queue).toEqual([]);
    expect(useToastStore.getState().toast?.message).toBe('Ideal done.');
  });

  it('a level-up completion queues the level-up pop-up with the lifetime XP', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=ideal&xp=10&levelUp=1', wrapper });
    expect(await screen.findByText('Morning workout')).toBeTruthy();
    await waitFor(() => {
      expect(useCelebrationStore.getState().queue).toEqual([expect.objectContaining({ kind: 'level-up' })]);
    });
  });

  it('a tenure-milestone completion (no level-up) queues the badge pop-up with its badgeKey', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=fallback&xp=6&levelUp=0&badgeKey=tenure-30', wrapper });
    expect(await screen.findByText('Morning workout')).toBeTruthy();
    expect(useCelebrationStore.getState().queue).toEqual([{ kind: 'badge', badgeKey: 'tenure-30' }]);
  });
});
