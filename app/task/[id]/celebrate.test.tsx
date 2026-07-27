/**
 * M4 — S24 Completion Celebration. Ideal/fallback variants, XP line, "Continue" dismissal,
 * and the outbound handoff to S28 for a level-up / tenure milestone (M5's contract).
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
import { userEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fake } from '@/queries/testSupport/dbMock';
import { clock } from '@/queries/testSupport/clockMock';
import { makeTask } from '@/features/task/testSupport/taskFixture';
import { ROUTER_CONTEXT } from '@/features/task/testSupport/routerHarness';
import type { Id } from '@/types';

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

describe('S24 Completion Celebration', () => {
  it('ideal variant: verbatim headline and +10 XP', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=ideal&xp=10&levelUp=0', wrapper });
    expect(await screen.findByText('Nice — ideal done!')).toBeTruthy();
    expect(screen.getByText('+10 XP')).toBeTruthy();
  });

  it('fallback variant: verbatim headline, +6 XP, no confetti/gold affordance rendered', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=fallback&xp=6&levelUp=0', wrapper });
    expect(await screen.findByText('You showed up 💪')).toBeTruthy();
    expect(screen.getByText('+6 XP')).toBeTruthy();
    expect(screen.queryByText(/confetti/i)).toBeNull();
  });

  it('Continue with no level-up/badge dismisses back to the origin (S09 default)', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=ideal&xp=10&levelUp=0&from=today', wrapper });
    await screen.findByText('Nice — ideal done!');
    await userEvent.press(screen.getByLabelText('Continue'));
    expect(await screen.findByText('MARKER_TODAY')).toBeTruthy();
  });

  it('a level-up completion navigates to S28 with the M5-specified contract: kind=level-up&xp=<lifetime>', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=ideal&xp=10&levelUp=1', wrapper });
    await screen.findByText('Nice — ideal done!');
    await userEvent.press(screen.getByLabelText('Continue'));
    expect(await screen.findByText('MARKER_ACHIEVEMENTS_CELEBRATE')).toBeTruthy();
  });

  it('a tenure-milestone completion (no level-up) navigates to S28 with kind=tenure&badgeKey=<key>', async () => {
    fake.seedTask(makeTask({ id: 'task-1' as Id }));
    await renderRouter(ROUTER_CONTEXT, { initialUrl: '/task/task-1/celebrate?variant=fallback&xp=6&levelUp=0&badgeKey=tenure-30', wrapper });
    await screen.findByText('You showed up 💪');
    await userEvent.press(screen.getByLabelText('Continue'));
    expect(await screen.findByText('MARKER_ACHIEVEMENTS_CELEBRATE')).toBeTruthy();
  });
});
